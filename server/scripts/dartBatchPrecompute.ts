// 코스피+코스닥 기업의 DART 재무데이터를 배치로 수집해 financial_cache에 저장.
// 실행: npx ts-node server/scripts/dartBatchPrecompute.ts
//
// API 메모: fnlttSinglAcnt.json은 fs_div 없이 호출하면 CFS+OFS를 한 번에 반환.
// 응답 내 fs_div 필드("CFS" | "OFS")로 구분하므로 연도당 1회 호출 (4회/기업).
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { getRecentFiscalYears } from '../src/lib/fiscalYears';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
const dartKey     = process.env.DART_API_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
if (!dartKey)                      throw new Error('Missing DART_API_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const DART_BASE   = 'https://opendart.fss.or.kr/api';
const DELAY_MS    = 300;
const RETRY_WAIT  = 5_000;
const MAX_RETRIES = 3;
// 하드코딩 → 동적 계산(2026-08-21) — 예전엔 시간이 지나면 배열이 그대로 굳어 최신 사업보고서를
// 영구히 못 가져오는 구조적 결함이었다(데이원컴퍼니 FY2025 미표시로 발견). 라이브 경로
// (dart.ts)와 동일한 공용 헬퍼 사용.
const YEARS = getRecentFiscalYears(4);

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface DartFinRow {
  fs_div:        string;
  account_nm:    string;
  thstrm_amount: string;
}

interface DartResponse {
  status:   string;
  message?: string;
  list?:    DartFinRow[];
}

async function fetchDart(url: string, attempt = 0): Promise<DartResponse | null> {
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) return null;
      console.log(`  [429] 5초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_WAIT);
      return fetchDart(url, attempt + 1);
    }
    if (!res.ok) return null;
    return (await res.json()) as DartResponse;
  } catch {
    if (attempt >= MAX_RETRIES) return null;
    await sleep(RETRY_WAIT);
    return fetchDart(url, attempt + 1);
  }
}

// 계정명 별칭 — 기업마다 표기 다양
const ALIASES: Record<string, string[]> = {
  revenue:         ['매출액', '수익(매출액)', '영업수익', '매출', '수익'],
  operatingIncome: ['영업이익', '영업이익(손실)'],
  netIncome:       ['당기순이익', '당기순이익(손실)', '분기순이익', '반기순이익'],
  assets:          ['자산총계'],
  liabilities:     ['부채총계'],
  equity:          ['자본총계'],
};

function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

function pickAccount(list: DartFinRow[], fsDiv: string, aliases: string[]): number | null {
  for (const alias of aliases) {
    const row = list.find(r => r.fs_div === fsDiv && r.account_nm === alias);
    const val = parseAmount(row?.thstrm_amount);
    if (val !== null) return val;
  }
  return null;
}

interface YearSlice {
  revenue:         number | null;
  operatingIncome: number | null;
  netIncome:       number | null;
  assets:          number | null;
  liabilities:     number | null;
  equity:          number | null;
}

function extractSlice(list: DartFinRow[], fsDiv: string): YearSlice {
  return {
    revenue:         pickAccount(list, fsDiv, ALIASES.revenue),
    operatingIncome: pickAccount(list, fsDiv, ALIASES.operatingIncome),
    netIncome:       pickAccount(list, fsDiv, ALIASES.netIncome),
    assets:          pickAccount(list, fsDiv, ALIASES.assets),
    liabilities:     pickAccount(list, fsDiv, ALIASES.liabilities),
    equity:          pickAccount(list, fsDiv, ALIASES.equity),
  };
}

function hasData(s: YearSlice): boolean {
  return Object.values(s).some(v => v !== null);
}

interface FinSeries {
  revenue:         (number | null)[];
  operatingIncome: (number | null)[];
  netIncome:       (number | null)[];
  assets:          (number | null)[];
  liabilities:     (number | null)[];
  equity:          (number | null)[];
  fiscalYears:     string[];
}

function buildSeries(yearMap: Map<string, YearSlice>): FinSeries | null {
  const years = YEARS.filter(y => yearMap.has(y));
  if (years.length === 0) return null;
  return {
    revenue:         years.map(y => yearMap.get(y)!.revenue),
    operatingIncome: years.map(y => yearMap.get(y)!.operatingIncome),
    netIncome:       years.map(y => yearMap.get(y)!.netIncome),
    assets:          years.map(y => yearMap.get(y)!.assets),
    liabilities:     years.map(y => yearMap.get(y)!.liabilities),
    equity:          years.map(y => yearMap.get(y)!.equity),
    fiscalYears:     years,
  };
}

function fmtKrw(val: number | null | undefined): string {
  if (val == null) return '확인 필요';
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000)       return `${sign}${(abs / 100_000_000).toFixed(0)}억원`;
  return `${sign}${val.toLocaleString()}원`;
}

async function processCompany(
  idx: number,
  total: number,
  corpCode: string,
  corpName: string,
  stockCode: string,
): Promise<{ ok: boolean; hasCfs: boolean }> {
  const cfsMap = new Map<string, YearSlice>();
  const ofsMap = new Map<string, YearSlice>();

  for (const year of YEARS) {
    const url =
      `${DART_BASE}/fnlttSinglAcnt.json` +
      `?crtfc_key=${encodeURIComponent(dartKey!)}` +
      `&corp_code=${corpCode}` +
      `&bsns_year=${year}` +
      `&reprt_code=11011`;

    const res = await fetchDart(url);
    await sleep(DELAY_MS);

    if (res?.status !== '000' || !res.list?.length) continue;

    const cfsSlice = extractSlice(res.list, 'CFS');
    const ofsSlice = extractSlice(res.list, 'OFS');

    if (hasData(cfsSlice)) cfsMap.set(year, cfsSlice);
    if (hasData(ofsSlice)) ofsMap.set(year, ofsSlice);
  }

  const cfs    = buildSeries(cfsMap);
  const ofs    = buildSeries(ofsMap);
  const hasCfs = cfs !== null;

  if (!cfs && !ofs) {
    console.log(`진행 중 [${idx}/${total}] ${corpName} — 실패 (재무 데이터 없음)`);
    return { ok: false, hasCfs: false };
  }

  const rawDart = {
    ticker:    stockCode,
    corp_code: corpCode,
    corp_name: corpName,
    cfs,
    ofs,
    currency: 'KRW',
    source:   'DART',
  };

  // Claude 프롬프트 호환 context_text (기존 financialContext.ts 연동용)
  const primary      = cfs ?? ofs!;
  const primaryLabel = cfs ? '연결재무제표' : '재무제표';
  const latestYear   = primary.fiscalYears[0];

  const lines = [
    `=== DART 공시 데이터 (배치 프리컴퓨트) ===`,
    `기업: ${corpName}  (corp_code: ${corpCode}  ticker: ${stockCode})`,
    ``,
    `[${latestYear}년 ${primaryLabel} — 금액 단위: KRW]`,
    `· 매출액:     ${fmtKrw(primary.revenue[0])}  (DART 공시)`,
    `· 영업이익:   ${fmtKrw(primary.operatingIncome[0])}  (DART 공시)`,
    `· 당기순이익: ${fmtKrw(primary.netIncome[0])}  (DART 공시)`,
    `· 자산총계:   ${fmtKrw(primary.assets[0])}  (DART 공시)`,
    `· 부채총계:   ${fmtKrw(primary.liabilities[0])}  (DART 공시)`,
    `· 자본총계:   ${fmtKrw(primary.equity[0])}  (DART 공시)`,
  ];

  if (primary.fiscalYears.length > 1) {
    lines.push(``, `[다년도 매출 추이 (${primaryLabel})]`);
    primary.fiscalYears.forEach((fy, i) => lines.push(`· ${fy}: ${fmtKrw(primary.revenue[i])}`));
  }

  if (cfs && ofs) {
    lines.push(``, `[${latestYear}년 개별재무제표]`);
    lines.push(`· 매출액:     ${fmtKrw(ofs.revenue[0])}  (DART 공시)`);
    lines.push(`· 영업이익:   ${fmtKrw(ofs.operatingIncome[0])}  (DART 공시)`);
    lines.push(`· 당기순이익: ${fmtKrw(ofs.netIncome[0])}  (DART 공시)`);
  }

  lines.push(`→ 재무 섹션에 이 수치들을 사용하고 (DART 공시) 출처를 명시하세요.`);

  const contextText = lines.join('\n');
  const expiresAt   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('financial_cache')
    .upsert(
      {
        company_name: stockCode,
        source:       'DART',
        context_text: contextText,
        raw_dart:     rawDart,
        expires_at:   expiresAt,
      },
      { onConflict: 'company_name' },
    );

  if (error) {
    console.log(`진행 중 [${idx}/${total}] ${corpName} — 실패 (DB: ${error.message})`);
    return { ok: false, hasCfs };
  }

  const cfsIcon = hasCfs ? '✅' : '❌';
  const ofsIcon = ofs    ? '✅' : '❌';
  console.log(`진행 중 [${idx}/${total}] ${corpName} — CFS${cfsIcon} OFS${ofsIcon} 저장 완료`);
  return { ok: true, hasCfs };
}

async function main() {
  console.log('[dartBatchPrecompute] 시작...');

  console.log('[dartBatchPrecompute] corp_master에서 상장기업 목록 로딩 중...');
  const PAGE_SIZE = 1000;
  const companies: any[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: dbErr } = await supabase
      .from('corp_master')
      .select('corp_code, corp_name, stock_code, market')
      .not('stock_code', 'is', null)
      .order('corp_name')
      .range(from, to);
    if (dbErr) throw new Error(`corp_master 조회 실패 (page ${page}): ${dbErr.message}`);
    if (!data || data.length === 0) break;
    companies.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`[dartBatchPrecompute] corp_master 로드 완료 — ${companies.length}개`);

  if (companies.length < 100) {
    console.warn(
      `[dartBatchPrecompute] ⚠️  corp_master 상장기업 ${companies.length}개 — 데이터가 적습니다.` +
      ` corp_master를 먼저 DART corpCode.xml로 동기화하세요.`,
    );
  }

  // market 컬럼에 데이터 있으면 코스피(Y)+코스닥(K)만, 없으면 전체 처리
  const hasMarketData = companies.some((c: any) => c.market != null);
  const targets = hasMarketData
    ? companies.filter((c: any) => c.market === 'Y' || c.market === 'K')
    : companies;

  console.log(
    `[dartBatchPrecompute] ${targets.length}개 기업 처리 시작` +
    (hasMarketData ? ' (코스피+코스닥 필터 적용)' : ' (market 컬럼 미분류 — 전체 처리, 코넥스 포함 가능)'),
  );

  let success    = 0;
  let failure    = 0;
  let cfsCount   = 0;
  let ofsOnly    = 0;
  const startAt  = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const c = targets[i] as { corp_code: string; corp_name: string; stock_code: string };
    const { ok, hasCfs } = await processCompany(
      i + 1,
      targets.length,
      c.corp_code,
      c.corp_name,
      c.stock_code,
    );

    if (ok) {
      success++;
      if (hasCfs) cfsCount++; else ofsOnly++;
    } else {
      failure++;
    }
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(
    `\n성공 ${success} / 실패 ${failure} / CFS보유 ${cfsCount} / OFS only ${ofsOnly} / 소요시간 ${mins}분`,
  );
}

main().catch(err => {
  console.error('[dartBatchPrecompute] Fatal:', err.message);
  process.exit(1);
});

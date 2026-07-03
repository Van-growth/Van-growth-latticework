// Russell 1000 기업의 EDGAR Company Facts를 배치로 수집해 financial_cache에 저장.
// 실행: npx ts-node server/scripts/edgarBatchPrecompute.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const EDGAR_HEADERS = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };
const DELAY_MS      = 300;
const RETRY_WAIT_MS = 10_000;
const MAX_RETRIES   = 3;
const BATCH_LIMIT   = Infinity; // 전체 처리

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchEdgar(url: string, attempt = 0): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS });
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) return null;
      console.log(`  [429] 10초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_WAIT_MS);
      return fetchEdgar(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (attempt >= MAX_RETRIES) return null;
    await sleep(RETRY_WAIT_MS);
    return fetchEdgar(url, attempt + 1);
  }
}

// 10-K 연간 데이터만 추출. 같은 회계연도 중복 시 최신 end 날짜 기준 유지. 최대 4개년.
function extractAnnual(
  units: Array<{ form: string; fp?: string; fy?: number; end: string; val: number }> | undefined,
): Array<{ year: string; val: number }> {
  if (!units) return [];

  const byYear = new Map<string, { val: number; end: string }>();
  for (const u of units) {
    if (u.form !== '10-K') continue;
    if (u.fp && u.fp !== 'FY') continue;
    if (u.val == null) continue;
    const fy = u.fy ? String(u.fy) : u.end?.slice(0, 4);
    if (!fy) continue;
    const cur = byYear.get(fy);
    if (!cur || u.end > cur.end) byYear.set(fy, { val: u.val, end: u.end });
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 4)
    .map(([year, { val }]) => ({ year, val }));
}

function pickConcept(
  usGaap: Record<string, any>,
  ...names: string[]
): Array<{ year: string; val: number }> {
  for (const name of names) {
    const concept = usGaap[name];
    if (!concept) continue;
    const units: any[] | undefined =
      concept.units?.USD ??
      concept.units?.['USD/shares'] ??
      concept.units?.shares;
    const result = extractAnnual(units);
    if (result.length > 0) return result;
  }
  return [];
}

function fmtUsd(val: number | null): string {
  if (val == null) return '확인 필요';
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  return abs >= 1_000_000_000
    ? `${sign}${(abs / 1_000_000_000).toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

async function processCompany(
  idx: number,
  total: number,
  cikNum: number,
  ticker: string,
): Promise<boolean> {
  const cikPad = String(cikNum).padStart(10, '0');
  const data   = await fetchEdgar(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cikPad}.json`,
  );

  if (!data?.facts?.['us-gaap']) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (us-gaap 데이터 없음)`);
    return false;
  }

  const g = data.facts['us-gaap'] as Record<string, any>;

  const revData  = pickConcept(g,
    'Revenues',
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'SalesRevenueNet',
  );
  const niData   = pickConcept(g, 'NetIncomeLoss', 'ProfitLoss');
  const oiData   = pickConcept(g, 'OperatingIncomeLoss');
  const aData    = pickConcept(g, 'Assets');
  const lData    = pickConcept(g, 'Liabilities');
  const eqData   = pickConcept(g,
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  );
  const epsData  = pickConcept(g, 'EarningsPerShareBasic');

  // 회계연도 기준: 매출 우선, 없으면 순이익
  const fiscalYears = revData.length > 0
    ? revData.map(d => d.year)
    : niData.map(d => d.year);

  if (fiscalYears.length === 0) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (재무 수치 없음)`);
    return false;
  }

  const align = (series: Array<{ year: string; val: number }>) => {
    const m = new Map(series.map(d => [d.year, d.val]));
    return fiscalYears.map(y => m.get(y) ?? null);
  };

  const revenue         = align(revData);
  const netIncome       = align(niData);
  const operatingIncome = align(oiData);
  const assets          = align(aData);
  const liabilities     = align(lData);
  const equity          = align(eqData);
  const eps             = align(epsData);

  const rawEdgar = {
    ticker,
    cik: `CIK${cikPad}`,
    revenue,
    netIncome,
    operatingIncome,
    assets,
    liabilities,
    equity,
    eps,
    fiscalYears,
    filedAt: new Date().toISOString(),
    source: 'EDGAR',
  };

  // Claude 프롬프트에서 읽을 수 있는 context_text도 같이 저장 (기존 financialContext.ts 호환)
  const lines = [
    `=== SEC EDGAR 재무 데이터 (배치 프리컴퓨트) ===`,
    `기업: ${data.entityName ?? ticker}  (CIK: CIK${cikPad}  ticker: ${ticker})`,
    ``,
    `[${fiscalYears[0]} 손익계산서]`,
    `· Revenue          ${fmtUsd(revenue[0])}  (EDGAR)`,
    `· Operating Income ${fmtUsd(operatingIncome[0])}  (EDGAR)`,
    `· Net Income       ${fmtUsd(netIncome[0])}  (EDGAR)`,
    ``,
    `[재무상태표]`,
    `· Total Assets     ${fmtUsd(assets[0])}  (EDGAR)`,
    `· Total Liab.      ${fmtUsd(liabilities[0])}  (EDGAR)`,
    `· Stockholders Eq. ${fmtUsd(equity[0])}  (EDGAR)`,
  ];
  if (fiscalYears.length > 1) {
    lines.push(``, `[다년도 매출 추이]`);
    fiscalYears.forEach((fy, i) => lines.push(`· ${fy}: ${fmtUsd(revenue[i])}`));
  }
  lines.push(`→ 재무 섹션에 이 수치들을 사용하고 (EDGAR) 출처를 명시하세요.`);

  const contextText = lines.join('\n');
  const expiresAt   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('financial_cache')
    .upsert(
      {
        company_name: ticker,
        source:       'EDGAR',
        context_text: contextText,
        raw_edgar:    rawEdgar,
        expires_at:   expiresAt,
      },
      { onConflict: 'company_name' },
    );

  if (error) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (DB: ${error.message})`);
    return false;
  }

  console.log(`진행 중 [${idx}/${total}] ${ticker} — 저장 완료`);
  return true;
}

async function main() {
  console.log('[edgarBatchPrecompute] 시작...');

  console.log('[edgarBatchPrecompute] SEC EDGAR 티커 목록 로딩 중...');
  const tickersJson = await fetchEdgar('https://www.sec.gov/files/company_tickers.json');
  if (!tickersJson) throw new Error('company_tickers.json 로드 실패');

  // SEC company_tickers.json: { "0": { cik_str, ticker, title }, ... }
  // 상위 BATCH_LIMIT개를 처리 (file entry 순서 기준)
  const companies = (
    Object.values(tickersJson) as Array<{ cik_str: number; ticker: string; title: string }>
  )
    .filter(e => e.cik_str && e.ticker)
    .slice(0, isFinite(BATCH_LIMIT) ? BATCH_LIMIT : undefined);

  console.log(`[edgarBatchPrecompute] ${companies.length}개 기업 처리 시작\n`);

  let success = 0;
  let failure = 0;
  const startAt = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const { cik_str, ticker } = companies[i];
    const ok = await processCompany(i + 1, companies.length, cik_str, ticker);
    if (ok) success++; else failure++;
    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(`\n성공 ${success} / 실패 ${failure} / 소요시간 ${mins}분`);
}

main().catch(err => {
  console.error('[edgarBatchPrecompute] Fatal:', err.message);
  process.exit(1);
});

// DART (금융감독원 전자공시시스템) API client
import { supabase } from './supabase';

const BASE = 'https://opendart.fss.or.kr/api';

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface DartCompanyRow { corp_code: string; corp_name: string }
interface DartDisclosureRow { report_nm: string; rcept_dt: string; flr_nm: string }
interface DartFinRow { fs_div: string; account_nm: string; thstrm_amount: string }

export interface DartFinSeries {
  revenue:         (number | null)[];
  operatingIncome: (number | null)[];
  netIncome:       (number | null)[];
  assets:          (number | null)[];
  liabilities:     (number | null)[];
  equity:          (number | null)[];
  fiscalYears:     string[];
}

export interface DartRawSeries {
  ticker: string | null;
  corp_code: string;
  corp_name: string;
  cfs: DartFinSeries | null;
  ofs: DartFinSeries | null;
  currency: 'KRW';
  source: 'DART';
}

export interface DartTriggerEvent {
  date: string;
  reportName: string;
}

export interface DartData {
  corpCode: string;
  corpName: string;
  stockCode: string | null;
  disclosures: Array<{ report_nm: string; rcept_dt: string; flr_nm: string }>;
  financials: { year?: string; revenue?: string; operatingProfit?: string; netIncome?: string };
  // 최근 사업보고서 최대 5개년 CFS(연결)/OFS(별도) 시계열 — buildFinancialsV2FromRaw 등에서 사용
  rawSeries?: DartRawSeries;
  // 최근 12개월 이내 주요사항보고서(B001) — 유상증자/M&A 등 트리거 이벤트 후보. report_nm 자체가
  // "유상증자결정"·"타법인주식및출자증권취득결정" 등 사건 유형을 담고 있어 본문 조회 없이도 신호로 사용 가능.
  triggerEvents?: DartTriggerEvent[];
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
    const row = list.find((r) => r.fs_div === fsDiv && r.account_nm === alias);
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
  return Object.values(s).some((v) => v !== null);
}

function buildSeries(yearMap: Map<string, YearSlice>, years: string[]): DartFinSeries | null {
  const present = years.filter((y) => yearMap.has(y));
  if (present.length === 0) return null;
  return {
    revenue:         present.map((y) => yearMap.get(y)!.revenue),
    operatingIncome: present.map((y) => yearMap.get(y)!.operatingIncome),
    netIncome:       present.map((y) => yearMap.get(y)!.netIncome),
    assets:          present.map((y) => yearMap.get(y)!.assets),
    liabilities:     present.map((y) => yearMap.get(y)!.liabilities),
    equity:          present.map((y) => yearMap.get(y)!.equity),
    fiscalYears:     present,
  };
}

// 최근 5개년 CFS(연결)/OFS(별도) 재무제표를 병렬 조회 (fs_div 없이 호출하면 CFS+OFS 동시 반환)
async function fetchMultiYearSeries(
  corpCode: string,
  key: string,
): Promise<{ cfs: DartFinSeries | null; ofs: DartFinSeries | null }> {
  const currentYear = new Date().getFullYear();
  const YEARS = [currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4, currentYear - 5].map(String);

  const cfsMap = new Map<string, YearSlice>();
  const ofsMap = new Map<string, YearSlice>();

  await Promise.allSettled(
    YEARS.map(async (year) => {
      const url =
        `${BASE}/fnlttSinglAcnt.json?crtfc_key=${encodeURIComponent(key)}` +
        `&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011`;
      const res = await fetchJson<{ status: string; list?: DartFinRow[] }>(url);
      if (res?.status !== '000' || !res.list?.length) return;

      const cfsSlice = extractSlice(res.list, 'CFS');
      const ofsSlice = extractSlice(res.list, 'OFS');
      if (hasData(cfsSlice)) cfsMap.set(year, cfsSlice);
      if (hasData(ofsSlice)) ofsMap.set(year, ofsSlice);
    }),
  );

  return { cfs: buildSeries(cfsMap, YEARS), ofs: buildSeries(ofsMap, YEARS) };
}

async function fetchDisclosures(corpCode: string, key: string): Promise<DartData['disclosures']> {
  const bgn_de = `${new Date().getFullYear() - 1}0101`;
  const disclosures: DartData['disclosures'] = [];

  await Promise.allSettled(
    ['A001', 'A002', 'F001'].map(async (type) => {
      const url =
        `${BASE}/list.json?crtfc_key=${encodeURIComponent(key)}` +
        `&corp_code=${corpCode}&bgn_de=${bgn_de}&pblntf_ty=${type}&page_count=3`;
      const res = await fetchJson<{ status: string; list?: DartDisclosureRow[] }>(url);
      if (res?.status === '000' && res.list) {
        disclosures.push(
          ...res.list.slice(0, 2).map((d) => ({
            report_nm: d.report_nm,
            rcept_dt:  d.rcept_dt,
            flr_nm:    d.flr_nm,
          })),
        );
      }
    }),
  );

  return disclosures;
}

// 주요사항보고서(B001) — 유상증자/M&A/자산양수도 등 트리거 이벤트가 여기서 공시됨.
// fetchDisclosures의 정기공시(A001/A002/F001)와는 별도 조회 — 최근 목록에 밀려나지 않도록 분리.
async function fetchTriggerEvents(corpCode: string, key: string): Promise<DartTriggerEvent[]> {
  const bgn_de = `${new Date().getFullYear() - 1}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}`;
  const url =
    `${BASE}/list.json?crtfc_key=${encodeURIComponent(key)}` +
    `&corp_code=${corpCode}&bgn_de=${bgn_de}&pblntf_ty=B001&page_count=5`;
  const res = await fetchJson<{ status: string; list?: DartDisclosureRow[] }>(url);
  if (res?.status !== '000' || !res.list) return [];
  return res.list.slice(0, 5).map((d) => ({ date: d.rcept_dt, reportName: d.report_nm }));
}

// ── corp_master 우선 조회 → API 폴백 ─────────────────────────────────────────

async function lookupCorpCode(
  name: string,
  key: string,
): Promise<{ corpCode: string; corpName: string; stockCode: string | null } | null> {
  // 1. 마스터 테이블 — exact
  {
    const { data } = await supabase
      .from('corp_master')
      .select('corp_code, corp_name, stock_code')
      .eq('corp_name', name)
      .maybeSingle();
    if (data) return { corpCode: data.corp_code, corpName: data.corp_name, stockCode: data.stock_code ?? null };
  }

  // 2. 마스터 테이블 — starts-with
  {
    const { data } = await supabase
      .from('corp_master')
      .select('corp_code, corp_name, stock_code')
      .ilike('corp_name', `${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) return { corpCode: data.corp_code, corpName: data.corp_name, stockCode: data.stock_code ?? null };
  }

  // 3. 마스터 테이블 — contains
  {
    const { data } = await supabase
      .from('corp_master')
      .select('corp_code, corp_name, stock_code')
      .ilike('corp_name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) return { corpCode: data.corp_code, corpName: data.corp_name, stockCode: data.stock_code ?? null };
  }

  // 4. DART API 검색 폴백
  const url =
    `${BASE}/company.json?crtfc_key=${encodeURIComponent(key)}` +
    `&corp_name=${encodeURIComponent(name)}`;
  const res = await fetchJson<{ status: string; list?: DartCompanyRow[] }>(url);
  if (res?.status !== '000' || !res.list?.length) return null;

  // API 결과를 마스터 테이블에 캐시
  const best = res.list[0];
  await supabase.from('corp_master').upsert({
    corp_code:  best.corp_code,
    corp_name:  best.corp_name,
    stock_code: null,
  }, { onConflict: 'corp_code' });

  return { corpCode: best.corp_code, corpName: best.corp_name, stockCode: null };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchDartData(companyName: string): Promise<DartData | null> {
  const key = process.env.DART_API_KEY;
  if (!key) return null;

  const corp = await lookupCorpCode(companyName, key);
  if (!corp) return null;

  const { corpCode, corpName, stockCode } = corp;

  // 최근 공시 목록 + 최근 4개년 재무 시계열 + 트리거 이벤트(주요사항보고서) 병렬 조회
  const [disclosuresResult, seriesResult, triggerResult] = await Promise.allSettled([
    fetchDisclosures(corpCode, key),
    fetchMultiYearSeries(corpCode, key),
    fetchTriggerEvents(corpCode, key),
  ]);

  const disclosures = disclosuresResult.status === 'fulfilled' ? disclosuresResult.value : [];
  const { cfs, ofs } =
    seriesResult.status === 'fulfilled' ? seriesResult.value : { cfs: null, ofs: null };
  const triggerEvents = triggerResult.status === 'fulfilled' ? triggerResult.value : [];

  // 연결(CFS) 우선, 없으면 별도(OFS) — 최신연도 단일값은 기존 narrative(financials) 호환용
  const primary = cfs ?? ofs;
  let financials: DartData['financials'] = {};
  if (primary && primary.fiscalYears.length > 0) {
    financials = {
      year:            primary.fiscalYears[0],
      revenue:         primary.revenue[0]         != null ? String(primary.revenue[0])         : undefined,
      operatingProfit: primary.operatingIncome[0]  != null ? String(primary.operatingIncome[0]) : undefined,
      netIncome:       primary.netIncome[0]        != null ? String(primary.netIncome[0])       : undefined,
    };
  }

  const rawSeries: DartRawSeries | undefined =
    cfs || ofs
      ? { ticker: stockCode, corp_code: corpCode, corp_name: corpName, cfs, ofs, currency: 'KRW', source: 'DART' }
      : undefined;

  return { corpCode, corpName, stockCode, disclosures, financials, rawSeries, triggerEvents: triggerEvents.length > 0 ? triggerEvents : undefined };
}

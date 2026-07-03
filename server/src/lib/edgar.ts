// SEC EDGAR API client
import { supabase } from './supabase';

const EDGAR_HEADERS = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SubmissionsData {
  name: string;
  filings: { recent: { form: string[]; filingDate: string[] } };
}

interface XbrlUnit { form: string; fp?: string; fy?: number; val: number; end: string }
export interface XbrlAnnualPoint { year: string; val: number }

export interface EdgarRawSeries {
  ticker: string | null;
  cik: string;
  revenue: (number | null)[];
  netIncome: (number | null)[];
  operatingIncome: (number | null)[];
  assets: (number | null)[];
  liabilities: (number | null)[];
  equity: (number | null)[];
  eps: (number | null)[];
  fiscalYears: string[];
  filedAt: string;
  source: 'EDGAR';
}

export interface EdgarData {
  cik: string;
  companyName: string;
  ticker: string | null;
  filings: Array<{ form: string; filingDate: string }>;
  financials: {
    year?: string;
    revenue?: string;
    grossProfit?: string;
    operatingIncome?: string;
    netIncome?: string;
    ebitda?: string;
    totalAssets?: string;
    totalLiabilities?: string;
    totalEquity?: string;
    cash?: string;
    operatingCF?: string;
    investingCF?: string;
    financingCF?: string;
  };
  // 최근 10-K/20-F 최대 4개년 시계열 (fiscalYears[0]이 최신) — buildFinancialsV2FromRaw 등에서 사용
  rawSeries?: EdgarRawSeries;
}

// ── cik_master 우선 조회 → EFTS 폴백 ─────────────────────────────────────────

async function lookupCik(
  name: string,
): Promise<{ cik: string; name: string; ticker: string | null } | null> {
  const norm = name.toUpperCase();

  // 1. 마스터 테이블 — ticker 일치
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('ticker', norm)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (ticker) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 2. 마스터 테이블 — exact name
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', name)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (exact) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 3. 마스터 테이블 — starts-with
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (startsWith) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 4. 마스터 테이블 — contains
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (contains) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 5. EFTS 검색 폴백
  console.log(`[edgar] CIK not in cik_master, trying EFTS search for "${name}"`);
  const q = encodeURIComponent(`"${name}"`);
  const searchRes = await fetchJson<{ hits: { hits: Array<{ _source: { entity_name?: string; entity_id?: string } }> } }>(
    `https://efts.sec.gov/LATEST/search-index?q=${q}&dateRange=custom&startdt=2015-01-01&forms=10-K,20-F`,
  );
  const hit = searchRes?.hits?.hits?.[0];
  if (!hit?._source.entity_id) {
    console.log(`[edgar] CIK MISS for "${name}" — EFTS no result`);
    return null;
  }

  const cik  = hit._source.entity_id.padStart(10, '0');
  const hname = hit._source.entity_name ?? name;
  console.log(`[edgar] CIK lookup HIT (EFTS) "${name}" → ${cik} ${hname}`);

  await supabase.from('cik_master').upsert(
    { cik, name: hname, ticker: null },
    { onConflict: 'cik' },
  );

  return { cik, name: hname, ticker: null };
}

// ── XBRL helpers ─────────────────────────────────────────────────────────────

function fmtUsd(val: number): string {
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  const b    = abs / 1_000_000_000;
  return b >= 1
    ? `${sign}${b.toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

// 10-K/20-F 연간 데이터만 추출. 같은 회계연도 중복 시 최신 end 날짜 기준 유지. 최대 4개년(최신순).
export function extractAnnualSeries(units: XbrlUnit[] | undefined): XbrlAnnualPoint[] {
  if (!units) return [];

  const byYear = new Map<string, { val: number; end: string }>();
  for (const u of units) {
    if (!['10-K', '20-F'].includes(u.form)) continue;
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

export function pickConceptSeries(
  usGaap: Record<string, any>,
  ...names: string[]
): XbrlAnnualPoint[] {
  for (const name of names) {
    const concept = usGaap[name];
    if (!concept) continue;
    const units: XbrlUnit[] | undefined =
      concept.units?.USD ??
      concept.units?.['USD/shares'] ??
      concept.units?.shares;
    const result = extractAnnualSeries(units);
    if (result.length > 0) return result;
  }
  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

// cik_master DB 전용 조회 (EFTS API 없음 — 빠름, financial_cache 선체크용)
export async function lookupCikByName(
  name: string,
): Promise<{ cik: string; ticker: string | null } | null> {
  const norm = name.toUpperCase();
  const sel = 'cik, ticker';

  { const { data } = await supabase.from('cik_master').select(sel).ilike('ticker', norm).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', name).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', `${name}%`).limit(1).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', `%${name}%`).limit(1).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  return null;
}

export async function fetchEdgarData(companyName: string): Promise<EdgarData | null> {
  console.log(`[edgar] fetchEdgarData start: "${companyName}"`);
  const found = await lookupCik(companyName);
  if (!found) {
    console.log(`[edgar] fetchEdgarData MISS (no CIK): "${companyName}"`);
    return null;
  }

  const { cik, name: entityName, ticker } = found;
  console.log(`[edgar] fetching submissions + companyfacts for CIK ${cik} (${entityName})`);

  // 최근 공시 + XBRL 전체 팩트(다년도 포함) 병렬 조회
  const [subRes, factsRes] = await Promise.all([
    fetchJson<SubmissionsData>(`https://data.sec.gov/submissions/CIK${cik}.json`),
    fetchJson<{ facts?: { 'us-gaap'?: Record<string, any> } }>(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    ),
  ]);

  if (!subRes) {
    console.log(`[edgar] submissions fetch FAILED for CIK ${cik}`);
    return null;
  }

  const filings: EdgarData['filings'] = [];
  const targets = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K']);
  const recent  = subRes.filings.recent;

  for (let i = 0; i < Math.min(recent.form?.length ?? 0, 100); i++) {
    if (targets.has(recent.form[i])) {
      filings.push({ form: recent.form[i], filingDate: recent.filingDate[i] });
      if (filings.length >= 6) break;
    }
  }

  const gaap = factsRes?.facts?.['us-gaap'];
  const financials: EdgarData['financials'] = {};
  let rawSeries: EdgarRawSeries | undefined;

  if (gaap) {
    const revData  = pickConceptSeries(gaap, 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet');
    const gpData   = pickConceptSeries(gaap, 'GrossProfit');
    const oiData   = pickConceptSeries(gaap, 'OperatingIncomeLoss');
    const niData   = pickConceptSeries(gaap, 'NetIncomeLoss', 'ProfitLoss');
    const aData    = pickConceptSeries(gaap, 'Assets');
    const lData    = pickConceptSeries(gaap, 'Liabilities');
    const eqData   = pickConceptSeries(gaap, 'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest');
    const cashData = pickConceptSeries(gaap, 'CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments');
    const opCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInOperatingActivities');
    const invCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInInvestingActivities');
    const finCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInFinancingActivities');
    const daData   = pickConceptSeries(gaap, 'DepreciationDepletionAndAmortization', 'DepreciationAndAmortization');
    const epsData  = pickConceptSeries(gaap, 'EarningsPerShareBasic');

    // 최신 연도 단일값 — 기존 narrative(financials) 호환용
    const latest = (d: XbrlAnnualPoint[]) => d[0] ?? null;
    const rev = latest(revData), gp = latest(gpData), oi = latest(oiData), ni = latest(niData);
    const as_ = latest(aData), li = latest(lData), eq = latest(eqData), ca = latest(cashData);
    const ocf = latest(opCFData), icf = latest(invCFData), fcf = latest(finCFData), da = latest(daData);

    if (rev) { financials.revenue = fmtUsd(rev.val); financials.year = rev.year; }
    if (gp)  { financials.grossProfit = fmtUsd(gp.val); financials.year ??= gp.year; }
    if (oi)  { financials.operatingIncome = fmtUsd(oi.val); financials.year ??= oi.year; }
    if (ni)  { financials.netIncome = fmtUsd(ni.val); financials.year ??= ni.year; }
    if (oi && da) financials.ebitda = fmtUsd(oi.val + da.val);
    if (as_) financials.totalAssets = fmtUsd(as_.val);
    if (li)  financials.totalLiabilities = fmtUsd(li.val);
    if (eq)  financials.totalEquity = fmtUsd(eq.val);
    if (ca)  financials.cash = fmtUsd(ca.val);
    if (ocf) financials.operatingCF = fmtUsd(ocf.val);
    if (icf) financials.investingCF = fmtUsd(icf.val);
    if (fcf) financials.financingCF = fmtUsd(fcf.val);

    // 다년도 시계열 (최대 4개년, 매출 기준 회계연도 정렬 — 없으면 순이익 기준)
    const fiscalYears = revData.length > 0 ? revData.map(d => d.year) : niData.map(d => d.year);
    if (fiscalYears.length > 0) {
      const align = (series: XbrlAnnualPoint[]) => {
        const m = new Map(series.map(d => [d.year, d.val]));
        return fiscalYears.map(y => m.get(y) ?? null);
      };
      rawSeries = {
        ticker,
        cik: `CIK${cik}`,
        revenue: align(revData),
        netIncome: align(niData),
        operatingIncome: align(oiData),
        assets: align(aData),
        liabilities: align(lData),
        equity: align(eqData),
        eps: align(epsData),
        fiscalYears,
        filedAt: new Date().toISOString(),
        source: 'EDGAR',
      };
    }
  }

  console.log(`[edgar] XBRL result for "${companyName}" (CIK ${cik}): rev=${financials.revenue ?? 'null'} opInc=${financials.operatingIncome ?? 'null'} netInc=${financials.netIncome ?? 'null'} year=${financials.year ?? 'null'} years=${rawSeries?.fiscalYears.length ?? 0}`);

  return { cik, companyName: entityName, ticker, filings, financials, rawSeries };
}

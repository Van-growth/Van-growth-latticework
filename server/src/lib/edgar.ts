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

interface XbrlUnit { form: string; val: number; end: string }

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

async function getLatestXbrlValue(
  cik: string,
  concepts: string[],
): Promise<{ value: string; year: string; raw: number } | null> {
  const candidates: Array<{ val: number; end: string }> = [];

  await Promise.allSettled(
    concepts.map(async (concept) => {
      const res = await fetchJson<{ units?: { USD?: XbrlUnit[] } }>(
        `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`,
        12_000,
      );
      const units = res?.units?.USD;
      if (!units) return;
      const annual = units
        .filter((u) => ['10-K', '20-F'].includes(u.form) && u.val !== 0)
        .sort((a, b) => b.end.localeCompare(a.end));
      if (annual[0]) candidates.push(annual[0]);
    }),
  );

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.end.localeCompare(a.end));
  const v = candidates[0];
  return { value: fmtUsd(v.val), year: v.end.slice(0, 4), raw: v.val };
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
  console.log(`[edgar] fetching submissions for CIK ${cik} (${entityName})`);

  // 최근 공시
  const subRes = await fetchJson<SubmissionsData>(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
  );
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

  // XBRL 재무 — 모든 항목 병렬 조회
  const [
    revenueRes, grossProfitRes, opIncomeRes, netIncomeRes,
    assetsRes, liabRes, equityRes, cashRes,
    opCFRes, invCFRes, finCFRes, daRes,
  ] = await Promise.allSettled([
    getLatestXbrlValue(cik, [
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
    ]),
    getLatestXbrlValue(cik, ['GrossProfit']),
    getLatestXbrlValue(cik, ['OperatingIncomeLoss']),
    getLatestXbrlValue(cik, ['NetIncomeLoss', 'ProfitLoss']),
    getLatestXbrlValue(cik, ['Assets']),
    getLatestXbrlValue(cik, ['Liabilities']),
    getLatestXbrlValue(cik, [
      'StockholdersEquity',
      'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
    ]),
    getLatestXbrlValue(cik, [
      'CashAndCashEquivalentsAtCarryingValue',
      'CashCashEquivalentsAndShortTermInvestments',
    ]),
    getLatestXbrlValue(cik, ['NetCashProvidedByUsedInOperatingActivities']),
    getLatestXbrlValue(cik, ['NetCashProvidedByUsedInInvestingActivities']),
    getLatestXbrlValue(cik, ['NetCashProvidedByUsedInFinancingActivities']),
    getLatestXbrlValue(cik, [
      'DepreciationDepletionAndAmortization',
      'DepreciationAndAmortization',
    ]),
  ]);

  const get = <T>(r: PromiseSettledResult<T>) =>
    r.status === 'fulfilled' ? r.value : null;

  const revenue       = get(revenueRes);
  const grossProfit   = get(grossProfitRes);
  const opIncome      = get(opIncomeRes);
  const netIncome     = get(netIncomeRes);
  const assets        = get(assetsRes);
  const liab          = get(liabRes);
  const equity        = get(equityRes);
  const cash          = get(cashRes);
  const opCF          = get(opCFRes);
  const invCF         = get(invCFRes);
  const finCF         = get(finCFRes);
  const da            = get(daRes);

  // EBITDA: OperatingIncome + D&A 계산
  let ebitda: string | undefined;
  if (opIncome?.raw != null && da?.raw != null) {
    ebitda = fmtUsd(opIncome.raw + da.raw);
  }

  const financials: EdgarData['financials'] = {};
  if (revenue)      { financials.revenue = revenue.value;             financials.year = revenue.year; }
  if (grossProfit)  { financials.grossProfit = grossProfit.value;     financials.year ??= grossProfit.year; }
  if (opIncome)     { financials.operatingIncome = opIncome.value;    financials.year ??= opIncome.year; }
  if (netIncome)    { financials.netIncome = netIncome.value;         financials.year ??= netIncome.year; }
  if (ebitda)         financials.ebitda = ebitda;
  if (assets)         financials.totalAssets = assets.value;
  if (liab)           financials.totalLiabilities = liab.value;
  if (equity)         financials.totalEquity = equity.value;
  if (cash)           financials.cash = cash.value;
  if (opCF)           financials.operatingCF = opCF.value;
  if (invCF)          financials.investingCF = invCF.value;
  if (finCF)          financials.financingCF = finCF.value;

  console.log(`[edgar] XBRL result for "${companyName}" (CIK ${cik}): rev=${revenue?.value ?? 'null'} opInc=${opIncome?.value ?? 'null'} netInc=${netIncome?.value ?? 'null'} year=${financials.year ?? 'null'}`);

  return { cik, companyName: entityName, ticker, filings, financials };
}

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
  financials: { year?: string; revenue?: string; operatingIncome?: string; netIncome?: string };
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
    if (data) return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
  }

  // 2. 마스터 테이블 — exact name
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', name)
      .maybeSingle();
    if (data) return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
  }

  // 3. 마스터 테이블 — starts-with
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
  }

  // 4. 마스터 테이블 — contains
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
  }

  // 5. EFTS 검색 폴백
  const q = encodeURIComponent(`"${name}"`);
  const searchRes = await fetchJson<{ hits: { hits: Array<{ _source: { entity_name?: string; entity_id?: string } }> } }>(
    `https://efts.sec.gov/LATEST/search-index?q=${q}&dateRange=custom&startdt=2015-01-01&forms=10-K,20-F`,
  );
  const hit = searchRes?.hits?.hits?.[0];
  if (!hit?._source.entity_id) return null;

  const cik  = hit._source.entity_id.padStart(10, '0');
  const hname = hit._source.entity_name ?? name;

  // 캐시
  await supabase.from('cik_master').upsert(
    { cik, name: hname, ticker: null },
    { onConflict: 'cik' },
  );

  return { cik, name: hname, ticker: null };
}

// ── XBRL helpers ─────────────────────────────────────────────────────────────

async function getLatestXbrlValue(
  cik: string,
  concepts: string[],
): Promise<{ value: string; year: string } | null> {
  for (const concept of concepts) {
    const res = await fetchJson<{ units?: { USD?: XbrlUnit[] } }>(
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`,
      12_000,
    );
    const units = res?.units?.USD;
    if (!units) continue;

    const annual = units
      .filter((u) => ['10-K', '20-F'].includes(u.form) && u.val > 0)
      .sort((a, b) => b.end.localeCompare(a.end));

    if (annual.length) {
      const v = annual[0];
      const b = v.val / 1_000_000_000;
      return {
        value: b >= 1 ? `${b.toFixed(1)}B USD` : `${(v.val / 1_000_000).toFixed(0)}M USD`,
        year:  v.end.slice(0, 4),
      };
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchEdgarData(companyName: string): Promise<EdgarData | null> {
  const found = await lookupCik(companyName);
  if (!found) return null;

  const { cik, name: entityName, ticker } = found;

  // 최근 공시
  const subRes = await fetchJson<SubmissionsData>(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
  );
  if (!subRes) return null;

  const filings: EdgarData['filings'] = [];
  const targets = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K']);
  const recent  = subRes.filings.recent;

  for (let i = 0; i < Math.min(recent.form?.length ?? 0, 100); i++) {
    if (targets.has(recent.form[i])) {
      filings.push({ form: recent.form[i], filingDate: recent.filingDate[i] });
      if (filings.length >= 6) break;
    }
  }

  // XBRL 재무
  const [revenueRes, opRes, netRes] = await Promise.allSettled([
    getLatestXbrlValue(cik, [
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
    ]),
    getLatestXbrlValue(cik, ['OperatingIncomeLoss']),
    getLatestXbrlValue(cik, ['NetIncomeLoss', 'ProfitLoss']),
  ]);

  const financials: EdgarData['financials'] = {};
  if (revenueRes.status === 'fulfilled' && revenueRes.value) {
    financials.revenue = revenueRes.value.value;
    financials.year    = revenueRes.value.year;
  }
  if (opRes.status === 'fulfilled' && opRes.value) {
    financials.operatingIncome = opRes.value.value;
    financials.year ??= opRes.value.year;
  }
  if (netRes.status === 'fulfilled' && netRes.value) {
    financials.netIncome = netRes.value.value;
    financials.year ??= netRes.value.year;
  }

  return { cik, companyName: entityName, ticker, filings, financials };
}

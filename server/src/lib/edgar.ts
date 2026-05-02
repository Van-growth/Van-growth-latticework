// SEC EDGAR API client (no API key required)
// https://www.sec.gov/developer

const EDGAR_HEADERS = { 'User-Agent': 'Ben sg.van.p@gmail.com' };

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

interface EftsHit {
  _source: { entity_name?: string; entity_id?: string };
}

interface SubmissionsData {
  name: string;
  filings: { recent: { form: string[]; filingDate: string[] } };
}

interface XbrlUnit {
  form: string;
  val: number;
  end: string;
}

export interface EdgarData {
  cik: string;
  companyName: string;
  filings: Array<{ form: string; filingDate: string }>;
  financials: { year?: string; revenue?: string; operatingIncome?: string; netIncome?: string };
}

async function getLatestXbrlValue(
  cik: string,
  concepts: string[],
): Promise<{ value: string; year: string } | null> {
  for (const concept of concepts) {
    const url =
      `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${concept}.json`;
    const res = await fetchJson<{ units?: { USD?: XbrlUnit[] } }>(url, 12_000);
    const units = res?.units?.USD;
    if (!units) continue;

    const annual = units
      .filter((u) => ['10-K', '20-F'].includes(u.form) && u.val > 0)
      .sort((a, b) => b.end.localeCompare(a.end));

    if (annual.length) {
      const v = annual[0];
      const b = v.val / 1_000_000_000;
      const formatted = b >= 1
        ? `${b.toFixed(1)}B USD`
        : `${(v.val / 1_000_000).toFixed(0)}M USD`;
      return { value: formatted, year: v.end.slice(0, 4) };
    }
  }
  return null;
}

export async function fetchEdgarData(companyName: string): Promise<EdgarData | null> {
  // 1. CIK 검색 via EFTS full-text search
  const q = encodeURIComponent(`"${companyName}"`);
  const searchUrl =
    `https://efts.sec.gov/LATEST/search-index?q=${q}` +
    `&dateRange=custom&startdt=2015-01-01&forms=10-K,20-F`;

  const searchRes = await fetchJson<{ hits: { hits: EftsHit[] } }>(searchUrl);
  const hits = searchRes?.hits?.hits;
  if (!hits?.length) return null;

  const entityId = hits[0]._source.entity_id;
  if (!entityId) return null;

  const cik = entityId.padStart(10, '0');
  const entityName = hits[0]._source.entity_name ?? companyName;

  // 2. 최근 공시 목록 (10-K, 10-Q, 8-K, 20-F, 6-K)
  const subRes = await fetchJson<SubmissionsData>(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
  );
  if (!subRes) return null;

  const filings: EdgarData['filings'] = [];
  const targets = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K']);
  const recent = subRes.filings.recent;

  for (let i = 0; i < Math.min(recent.form?.length ?? 0, 100); i++) {
    if (targets.has(recent.form[i])) {
      filings.push({ form: recent.form[i], filingDate: recent.filingDate[i] });
      if (filings.length >= 6) break;
    }
  }

  // 3. XBRL 재무 데이터 (개별 concept 엔드포인트 — 빠르고 경량)
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
    financials.year   = revenueRes.value.year;
  }
  if (opRes.status === 'fulfilled' && opRes.value) {
    financials.operatingIncome = opRes.value.value;
    financials.year ??= opRes.value.year;
  }
  if (netRes.status === 'fulfilled' && netRes.value) {
    financials.netIncome = netRes.value.value;
    financials.year ??= netRes.value.year;
  }

  return { cik, companyName: entityName, filings, financials };
}

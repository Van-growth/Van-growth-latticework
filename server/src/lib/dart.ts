// DART (금융감독원 전자공시시스템) API client
// Requires DART_API_KEY env var

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

interface DartCompanyRow {
  corp_code: string;
  corp_name: string;
}

interface DartDisclosureRow {
  report_nm: string;
  rcept_dt: string;
  flr_nm: string;
}

interface DartFinancialRow {
  account_nm: string;
  thstrm_amount: string;
}

export interface DartData {
  corpCode: string;
  corpName: string;
  disclosures: Array<{ report_nm: string; rcept_dt: string; flr_nm: string }>;
  financials: { year?: string; revenue?: string; operatingProfit?: string; netIncome?: string };
}

export async function fetchDartData(companyName: string): Promise<DartData | null> {
  const key = process.env.DART_API_KEY;
  if (!key) return null;

  // 1. corp_code 검색
  const searchUrl =
    `${BASE}/company.json?crtfc_key=${encodeURIComponent(key)}` +
    `&corp_name=${encodeURIComponent(companyName)}`;

  const searchRes = await fetchJson<{ status: string; list?: DartCompanyRow[] }>(searchUrl);
  if (searchRes?.status !== '000' || !searchRes.list?.length) return null;

  const corp = searchRes.list[0];
  const corpCode = corp.corp_code;

  // 2. 최근 공시 (사업보고서 A001, 분기보고서 A002, 주요사항보고서 F001)
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
            rcept_dt: d.rcept_dt,
            flr_nm: d.flr_nm,
          })),
        );
      }
    }),
  );

  // 3. 재무제표 (전년도 사업보고서 우선, 없으면 전전년도)
  let financials: DartData['financials'] = {};
  const currentYear = new Date().getFullYear();

  for (const bsns_year of [currentYear - 1, currentYear - 2]) {
    const url =
      `${BASE}/fnlttSinglAcnt.json?crtfc_key=${encodeURIComponent(key)}` +
      `&corp_code=${corpCode}&bsns_year=${bsns_year}&reprt_code=11011`;
    const res = await fetchJson<{ status: string; list?: DartFinancialRow[] }>(url);

    if (res?.status === '000' && res.list?.length) {
      const find = (name: string) =>
        res.list!.find((r) => r.account_nm === name)?.thstrm_amount?.replace(/,/g, '');

      const revenue = find('매출액');
      const operatingProfit = find('영업이익');
      const netIncome = find('당기순이익');

      if (revenue || operatingProfit) {
        financials = { year: String(bsns_year), revenue, operatingProfit, netIncome };
        break;
      }
    }
  }

  return { corpCode, corpName: corp.corp_name, disclosures, financials };
}

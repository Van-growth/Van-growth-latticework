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
interface DartFinancialRow  { account_nm: string; thstrm_amount: string }

export interface DartData {
  corpCode: string;
  corpName: string;
  stockCode: string | null;
  disclosures: Array<{ report_nm: string; rcept_dt: string; flr_nm: string }>;
  financials: { year?: string; revenue?: string; operatingProfit?: string; netIncome?: string };
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

  // 최근 공시 목록
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

  // 재무제표 (전년도 우선)
  let financials: DartData['financials'] = {};
  const currentYear = new Date().getFullYear();

  for (const bsns_year of [currentYear - 1, currentYear - 2]) {
    const url =
      `${BASE}/fnlttSinglAcnt.json?crtfc_key=${encodeURIComponent(key)}` +
      `&corp_code=${corpCode}&bsns_year=${bsns_year}&reprt_code=11011`;
    const res = await fetchJson<{ status: string; list?: DartFinancialRow[] }>(url);

    if (res?.status === '000' && res.list?.length) {
      const find = (nm: string) =>
        res.list!.find((r) => r.account_nm === nm)?.thstrm_amount?.replace(/,/g, '');
      const revenue        = find('매출액');
      const operatingProfit = find('영업이익');
      const netIncome      = find('당기순이익');
      if (revenue || operatingProfit) {
        financials = { year: String(bsns_year), revenue, operatingProfit, netIncome };
        break;
      }
    }
  }

  return { corpCode, corpName, stockCode, disclosures, financials };
}

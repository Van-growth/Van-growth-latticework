// DART (금융감독원 전자공시시스템) API client
import { supabase } from './supabase';
import { classifyIndustryCategory } from './industryClassification';
import { getRecentFiscalYears } from './fiscalYears';

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

// fnlttSinglAcntAll.json(전체 재무제표, 은행 템플릿 전용) 응답 행 — fnlttSinglAcnt.json
// (기존 요약 엔드포인트, DartFinRow)과 달리 account_detail/thstrm·frmtrm·bfefrmtrm_amount를
// 포함한다. account_detail이 '-'가 아니면 자본변동표 등의 세부 구성요소 breakdown 행이라
// account_nm이 중복 등장할 수 있음(실측: 신한지주 "당기순이익"이 11번 등장) — 이 필드로
// 걸러내지 않으면 잘못된 값을 집을 위험이 있다(2026-08-20 발견).
interface DartFullRow {
  sj_div: string;
  account_nm: string;
  account_detail: string;
  thstrm_amount: string;
  frmtrm_amount: string;
  bfefrmtrm_amount: string;
}

export interface DartFinSeries {
  revenue:         (number | null)[];
  operatingIncome: (number | null)[];
  netIncome:       (number | null)[];
  assets:          (number | null)[];
  liabilities:     (number | null)[];
  equity:          (number | null)[];
  fiscalYears:     string[];
}

// 은행 재무제표 템플릿(2026-08-20) 전용 — fnlttSinglAcntAll.json으로 별도 조회(기존
// fetchMultiYearSeries의 fnlttSinglAcnt.json과는 다른 엔드포인트, 은행으로 분류된 회사만
// 추가 호출). thstrm/frmtrm/bfefrmtrm이 한 응답에 최근 3개년을 담고 있어 연도별 루프가
// 필요 없다(EDGAR/기존 DART 5개년 패턴과 다름).
export interface DartBankSeries {
  fiscalYears: string[]; // [thstrm, frmtrm, bfefrmtrm] — bsns_year 기준 라벨링
  interestIncome: (number | null)[];
  interestExpense: (number | null)[];
  netInterestIncome: (number | null)[];
  provisionCreditLosses: (number | null)[];
  loansGross: (number | null)[];
  deposits: (number | null)[];
  borrowings: (number | null)[];
}

export interface DartRawSeries {
  ticker: string | null;
  corp_code: string;
  corp_name: string;
  cfs: DartFinSeries | null;
  ofs: DartFinSeries | null;
  currency: 'KRW';
  source: 'DART';
  // industryClassification.ts가 'bank'로 분류한 회사만 채워짐(그 외엔 undefined) — 실제
  // 은행 템플릿 적용 여부는 financialsTableBuilder.ts의 isGenuineBankData() 게이트가 별도 판단.
  bankSeries?: DartBankSeries;
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
  const YEARS = getRecentFiscalYears(5);

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

// 은행 손익계산서/재무상태표 핵심 계정과목 — 신한지주 실제 공시(2026-08-20 실측)로 검증한
// 라벨. 매출액/영업이익 같은 일반 alias와 달리, 기타수익/기타비용에 대응하는 단일 필드가
// K-IFRS 은행지주 CIS엔 없다(수수료손익/보험손익/유가증권손익 등으로 세분화) — 재무 파생
// 지표 처리 원칙(서버가 값을 합산·계산하지 않음)에 따라 이 두 항목은 DART 소스에서 의도적으로
// 생략한다. EDGAR(NoninterestIncome/Expense 단일 태그 존재)와의 이 비대칭은 원본 공시
// 구조 차이이지 구현 누락이 아니다.
const BANK_ALIASES_IS: Record<string, string[]> = {
  interestIncome:         ['이자수익'],
  interestExpense:        ['이자비용'],
  netInterestIncome:      ['순이자손익', '순이자이익'],
  // 공백 유무는 normalizeAccountName()이 흡수 — 여기엔 진짜 다른 단어(동의어)만 나열한다.
  provisionCreditLosses:  ['신용손실충당금전입액', '대손충당금전입액', '대손상각비'],
};
const BANK_ALIASES_BS: Record<string, string[]> = {
  loansGross:  ['상각후원가측정대출채권', '대출채권'],
  deposits:    ['예수부채', '예수금'],
  borrowings:  ['차입부채', '차입금'],
};

// 계정명 공백 정규화(2026-08-20) — 실측 확인: "대출채권" 계열 하나만 봐도 회사마다
// "상각후원가 측정 대출채권"(KB금융, 단어마다 공백)/"상각후원가측정대출채권"(신한지주,
// 공백 없음)/"상각후원가측정 대출채권"(하나금융지주, 한 군데만 공백) 3가지가 실제로
// 공존한다 — 별칭마다 공백 변형을 일일이 추가하는 건 두더지잡기라 비교 시점에 양쪽 다
// 공백을 제거해 정규화한다. "순이자손익" vs "순이자이익"처럼 단어 자체가 다른 진짜
// 동의어 차이는 이걸로 못 잡으므로 별칭 목록이 계속 담당한다.
function normalizeAccountName(s: string): string {
  return s.replace(/\s+/g, '');
}

// account_detail==='-'(또는 미제공)인 행만 — SCE(자본변동표) 등의 세부 구성요소 breakdown이
// 아닌, 그 계정과목의 연결 총계 행만 골라낸다(위 DartFullRow 주석 참고).
function pickFullAccount(
  list: DartFullRow[], aliases: string[],
): { thstrm: number | null; frmtrm: number | null; bfefrmtrm: number | null } | null {
  for (const alias of aliases) {
    const normalizedAlias = normalizeAccountName(alias);
    const row = list.find((r) =>
      normalizeAccountName(r.account_nm) === normalizedAlias && (!r.account_detail || r.account_detail === '-'));
    if (row) {
      return {
        thstrm:    parseAmount(row.thstrm_amount),
        frmtrm:    parseAmount(row.frmtrm_amount),
        bfefrmtrm: parseAmount(row.bfefrmtrm_amount),
      };
    }
  }
  return null;
}

async function fetchBankLineItems(corpCode: string, key: string): Promise<DartBankSeries | null> {
  const currentYear = new Date().getFullYear();
  for (const year of [currentYear - 1, currentYear - 2]) {
    const url = (sjDiv: string) =>
      `${BASE}/fnlttSinglAcntAll.json?crtfc_key=${encodeURIComponent(key)}` +
      `&corp_code=${corpCode}&bsns_year=${year}&reprt_code=11011&fs_div=CFS&sj_div=${sjDiv}`;
    const [cis, bs] = await Promise.all([
      fetchJson<{ status: string; list?: DartFullRow[] }>(url('CIS')),
      fetchJson<{ status: string; list?: DartFullRow[] }>(url('BS')),
    ]);
    if (cis?.status !== '000' || !cis.list?.length) continue; // 해당 연도 미제출 — 이전 연도로 재시도

    const isFields = Object.fromEntries(
      Object.entries(BANK_ALIASES_IS).map(([k, aliases]) => [k, pickFullAccount(cis.list!, aliases)]),
    );
    const bsFields = (bs?.status === '000' && bs.list?.length)
      ? Object.fromEntries(Object.entries(BANK_ALIASES_BS).map(([k, aliases]) => [k, pickFullAccount(bs.list!, aliases)]))
      : {};

    const series = (f?: { thstrm: number | null; frmtrm: number | null; bfefrmtrm: number | null } | null) =>
      f ? [f.thstrm, f.frmtrm, f.bfefrmtrm] : [null, null, null];

    return {
      fiscalYears: [String(year), String(year - 1), String(year - 2)],
      interestIncome:        series(isFields.interestIncome),
      interestExpense:       series(isFields.interestExpense),
      netInterestIncome:     series(isFields.netInterestIncome),
      provisionCreditLosses: series(isFields.provisionCreditLosses),
      loansGross:  series(bsFields.loansGross),
      deposits:    series(bsFields.deposits),
      borrowings:  series(bsFields.borrowings),
    };
  }
  return null;
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

  return fetchDartDataById(corp.corpCode, corp.corpName, corp.stockCode, key);
}

// company_listings로 corp_code를 이미 아는 경우(다중상장 회사 등) — 이름 기반
// lookupCorpCode를 건너뛰고 바로 DART API 조회.
export async function fetchDartDataByCorpCode(corpCode: string, stockCode: string | null, corpName: string): Promise<DartData | null> {
  const key = process.env.DART_API_KEY;
  if (!key) return null;

  return fetchDartDataById(corpCode, corpName, stockCode, key);
}

async function fetchDartDataById(corpCode: string, corpName: string, stockCode: string | null, key: string): Promise<DartData | null> {
  // 은행 재무제표 템플릿(2026-08-20) — KSIC로 은행 후보군인 회사만 fnlttSinglAcntAll.json을
  // 추가 조회(비은행 회사엔 API 호출 증가 없음). classifyIndustryCategory() 자체도 별도
  // supabase 조회 1회라 다른 조회들과 병렬로 시작해두고, 필요할 때만 bankSeries를 기다린다.
  const industryCategoryPromise = classifyIndustryCategory({ corpCode });

  // 최근 공시 목록 + 최근 4개년 재무 시계열 + 트리거 이벤트(주요사항보고서) 병렬 조회
  const [disclosuresResult, seriesResult, triggerResult, industryCategory] = await Promise.allSettled([
    fetchDisclosures(corpCode, key),
    fetchMultiYearSeries(corpCode, key),
    fetchTriggerEvents(corpCode, key),
    industryCategoryPromise,
  ]);

  const disclosures = disclosuresResult.status === 'fulfilled' ? disclosuresResult.value : [];
  const { cfs, ofs } =
    seriesResult.status === 'fulfilled' ? seriesResult.value : { cfs: null, ofs: null };
  const triggerEvents = triggerResult.status === 'fulfilled' ? triggerResult.value : [];

  const bankSeries = (industryCategory.status === 'fulfilled' && industryCategory.value === 'bank')
    ? await fetchBankLineItems(corpCode, key).catch(() => null)
    : null;

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
      ? {
          ticker: stockCode, corp_code: corpCode, corp_name: corpName, cfs, ofs, currency: 'KRW', source: 'DART',
          bankSeries: bankSeries ?? undefined,
        }
      : undefined;

  return { corpCode, corpName, stockCode, disclosures, financials, rawSeries, triggerEvents: triggerEvents.length > 0 ? triggerEvents : undefined };
}

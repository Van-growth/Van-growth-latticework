// income_statement/balance_sheet를 EDGAR/DART 원본(raw series)에서 서버가 직접 조립한다 —
// Claude가 다년도 표를 텍스트로 다시 서술하다 일부 연도를 놓치는 실행별 비결정성 문제
// (2026-08-13 Ford FY2021/2022 공백 사고, 상세는 세션 기록 참고)를 근본적으로 없애기 위해
// "이미 확정된 값을 재서술하지 말라"는 프롬프트 지시 대신 서버가 그 값 자체를 만들어 덮어쓴다.
//
// claude.ts(FinancialsV2Row/FinancialsV2BSRow 정의)와 이 파일이 서로 import하면 순환 참조가
// 생기므로(claude.ts → financialContext.ts → 이 파일, 반대로 claude.ts도 이 파일을 씀), 이
// 파일은 독립적으로 동일 shape의 타입을 정의한다 — TS 구조적 타이핑 덕분에 호출부에서
// FinancialsV2Row/FinancialsV2BSRow에 그대로 대입 가능하다.
import { EdgarRawSeries } from './edgar';
import { DartRawSeries } from './dart';
import { IndustryCategory } from './industryClassification';

export type { IndustryCategory };

// fy{year} 컬럼은 회사마다 보유 연도 수·범위가 다르다(신규 상장사는 짧고, 오래된 기업은
// 최대 5개) — 고정된 fy2021~fy2025 리터럴 대신 인덱스 시그니처로 가변 연도를 수용한다.
export interface FinancialsRowLike {
  item: string;
  yoy?: string;
  [yearKey: string]: string | undefined;
}

export interface BalanceSheetRowLike {
  item: string;
  [yearKey: string]: string | undefined;
}

// income_statement/balance_sheet 행에 실제로 존재하는 fy{year} 키만 오름차순으로 추출 —
// claude.ts의 Rule 4/5, golden-set 체크 등 이 행 shape을 소비하는 곳에서 재사용.
export function getRowYearCols(row: Record<string, string | undefined>): string[] {
  return Object.keys(row).filter(k => /^fy\d{4}$/.test(k)).sort();
}

const MARKERS: Record<'ko' | 'en', { notDisclosed: string; notApplicable: string }> = {
  en: { notDisclosed: 'Not disclosed', notApplicable: 'Not applicable' },
  ko: { notDisclosed: '확인 필요', notApplicable: '해당없음' },
};

// 고정된 연도 리터럴 대신 "최근 몇 개년까지 보여줄지"만 정책으로 유지 — 실제 컬럼(연도)은
// 회사가 가진 rawSeries.fiscalYears에서 그대로 가져온다(신규 상장사는 자연히 더 적게 나옴).
// MAX_BS_YEARS는 기존 3이었으나 손익계산서(5)와 다르게 잘라야 할 근거가 코드/커밋에 없었고,
// 실측(에이피알, 2026-08-16) 결과 raw_dart.cfs에 FY2021 자산/부채/자본이 이미 정상 존재하는데도
// 이 캡 때문에 화면/PDF에서 잘려나가고 있었음 — 손익계산서와 동일하게 5로 상향.
const MAX_IS_YEARS = 5;
const MAX_BS_YEARS = 5;

function fmtUsd(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs  = Math.abs(v);
  return abs >= 1_000_000_000
    ? `${sign}${(abs / 1_000_000_000).toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

function fmtKrw(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs  = Math.abs(v);
  if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000)       return `${sign}${(abs / 100_000_000).toFixed(0)}억원`;
  return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
}

interface SeriesInput {
  fiscalYears: string[];
  revenue: (number | null)[];
  grossProfit: (number | null)[];
  operatingIncome: (number | null)[];
  netIncome: (number | null)[];
  assets: (number | null)[];
  liabilities: (number | null)[];
  equity: (number | null)[];
  fmt: (v: number) => string;
}

// financial_cache.raw_edgar/raw_dart는 배치가 마지막으로 그 회사를 계산했던 시점의
// EdgarRawSeries/DartRawSeries 필드 집합으로 저장된 JSONB 스냅샷이다 — 이후 두 타입에
// 필드가 추가되면(grossProfit/depreciation처럼), 그 필드 추가 이전에 캐시된 옛 blob에는
// 키 자체가 없어 런타임엔 undefined다(TS 타입은 있다고 우기지만 검증되지 않음). 새 필드가
// 생길 때마다 한 곳씩 fallback을 추가하는 대신, 여기서 일괄적으로 null 배열로 정규화한다.
function fallback(vals: (number | null)[] | undefined, n: number): (number | null)[] {
  return vals ?? Array(n).fill(null);
}

function toSeriesInput(rawEdgar: EdgarRawSeries | null, rawDart: DartRawSeries | null): SeriesInput | null {
  if (rawEdgar) {
    const n = rawEdgar.fiscalYears.length;
    return {
      fiscalYears: rawEdgar.fiscalYears,
      revenue: fallback(rawEdgar.revenue, n),
      grossProfit: fallback(rawEdgar.grossProfit, n),
      operatingIncome: fallback(rawEdgar.operatingIncome, n),
      netIncome: fallback(rawEdgar.netIncome, n),
      assets: fallback(rawEdgar.assets, n),
      liabilities: fallback(rawEdgar.liabilities, n),
      equity: fallback(rawEdgar.equity, n),
      fmt: fmtUsd,
    };
  }
  const dart = rawDart?.cfs ?? rawDart?.ofs;
  if (!dart) return null;
  const n = dart.fiscalYears.length;
  return {
    fiscalYears: dart.fiscalYears,
    revenue: fallback(dart.revenue, n),
    grossProfit: Array(n).fill(null),   // DART는 매출총이익 concept 자체를 안 가져옴
    operatingIncome: fallback(dart.operatingIncome, n),
    netIncome: fallback(dart.netIncome, n),
    assets: fallback(dart.assets, n),
    liabilities: fallback(dart.liabilities, n),
    equity: fallback(dart.equity, n),
    fmt: fmtKrw,
  };
}

function isStructurallyAbsent(vals: (number | null)[]): boolean {
  return vals.length > 0 && vals.every(v => v == null);
}

function countNonNull(arr?: (number | null)[]): number {
  return arr ? arr.filter(v => v != null).length : 0;
}

// 은행 템플릿 활성화 게이트(2026-08-20) — SIC 6199/KSIC 64xxx는 크립토·핀테크·일반
// 지주회사가 광범위하게 섞여있어(industryClassification.ts 참고) "계정과목 하나라도
// 있으면 적용"으로는 부족하다 — 보유 현금성자산 이자수익 태그 하나만 우연히 잡힌 비은행
// 회사에도 은행 템플릿/뱃지가 붙을 위험이 있다. 구조적 핵심 항목(대출채권 또는 예금)이
// 최소 1개 있고, 그 위에 손익 항목 중 최소 3개(EDGAR는 6개 후보 중 3개, DART는 4개 후보
// 중 3개 — DART는 기타수익/기타비용 대응 항목이 구조적으로 없어 후보 자체가 4개뿐, 의도된
// 설계) 이상 확인돼야 통과. false negative(진짜 은행인데 이번 분기 공시 형식 차이로
// 걸러짐)는 기존 일반 로직으로 안전하게 폴백되므로, false positive(비은행 오분류) 방지
// 쪽을 보수적으로 우선한다. 이 함수 하나가 "행을 어느 템플릿으로 만들지"와 "뱃지를
// 붙일지" 판정을 동시에 담당해 둘이 어긋날 여지를 없앤다(claude.ts의
// overrideFinancialsTable 참고).
export function isGenuineBankData(rawEdgar: EdgarRawSeries | null, rawDart: DartRawSeries | null): boolean {
  if (rawEdgar) {
    const hasStructural =
      countNonNull(rawEdgar.bankLoansGross) > 0 ||
      countNonNull(rawEdgar.bankLoansNet) > 0 ||
      countNonNull(rawEdgar.bankDeposits) > 0;
    if (!hasStructural) return false;
    const incomeFields = [
      rawEdgar.bankInterestIncome, rawEdgar.bankInterestExpense, rawEdgar.bankNetInterestIncome,
      rawEdgar.bankProvisionCreditLosses, rawEdgar.bankNoninterestIncome, rawEdgar.bankNoninterestExpense,
    ];
    return incomeFields.filter(f => countNonNull(f) > 0).length >= 3;
  }
  const b = rawDart?.bankSeries;
  if (b) {
    const hasStructural = countNonNull(b.loansGross) > 0 || countNonNull(b.deposits) > 0;
    if (!hasStructural) return false;
    const incomeFields = [b.interestIncome, b.interestExpense, b.netInterestIncome, b.provisionCreditLosses];
    return incomeFields.filter(f => countNonNull(f) > 0).length >= 3;
  }
  return false;
}

// 은행 손익계산서 — 표준 3항목(매출/매출총이익/영업이익) 대신 이자수익/이자비용/순이자수익/
// 대손충당금/기타수익/기타비용/순이익 7행. 호출부(buildIncomeStatementRows)가 이미
// isGenuineBankData()로 게이트했다고 신뢰하고, 여기선 순수 행 조립만 한다.
function buildBankIncomeStatementRows(
  rawEdgar: EdgarRawSeries | null,
  rawDart: DartRawSeries | null,
  language: 'ko' | 'en',
): FinancialsRowLike[] | null {
  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);

  if (rawEdgar) {
    const fiscalYears = rawEdgar.fiscalYears;
    if (!fiscalYears.length) return null;
    const s: SeriesInput = {
      fiscalYears, revenue: [], grossProfit: [], operatingIncome: [],
      netIncome: rawEdgar.netIncome, assets: [], liabilities: [], equity: [], fmt: fmtUsd,
    };
    const row = (item: string, vals: (number | null)[] | undefined) =>
      buildRow(item, fallback(vals, fiscalYears.length), s, language, MAX_IS_YEARS);
    const yoy = (vals: (number | null)[] | undefined) => computeYoy(fallback(vals, fiscalYears.length), fiscalYears);
    return [
      { ...row(t('총이자수익', 'Total Interest Income'), rawEdgar.bankInterestIncome), yoy: yoy(rawEdgar.bankInterestIncome) },
      { ...row(t('총이자비용', 'Total Interest Expense'), rawEdgar.bankInterestExpense), yoy: yoy(rawEdgar.bankInterestExpense) },
      { ...row(t('순이자수익', 'Net Interest Income'), rawEdgar.bankNetInterestIncome), yoy: yoy(rawEdgar.bankNetInterestIncome) },
      { ...row(t('대손충당금', 'Provision for Credit Losses'), rawEdgar.bankProvisionCreditLosses), yoy: '—' },
      { ...row(t('기타수익', 'Noninterest Income'), rawEdgar.bankNoninterestIncome), yoy: '—' },
      { ...row(t('기타비용', 'Noninterest Expense'), rawEdgar.bankNoninterestExpense), yoy: '—' },
      { ...row(t('순이익', 'Net Income'), rawEdgar.netIncome), yoy: yoy(rawEdgar.netIncome) },
    ] as FinancialsRowLike[];
  }

  const b = rawDart?.bankSeries;
  if (b) {
    const s: SeriesInput = {
      fiscalYears: b.fiscalYears, revenue: [], grossProfit: [], operatingIncome: [],
      netIncome: [], assets: [], liabilities: [], equity: [], fmt: fmtKrw,
    };
    const row = (item: string, vals: (number | null)[]) => buildRow(item, vals, s, language, b.fiscalYears.length);
    const yoy = (vals: (number | null)[]) => computeYoy(vals, b.fiscalYears);
    // 기타수익/기타비용은 DART K-IFRS 은행지주 CIS엔 단일 필드로 없음(수수료손익/보험손익/
    // 유가증권손익 등으로 세분화) — 서버가 합산 계산하지 않는다는 원칙에 따라 생략.
    const netIncomeSeries = fallback((rawDart!.cfs ?? rawDart!.ofs)?.netIncome, b.fiscalYears.length);
    return [
      { ...row(t('총이자수익', 'Total Interest Income'), b.interestIncome), yoy: yoy(b.interestIncome) },
      { ...row(t('총이자비용', 'Total Interest Expense'), b.interestExpense), yoy: yoy(b.interestExpense) },
      { ...row(t('순이자손익', 'Net Interest Income'), b.netInterestIncome), yoy: yoy(b.netInterestIncome) },
      { ...row(t('대손충당금', 'Provision for Credit Losses'), b.provisionCreditLosses), yoy: '—' },
      { ...row(t('순이익', 'Net Income'), netIncomeSeries), yoy: yoy(netIncomeSeries) },
    ] as FinancialsRowLike[];
  }
  return null;
}

// 은행 재무상태표 — 대출채권(총액/순액)/예금/차입금 핵심 3~4행.
function buildBankBalanceSheetRows(
  rawEdgar: EdgarRawSeries | null,
  rawDart: DartRawSeries | null,
  language: 'ko' | 'en',
): BalanceSheetRowLike[] | null {
  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);

  if (rawEdgar) {
    const fiscalYears = rawEdgar.fiscalYears;
    if (!fiscalYears.length) return null;
    const s: SeriesInput = {
      fiscalYears, revenue: [], grossProfit: [], operatingIncome: [], netIncome: [],
      assets: [], liabilities: [], equity: [], fmt: fmtUsd,
    };
    const row = (item: string, vals: (number | null)[] | undefined) =>
      buildRow(item, fallback(vals, fiscalYears.length), s, language, MAX_BS_YEARS) as unknown as BalanceSheetRowLike;
    return [
      row(t('대출채권(총액)', 'Loans, Gross'), rawEdgar.bankLoansGross),
      row(t('대손충당금', 'Allowance for Credit Losses'), rawEdgar.bankAllowanceForCreditLosses),
      row(t('대출채권(순액)', 'Loans, Net'), rawEdgar.bankLoansNet),
      row(t('예금', 'Deposits'), rawEdgar.bankDeposits),
      row(t('차입금', 'Borrowings'), rawEdgar.bankBorrowings),
    ];
  }

  const b = rawDart?.bankSeries;
  if (b) {
    const s: SeriesInput = {
      fiscalYears: b.fiscalYears, revenue: [], grossProfit: [], operatingIncome: [], netIncome: [],
      assets: [], liabilities: [], equity: [], fmt: fmtKrw,
    };
    const row = (item: string, vals: (number | null)[]) =>
      buildRow(item, vals, s, language, b.fiscalYears.length) as unknown as BalanceSheetRowLike;
    return [
      row(t('대출채권', 'Loans'), b.loansGross),
      row(t('예금', 'Deposits'), b.deposits),
      row(t('차입금', 'Borrowings'), b.borrowings),
    ];
  }
  return null;
}

// cols는 이제 "찾아야 할 연도 후보"가 아니라 s.fiscalYears 자체에서 앞쪽 maxYears개를 그대로
// 쓴다 — fiscalYears는 항상 실존하는 연도만 담고 있으므로(신규 상장사는 짧게, extractAnnualSeries
// 참고) 이전처럼 "그 연도가 없으면 undefined로 뭉갠다" 분기 자체가 필요 없어졌다. 회사가 존재했지만
// 그 항목을 공시하지 않은 경우(예: Ford 매출총이익)만 "해당없음"/"확인 필요"로 구분해 표시한다.
function buildRow(
  item: string,
  vals: (number | null)[],
  s: SeriesInput,
  lang: 'ko' | 'en',
  maxYears: number,
): Record<string, string | undefined> {
  const m = MARKERS[lang];
  const absent = isStructurallyAbsent(vals);
  const row: Record<string, string | undefined> = { item };
  s.fiscalYears.slice(0, maxYears).forEach((yr, idx) => {
    const v = vals[idx];
    row[`fy${yr}`] = v != null ? s.fmt(v) : (absent ? m.notApplicable : m.notDisclosed);
  });
  return row;
}

// 최신 2개년(인접 연도) YoY만 계산 — 다년 평균이 아니라 "직전 연도 대비" 단일 값
// (2026-08-13 워트인텔리전스 "N년 평균" 오표현 사고와 동일한 원칙: 실제로 있는 데이터
// 포인트 수만큼만 표현한다).
function computeYoy(vals: (number | null)[], fiscalYears: string[]): string {
  if (vals.length < 2 || fiscalYears.length < 2) return '—';
  const y0 = Number(fiscalYears[0]), y1 = Number(fiscalYears[1]);
  if (Math.abs(y0 - y1) !== 1) return '—'; // 인접연도 아니면 계산 안 함
  const v0 = vals[0], v1 = vals[1];
  if (v0 == null || v1 == null || v1 === 0) return '—';
  const pct = ((v0 - v1) / Math.abs(v1)) * 100;
  return pct >= 0 ? `▲${pct.toFixed(0)}%` : `▼${Math.abs(pct).toFixed(0)}%`;
}

export function buildIncomeStatementRows(
  rawEdgar: EdgarRawSeries | null,
  rawDart: DartRawSeries | null,
  language: 'ko' | 'en',
  industryCategory: IndustryCategory = 'general',
): FinancialsRowLike[] | null {
  if (industryCategory === 'bank' && isGenuineBankData(rawEdgar, rawDart)) {
    const bankRows = buildBankIncomeStatementRows(rawEdgar, rawDart, language);
    if (bankRows) return bankRows;
  }

  const s = toSeriesInput(rawEdgar, rawDart);
  if (!s || s.fiscalYears.length === 0) return null;

  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);

  const revRow = buildRow(t('매출', 'Revenue'), s.revenue, s, language, MAX_IS_YEARS);
  const gpRow  = buildRow(t('매출총이익', 'Gross Profit'), s.grossProfit, s, language, MAX_IS_YEARS);
  const oiRow  = buildRow(t('영업이익', 'Operating Income'), s.operatingIncome, s, language, MAX_IS_YEARS);
  const niRow  = buildRow(t('순이익', 'Net Income'), s.netIncome, s, language, MAX_IS_YEARS);

  return [
    { ...revRow, yoy: computeYoy(s.revenue, s.fiscalYears) } as FinancialsRowLike,
    { ...gpRow,  yoy: computeYoy(s.grossProfit, s.fiscalYears) } as FinancialsRowLike,
    { ...oiRow,  yoy: computeYoy(s.operatingIncome, s.fiscalYears) } as FinancialsRowLike,
    { ...niRow,  yoy: computeYoy(s.netIncome, s.fiscalYears) } as FinancialsRowLike,
  ];
}

export interface RevenueLineRowLike {
  label: string;
  value: string;
  sharePct: number;
}

// 회사가 실제 10-K에서 라인 구분해 공시한 매출만 그대로 보여준다(edgar.ts의
// fetchRevenueLineItems 참고, 축이 사업부든 제품군이든 무관하게 그 회사가 쓴 라벨 그대로) —
// DART는 이 필드 자체가 없고(스코프 밖), 회사가 라인을 안 나눴으면(NVIDIA 등) null을 반환해
// 프론트가 이 섹션 자체를 스킵하게 한다. Claude는 이 값을 계산도 추정도 하지 않는다 — 비중(%)도
// 서버가 실제 라인 합계 대비 단순 나눗셈으로 결정론적으로 계산.
export function buildRevenueLines(rawEdgar: EdgarRawSeries | null): RevenueLineRowLike[] | null {
  const lines = rawEdgar?.revenueLines;
  if (!lines || lines.length < 2) return null;
  const total = lines.reduce((a, l) => a + l.value, 0);
  if (total <= 0) return null;
  return lines
    .slice()
    .sort((a, b) => b.value - a.value)
    .map(l => ({
      label: l.label,
      value: fmtUsd(l.value),
      sharePct: Math.round((l.value / total) * 1000) / 10,
    }));
}

export function buildBalanceSheetRows(
  rawEdgar: EdgarRawSeries | null,
  rawDart: DartRawSeries | null,
  language: 'ko' | 'en',
  industryCategory: IndustryCategory = 'general',
): BalanceSheetRowLike[] | null {
  if (industryCategory === 'bank' && isGenuineBankData(rawEdgar, rawDart)) {
    const bankRows = buildBankBalanceSheetRows(rawEdgar, rawDart, language);
    if (bankRows) return bankRows;
  }

  const s = toSeriesInput(rawEdgar, rawDart);
  if (!s || s.fiscalYears.length === 0) return null;

  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);
  return [
    buildRow(t('총자산', 'Total Assets'), s.assets, s, language, MAX_BS_YEARS) as unknown as BalanceSheetRowLike,
    buildRow(t('총부채', 'Total Liabilities'), s.liabilities, s, language, MAX_BS_YEARS) as unknown as BalanceSheetRowLike,
    buildRow(t('자본총계', "Shareholders' Equity"), s.equity, s, language, MAX_BS_YEARS) as unknown as BalanceSheetRowLike,
  ];
}

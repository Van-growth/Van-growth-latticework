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

export interface FinancialsRowLike {
  item: string;
  fy2021?: string;
  fy2022?: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
  yoy?: string;
}

export interface BalanceSheetRowLike {
  item: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
}

const MARKERS: Record<'ko' | 'en', { notDisclosed: string; notApplicable: string }> = {
  en: { notDisclosed: 'Not disclosed', notApplicable: 'Not applicable' },
  ko: { notDisclosed: '확인 필요', notApplicable: '해당없음' },
};

const IS_COLS = ['2021', '2022', '2023', '2024', '2025'] as const;
const BS_COLS = ['2023', '2024', '2025'] as const;

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
  depreciation: (number | null)[]; // DART는 항상 전부 null(concept 자체 없음)
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
      depreciation: fallback(rawEdgar.depreciation, n),
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
    depreciation: Array(n).fill(null),  // DART는 감가상각 concept 자체를 안 가져옴 — EBITDA 계산 불가
    assets: fallback(dart.assets, n),
    liabilities: fallback(dart.liabilities, n),
    equity: fallback(dart.equity, n),
    fmt: fmtKrw,
  };
}

function isStructurallyAbsent(vals: (number | null)[]): boolean {
  return vals.length > 0 && vals.every(v => v == null);
}

function buildRow(
  item: string,
  vals: (number | null)[],
  s: SeriesInput,
  lang: 'ko' | 'en',
  cols: readonly string[],
): Record<string, string | undefined> {
  const m = MARKERS[lang];
  const absent = isStructurallyAbsent(vals);
  const row: Record<string, string | undefined> = { item };
  cols.forEach(yr => {
    const idx = s.fiscalYears.indexOf(yr);
    if (idx < 0) { row[`fy${yr}`] = undefined; return; }
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
): FinancialsRowLike[] | null {
  const s = toSeriesInput(rawEdgar, rawDart);
  if (!s || s.fiscalYears.length === 0) return null;

  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);
  // EBITDA = Operating Income + Depreciation — 둘 다 확인된 연도만 계산, 하나라도 없으면 그 해는 null
  const ebitda = s.fiscalYears.map((_, i) => {
    const oi = s.operatingIncome[i], da = s.depreciation[i];
    return (oi != null && da != null) ? oi + da : null;
  });

  const revRow = buildRow(t('매출', 'Revenue'), s.revenue, s, language, IS_COLS);
  const gpRow  = buildRow(t('매출총이익', 'Gross Profit'), s.grossProfit, s, language, IS_COLS);
  const oiRow  = buildRow(t('영업이익', 'Operating Income'), s.operatingIncome, s, language, IS_COLS);
  const niRow  = buildRow(t('순이익', 'Net Income'), s.netIncome, s, language, IS_COLS);
  const ebRow  = buildRow('EBITDA', ebitda, s, language, IS_COLS);

  return [
    { ...revRow, yoy: computeYoy(s.revenue, s.fiscalYears) } as FinancialsRowLike,
    { ...gpRow,  yoy: computeYoy(s.grossProfit, s.fiscalYears) } as FinancialsRowLike,
    { ...oiRow,  yoy: computeYoy(s.operatingIncome, s.fiscalYears) } as FinancialsRowLike,
    { ...niRow,  yoy: computeYoy(s.netIncome, s.fiscalYears) } as FinancialsRowLike,
    { ...ebRow,  yoy: computeYoy(ebitda, s.fiscalYears) } as FinancialsRowLike,
  ];
}

export function buildBalanceSheetRows(
  rawEdgar: EdgarRawSeries | null,
  rawDart: DartRawSeries | null,
  language: 'ko' | 'en',
): BalanceSheetRowLike[] | null {
  const s = toSeriesInput(rawEdgar, rawDart);
  if (!s || s.fiscalYears.length === 0) return null;

  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);
  return [
    buildRow(t('총자산', 'Total Assets'), s.assets, s, language, BS_COLS) as unknown as BalanceSheetRowLike,
    buildRow(t('총부채', 'Total Liabilities'), s.liabilities, s, language, BS_COLS) as unknown as BalanceSheetRowLike,
    buildRow(t('자본총계', "Shareholders' Equity"), s.equity, s, language, BS_COLS) as unknown as BalanceSheetRowLike,
  ];
}

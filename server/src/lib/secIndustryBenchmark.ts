// financials_v2 막대비교 컴포넌트 전용 — SEC 산업 벤치마크(industry_benchmark 테이블,
// server/scripts/secBenchmarkPrecompute.ts가 SEC Financial Statement Data Sets 벌크
// 파싱으로 채움) 대비 이 회사 수치의 편차를 계산한다.
//
// 기존 industry_benchmark_cache/industryBenchmarkService.ts(라이브 캐시, 이 앱에서 실제
// 검색된 EDGAR 기업만 대상이라 표본이 좁음, financials_v2.industry_benchmark 구조화 필드로
// 첨부돼 별도 UI 카드로 렌더링)와는 완전히 별개 시스템이다 — 이쪽은 SEC 전수 벌크 데이터
// 기반의 훨씬 큰 표본이다.
//
// 2026-08-12 재설계: 처음엔 이 컨텍스트를 Claude 프롬프트에 텍스트로 주입해 narrative/
// outlook 문장에 녹아들게 했으나, "KPI 카드와 중복되는 숫자는 서사에서 제거하고 막대비교
// 컴포넌트로 뺀다"는 콘텐츠 포맷 원칙에 따라 순수 계산 결과(숫자)만 반환하도록 변경 —
// Claude는 이 숫자에 손대지 않고, interpretation 한 줄만 별도의 작은 호출
// (claude.ts의 generateSecBenchmarkInterpretations)로 채운다. 화면 렌더링은
// AnalysisCard.tsx의 SecBenchmarkComparisonBlock 참고.
//
// 회사 자신의 5개 지표는 서버에서 직접 계산한다(rawEdgar 시계열 기반, industryBenchmarkService.ts
// 의 extractLatestRatios와 동일한 "지표별로 독립적으로 가장 최근에 두 값이 다 있는 연도를
// 찾는다" 패턴 — 한 지표가 최신연도에 없다고 다른 지표까지 오래된 연도를 쓰거나 버리지 않음).
import { supabase } from './supabase';
import { MIN_SECTOR_SAMPLE_SIZE } from '../services/monteCarloService';
import type { EdgarRawSeries } from './edgar';

const DEVIATION_THRESHOLD = 0.30; // ±30% 이상 벌어질 때만 언급

// sources[] 인용 URL — Claude가 스스로 지어내면 깨진 링크가 나올 수 있어(2026-08-11 실측,
// sec.gov/dera/data/financial-statements가 404였음) 서버가 이 상수 하나로 고정한다.
export const SEC_BENCHMARK_SOURCE_URL = 'https://www.sec.gov/data-research/sec-markets-data/financial-statement-data-sets';

export const METRIC_KEYS = ['debt_equity_ratio', 'cfo_revenue_ratio', 'operating_margin', 'asset_turnover', 'revenue_growth'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

const METRIC_LABELS: Record<MetricKey, { label: string; unit: string }> = {
  debt_equity_ratio: { label: 'Debt/Equity ratio', unit: '%' },
  cfo_revenue_ratio: { label: 'Operating cash flow / Revenue ratio', unit: '%' },
  operating_margin:  { label: 'Operating margin', unit: '%' },
  asset_turnover:    { label: 'Asset turnover', unit: 'x' },
  revenue_growth:    { label: 'Revenue growth (YoY)', unit: '%' },
};

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// 분자/분모 시계열에서 "가장 최근에 두 값이 다 있는" 연도의 비율(%) — 지표마다 독립적으로 찾는다.
function latestRatioPct(num: (number | null)[], den: (number | null)[]): number | null {
  const n = Math.min(num.length, den.length);
  for (let i = 0; i < n; i++) {
    const a = num[i], b = den[i];
    if (isFiniteNum(a) && isFiniteNum(b) && b !== 0) return (a / b) * 100;
  }
  return null;
}

function computeCompanyRatios(series: EdgarRawSeries): Record<MetricKey, number | null> {
  let assetTurnover: number | null = null;
  {
    const n = Math.min(series.revenue.length, series.assets.length);
    for (let i = 0; i < n; i++) {
      const r = series.revenue[i], a = series.assets[i];
      if (isFiniteNum(r) && isFiniteNum(a) && a > 0) { assetTurnover = r / a; break; } // 배수, %아님
    }
  }
  let revenueGrowth: number | null = null;
  for (let i = 0; i < series.revenue.length - 1; i++) {
    const curr = series.revenue[i], prev = series.revenue[i + 1];
    if (isFiniteNum(curr) && isFiniteNum(prev) && prev > 0) { revenueGrowth = ((curr - prev) / prev) * 100; break; }
  }
  return {
    debt_equity_ratio: latestRatioPct(series.liabilities, series.equity),
    cfo_revenue_ratio: latestRatioPct(series.operatingCF, series.revenue),
    operating_margin:  latestRatioPct(series.operatingIncome, series.revenue),
    asset_turnover:    assetTurnover,
    revenue_growth:    revenueGrowth,
  };
}

interface BenchmarkRow {
  sic_code: string;
  debt_equity_ratio_median: number | null; debt_equity_ratio_n: number | null;
  cfo_revenue_ratio_median: number | null; cfo_revenue_ratio_n: number | null;
  operating_margin_median: number | null; operating_margin_n: number | null;
  asset_turnover_median: number | null; asset_turnover_n: number | null;
  revenue_growth_median: number | null; revenue_growth_n: number | null;
}

function medianOf(row: BenchmarkRow, key: MetricKey): number | null {
  return (row as unknown as Record<string, number | null>)[`${key}_median`];
}
function sampleNOf(row: BenchmarkRow, key: MetricKey): number | null {
  return (row as unknown as Record<string, number | null>)[`${key}_n`];
}

export interface SecBenchmarkDeviationItem {
  metric: MetricKey;
  label: string;
  unit: string;
  companyValue: number;
  median: number;
  n: number;
}

export interface SecBenchmarkDeviations {
  sicCode: string;
  status: 'compared' | 'insufficient_sample';
  maxN?: number; // status==='insufficient_sample'일 때만
  items?: SecBenchmarkDeviationItem[]; // status==='compared'일 때만, ±30%+ 벗어난 지표만
}

/**
 * EDGAR 소스 기업에만 적용(DART/web_search는 SIC 체계가 안 맞아 null 반환 — cik 없으면 그
 * 자체로 null). 순수 계산만 하고 Claude를 호출하지 않는다(interpretation은 별도 함수).
 * - 이 SIC의 표본이 전 지표 다 5개 미만(또는 행 자체가 없음): status='insufficient_sample'.
 * - 표본은 충분한데 이 회사 수치가 어느 지표에서도 업종 중앙값 대비 ±30% 이상 안 벗어남:
 *   null 반환(컴포넌트 자체를 안 보여줌 — 매번 노출하면 노이즈).
 * - 벗어난 지표가 있으면 status='compared' + items(그 지표만).
 */
export async function computeSecBenchmarkDeviations(rawEdgar: EdgarRawSeries | undefined | null): Promise<SecBenchmarkDeviations | null> {
  if (!rawEdgar?.cik) return null;
  const cik = String(rawEdgar.cik).replace(/^CIK/, '');

  const { data: cikRow } = await supabase.from('cik_master').select('sic_code').eq('cik', cik).maybeSingle();
  const sicCode = cikRow?.sic_code;
  if (!sicCode) return null;

  const { data: row } = await supabase
    .from('industry_benchmark')
    .select('*')
    .eq('sic_code', sicCode)
    .maybeSingle<BenchmarkRow>();

  const reliableMetrics = row ? METRIC_KEYS.filter(k => (sampleNOf(row, k) ?? 0) >= MIN_SECTOR_SAMPLE_SIZE) : [];

  if (reliableMetrics.length === 0) {
    const maxN = row ? Math.max(0, ...METRIC_KEYS.map(k => sampleNOf(row, k) ?? 0)) : 0;
    return { sicCode, status: 'insufficient_sample', maxN };
  }

  const companyRatios = computeCompanyRatios(rawEdgar);
  const deviating = reliableMetrics.filter(k => {
    const companyVal = companyRatios[k];
    const median = medianOf(row!, k);
    if (!isFiniteNum(companyVal) || !isFiniteNum(median) || median === 0) return false;
    return Math.abs(companyVal - median) / Math.abs(median) >= DEVIATION_THRESHOLD;
  });

  if (deviating.length === 0) return null; // 벗어난 지표 없음 — 컴포넌트 자체를 안 보여줌

  const items: SecBenchmarkDeviationItem[] = deviating.map(k => ({
    metric: k,
    label: METRIC_LABELS[k].label,
    unit: METRIC_LABELS[k].unit,
    companyValue: companyRatios[k]!,
    median: medianOf(row!, k)!,
    n: sampleNOf(row!, k)!,
  }));

  return { sicCode, status: 'compared', items };
}

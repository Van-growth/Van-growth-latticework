// 업종 평균 벤치마크 + 경쟁사 매출 순위 — EDGAR(source='EDGAR') 기업 전용, 순수 계산 + Supabase 조회.
// SIC 코드는 financial_cache가 아니라 cik_master.sic_code(회사 단위)에 있어 cik_master로
// 티커 목록을 먼저 구한 뒤 financial_cache(raw_edgar)를 배치 조회하는 2단계 조인이 필요하다.
// (monteCarloService.ts의 getSectorBenchmarkStats와 동일한 조인/캐싱 패턴 재사용)
import { supabase } from '../lib/supabase';
import { chunk, clip, meanStdDev, MIN_SECTOR_SAMPLE_SIZE } from './monteCarloService';

export type IndustryBenchmarkMetricKey = 'equity_ratio' | 'debt_ratio' | 'operating_margin' | 'revenue_growth';

export interface IndustryBenchmarkMetric {
  key: IndustryBenchmarkMetricKey;
  label: string;
  companyValue: number;
  industryAvg: number;
  sampleSize: number;
  verdict: '우수' | '평이' | '열위';
  sentence: string;
}

export interface IndustryBenchmarkResult {
  sicCode: string;
  sicDescription?: string;
  metrics: IndustryBenchmarkMetric[];
  asOf: string;
  // financials_v2.sources에 붙는 "1min 자체 집계" 항목의 인덱스 — analyze.ts가 채운다.
  sourceIndex?: number;
}

export interface CompetitorRevenueRankingRow {
  rank: number;
  name: string;
  ticker: string;
  revenue: number;
  isSubject: boolean;
}

export interface CompetitorRevenueRanking {
  sicCode: string;
  totalCompanies: number;
  top: CompetitorRevenueRankingRow[];
  subjectRank: number | null;
  asOf: string;
  // competitors_v2.sources에 붙는 "1min 자체 집계" 항목의 인덱스 — analyze.ts가 채운다.
  sourceIndex?: number;
}

export interface SubjectRatios {
  equityRatio: number | null;
  debtRatio: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 하루 1회 (sector_benchmark_cache와 동일 주기)
const MIN_REVENUE_FOR_MARGIN = 1_000_000; // $1M 미만 매출은 영업이익률/성장률 분모로 안 씀 (극소 분모 왜곡 방지)
const RATIO_WINSORIZE_MIN = -200; // 자기자본비율/부채비율/영업이익률 클리핑 (%) — 자본잠식/대규모 적자 대비
const RATIO_WINSORIZE_MAX = 200;
const GROWTH_WINSORIZE_MIN = -90; // 매출액증가율 클리핑 (%) — monteCarloService WINSORIZE_MIN(-0.9)와 동일 기준
const GROWTH_WINSORIZE_MAX = 300; // monteCarloService WINSORIZE_MAX(3.0)와 동일 기준

const METRIC_DEFS: Array<{
  key: IndustryBenchmarkMetricKey;
  label: string;
  higherIsBetter: boolean;
  tolerancePp: number;
}> = [
  { key: 'equity_ratio',     label: '자기자본비율',     higherIsBetter: true,  tolerancePp: 3 },
  { key: 'debt_ratio',       label: '부채비율',         higherIsBetter: false, tolerancePp: 3 },
  { key: 'operating_margin', label: '매출액영업이익률', higherIsBetter: true,  tolerancePp: 3 },
  { key: 'revenue_growth',   label: '매출액증가율',     higherIsBetter: true,  tolerancePp: 5 },
];

function isFiniteNonPlaceholder(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v !== 999 && v !== -999;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function formatAsOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * raw_edgar 시계열에서 "각 지표별로 계산 가능한 가장 최신 연도" 값을 추출한다.
 * 필드마다 XBRL 태깅이 끊긴 시점이 다를 수 있어(예: 특정 concept만 최신 연도 누락),
 * 지표별로 독립적으로 최신 유효 연도를 찾는다 — 한 지표가 최신연도에 없다고 다른
 * 지표까지 오래된 연도를 쓰거나 전체를 버리지 않는다.
 */
export function extractLatestRatios(rawEdgar: any): SubjectRatios | null {
  if (!rawEdgar || !Array.isArray(rawEdgar.revenue)) return null;

  const revenue: (number | null)[]         = rawEdgar.revenue;
  const assets: (number | null)[]          = Array.isArray(rawEdgar.assets) ? rawEdgar.assets : [];
  const liabilities: (number | null)[]     = Array.isArray(rawEdgar.liabilities) ? rawEdgar.liabilities : [];
  const equity: (number | null)[]          = Array.isArray(rawEdgar.equity) ? rawEdgar.equity : [];
  const operatingIncome: (number | null)[] = Array.isArray(rawEdgar.operatingIncome) ? rawEdgar.operatingIncome : [];

  const n = revenue.length;

  let equityRatio: number | null = null;
  for (let i = 0; i < n; i++) {
    const eq = equity[i], as = assets[i];
    if (isFiniteNonPlaceholder(eq) && isFiniteNonPlaceholder(as) && as > 0) {
      equityRatio = (eq / as) * 100;
      break;
    }
  }

  let debtRatio: number | null = null;
  for (let i = 0; i < n; i++) {
    const li = liabilities[i], eq = equity[i];
    if (isFiniteNonPlaceholder(li) && isFiniteNonPlaceholder(eq) && eq > 0) {
      debtRatio = (li / eq) * 100;
      break;
    }
  }

  let operatingMargin: number | null = null;
  for (let i = 0; i < n; i++) {
    const oi = operatingIncome[i], rev = revenue[i];
    if (isFiniteNonPlaceholder(oi) && isFiniteNonPlaceholder(rev) && rev >= MIN_REVENUE_FOR_MARGIN) {
      operatingMargin = (oi / rev) * 100;
      break;
    }
  }

  let revenueGrowth: number | null = null;
  for (let i = 0; i < n - 1; i++) {
    const curr = revenue[i], prev = revenue[i + 1];
    if (isFiniteNonPlaceholder(curr) && isFiniteNonPlaceholder(prev) && prev >= MIN_REVENUE_FOR_MARGIN) {
      revenueGrowth = ((curr - prev) / prev) * 100;
      break;
    }
  }

  if (equityRatio == null && debtRatio == null && operatingMargin == null && revenueGrowth == null) return null;
  return { equityRatio, debtRatio, operatingMargin, revenueGrowth };
}

function latestValidRevenue(arr: unknown): number | null {
  if (!Array.isArray(arr)) return null;
  for (const v of arr) {
    if (isFiniteNonPlaceholder(v)) return v;
  }
  return null;
}

// sic_code → EDGAR 티커 목록(cik_master) → financial_cache(raw_edgar) 배치 조회.
// 업종 평균(Task1/2)과 매출 순위(Task3)가 동일 그룹 데이터를 공유해 중복 쿼리를 막는다.
async function fetchSicGroupRows(sicCode: string): Promise<Array<{ ticker: string; name: string; rawEdgar: any }>> {
  const { data: cikRows } = await supabase
    .from('cik_master')
    .select('ticker, name')
    .eq('sic_code', sicCode)
    .not('ticker', 'is', null);

  const tickers = (cikRows ?? []).map((r) => r.ticker as string).filter(Boolean);
  if (tickers.length === 0) return [];

  const nameByTicker = new Map((cikRows ?? []).map((r) => [r.ticker as string, r.name as string]));

  const rows: Array<{ ticker: string; name: string; rawEdgar: any }> = [];
  for (const batch of chunk(tickers, 300)) {
    const { data } = await supabase
      .from('financial_cache')
      .select('company_name, raw_edgar')
      .eq('source', 'EDGAR')
      .in('company_name', batch);
    for (const r of data ?? []) {
      if (!r.raw_edgar) continue;
      rows.push({ ticker: r.company_name, name: nameByTicker.get(r.company_name) ?? r.company_name, rawEdgar: r.raw_edgar });
    }
  }
  return rows;
}

async function lookupSicDescription(sicCode: string): Promise<string | null> {
  const { data } = await supabase
    .from('cik_master')
    .select('sic_description')
    .eq('sic_code', sicCode)
    .not('sic_description', 'is', null)
    .limit(1)
    .maybeSingle();
  return data?.sic_description ?? null;
}

interface GroupStatsRow {
  sic_code: string;
  equity_ratio_avg: number | null;
  equity_ratio_n: number | null;
  debt_ratio_avg: number | null;
  debt_ratio_n: number | null;
  operating_margin_avg: number | null;
  operating_margin_n: number | null;
  revenue_growth_avg: number | null;
  revenue_growth_n: number | null;
  computed_at: string;
}

function aggregate(values: number[]): { avg: number; n: number } | null {
  if (values.length < MIN_SECTOR_SAMPLE_SIZE) return null;
  const { mean } = meanStdDev(values);
  if (!Number.isFinite(mean)) return null;
  return { avg: mean, n: values.length };
}

async function getOrComputeGroupStats(sicCode: string): Promise<GroupStatsRow | null> {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  const { data: cached } = await supabase
    .from('industry_benchmark_cache')
    .select('*')
    .eq('sic_code', sicCode)
    .gte('computed_at', cutoff)
    .maybeSingle();
  if (cached) return cached as GroupStatsRow;

  const groupRows = await fetchSicGroupRows(sicCode);
  if (groupRows.length === 0) return null;

  const pooled: Record<IndustryBenchmarkMetricKey, number[]> = {
    equity_ratio: [], debt_ratio: [], operating_margin: [], revenue_growth: [],
  };

  for (const row of groupRows) {
    const ratios = extractLatestRatios(row.rawEdgar);
    if (!ratios) continue;
    if (ratios.equityRatio != null) pooled.equity_ratio.push(clip(ratios.equityRatio, RATIO_WINSORIZE_MIN, RATIO_WINSORIZE_MAX));
    if (ratios.debtRatio != null) pooled.debt_ratio.push(clip(ratios.debtRatio, RATIO_WINSORIZE_MIN, RATIO_WINSORIZE_MAX));
    if (ratios.operatingMargin != null) pooled.operating_margin.push(clip(ratios.operatingMargin, RATIO_WINSORIZE_MIN, RATIO_WINSORIZE_MAX));
    if (ratios.revenueGrowth != null) pooled.revenue_growth.push(clip(ratios.revenueGrowth, GROWTH_WINSORIZE_MIN, GROWTH_WINSORIZE_MAX));
  }

  const eq = aggregate(pooled.equity_ratio);
  const debt = aggregate(pooled.debt_ratio);
  const om = aggregate(pooled.operating_margin);
  const rg = aggregate(pooled.revenue_growth);

  if (!eq && !debt && !om && !rg) return null;

  const row: GroupStatsRow = {
    sic_code: sicCode,
    equity_ratio_avg: eq?.avg ?? null, equity_ratio_n: eq?.n ?? null,
    debt_ratio_avg: debt?.avg ?? null, debt_ratio_n: debt?.n ?? null,
    operating_margin_avg: om?.avg ?? null, operating_margin_n: om?.n ?? null,
    revenue_growth_avg: rg?.avg ?? null, revenue_growth_n: rg?.n ?? null,
    computed_at: new Date().toISOString(),
  };

  await supabase.from('industry_benchmark_cache').upsert(row, { onConflict: 'sic_code' });
  return row;
}

function verdictOf(companyValue: number, industryAvg: number, higherIsBetter: boolean, tolerancePp: number): '우수' | '평이' | '열위' {
  const diff = higherIsBetter ? companyValue - industryAvg : industryAvg - companyValue;
  if (Math.abs(diff) < tolerancePp) return '평이';
  return diff > 0 ? '우수' : '열위';
}

function fmtPct(v: number): string {
  return `${round1(v)}%`;
}

/**
 * SIC 코드 동종업계 대비 자기자본비율/부채비율/매출액영업이익률/매출액증가율 한 줄 해석.
 * 표본 5개 미만인 지표는 배열에서 자체 제외(필드 단위 Quality Gate) — 전체가 부족하면 null.
 */
export async function getIndustryBenchmark(sicCode: string, subject: SubjectRatios): Promise<IndustryBenchmarkResult | null> {
  const stats = await getOrComputeGroupStats(sicCode);
  if (!stats) return null;

  const subjectByKey: Record<IndustryBenchmarkMetricKey, number | null> = {
    equity_ratio: subject.equityRatio,
    debt_ratio: subject.debtRatio,
    operating_margin: subject.operatingMargin,
    revenue_growth: subject.revenueGrowth,
  };
  const avgByKey: Record<IndustryBenchmarkMetricKey, number | null> = {
    equity_ratio: stats.equity_ratio_avg,
    debt_ratio: stats.debt_ratio_avg,
    operating_margin: stats.operating_margin_avg,
    revenue_growth: stats.revenue_growth_avg,
  };
  const sampleByKey: Record<IndustryBenchmarkMetricKey, number | null> = {
    equity_ratio: stats.equity_ratio_n,
    debt_ratio: stats.debt_ratio_n,
    operating_margin: stats.operating_margin_n,
    revenue_growth: stats.revenue_growth_n,
  };

  const metrics: IndustryBenchmarkMetric[] = [];
  for (const def of METRIC_DEFS) {
    const companyValue = subjectByKey[def.key];
    const industryAvg  = avgByKey[def.key];
    const sampleSize    = sampleByKey[def.key];
    if (companyValue == null || industryAvg == null || sampleSize == null || sampleSize < MIN_SECTOR_SAMPLE_SIZE) continue;

    const verdict = verdictOf(companyValue, industryAvg, def.higherIsBetter, def.tolerancePp);
    metrics.push({
      key: def.key,
      label: def.label,
      companyValue: round1(companyValue),
      industryAvg: round1(industryAvg),
      sampleSize,
      verdict,
      sentence: `${def.label} ${fmtPct(companyValue)}, 업종 평균(${sampleSize}개사 기준) ${fmtPct(industryAvg)} 대비 ${verdict}`,
    });
  }

  if (metrics.length === 0) return null;

  const sicDescription = await lookupSicDescription(sicCode);
  return {
    sicCode,
    sicDescription: sicDescription ?? undefined,
    metrics,
    asOf: formatAsOf(stats.computed_at),
  };
}

/**
 * SIC 코드 동종업계 매출 순위 — 캐시 없이 매 요청 조회(단순 정렬이라 비용 낮음).
 * 상위 topN + 조회 대상 기업이 그 안에 없으면 실제 순위를 별도로 반환.
 */
export async function getCompetitorRevenueRanking(
  sicCode: string,
  subjectTicker: string,
  topN = 10,
): Promise<CompetitorRevenueRanking | null> {
  const groupRows = await fetchSicGroupRows(sicCode);
  if (groupRows.length === 0) return null;

  const withRevenue = groupRows
    .map((r) => ({ ticker: r.ticker, name: r.name, revenue: latestValidRevenue(r.rawEdgar?.revenue) }))
    .filter((r): r is { ticker: string; name: string; revenue: number } => r.revenue != null)
    .sort((a, b) => b.revenue - a.revenue);

  if (withRevenue.length === 0) return null;

  const top: CompetitorRevenueRankingRow[] = withRevenue.slice(0, topN).map((r, i) => ({
    rank: i + 1,
    name: r.name,
    ticker: r.ticker,
    revenue: r.revenue,
    isSubject: r.ticker === subjectTicker,
  }));

  const subjectIndex = withRevenue.findIndex((r) => r.ticker === subjectTicker);
  const subjectRank = subjectIndex === -1 || subjectIndex < topN ? null : subjectIndex + 1;

  return {
    sicCode,
    totalCompanies: withRevenue.length,
    top,
    subjectRank,
    asOf: formatAsOf(new Date().toISOString()),
  };
}

// 매출 시계열 기반 몬테카를로 시뮬레이션 — 대부분 순수 계산, 외부 API 호출 없음.
// 예외: getSectorBenchmarkStats는 섹터 벤치마크 집계를 위해 DB(Supabase)를 조회한다.
// 입력: financial_cache.raw_edgar / raw_dart (또는 라이브 fetchEdgarData/fetchDartData의 rawSeries와 동일 shape)
import { extractAnnualSeries, pickConceptSeries } from '../lib/edgar';
import { supabase } from '../lib/supabase';

export interface RevenueYearPoint {
  year: number;
  revenue: number;
}

export interface GrowthStats {
  mean: number;
  stdDev: number;
  dataPoints: number;
}

export interface SimulationParams {
  baseRevenue: number;
  mean: number;
  stdDev: number;
  years?: number;
  iterations?: number;
}

export interface SimulationResult {
  p10: number[];
  p50: number[];
  p90: number[];
  histogram: number[];
  finalYearDistribution: number[];
}

const MIN_YEARS_REQUIRED = 3;
const PLACEHOLDER_VALUES = new Set([999, -999]);

function isValidRevenue(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && !PLACEHOLDER_VALUES.has(v);
}

// EDGAR raw companyfacts.json 원본 형태({ facts: { 'us-gaap': {...} } }) 여부 판별
function isRawCompanyFacts(rawData: any): boolean {
  return !!rawData?.facts?.['us-gaap'];
}

function extractEdgarRevenue(rawData: any): { fiscalYears: string[]; revenue: (number | null)[] } | null {
  if (isRawCompanyFacts(rawData)) {
    const gaap = rawData.facts['us-gaap'];
    const revData = pickConceptSeries(
      gaap,
      'Revenues',
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'SalesRevenueNet',
    );
    if (revData.length === 0) return null;
    return { fiscalYears: revData.map((d) => d.year), revenue: revData.map((d) => d.val) };
  }

  // financial_cache 저장 형태(raw_edgar) — 이미 { fiscalYears, revenue } 평탄 배열
  if (Array.isArray(rawData?.fiscalYears) && Array.isArray(rawData?.revenue)) {
    return { fiscalYears: rawData.fiscalYears, revenue: rawData.revenue };
  }

  return null;
}

function extractDartRevenue(rawData: any): { fiscalYears: string[]; revenue: (number | null)[] } | null {
  const series = rawData?.cfs ?? rawData?.ofs;
  if (!series || !Array.isArray(series.fiscalYears) || !Array.isArray(series.revenue)) return null;
  return { fiscalYears: series.fiscalYears, revenue: series.revenue };
}

/**
 * raw_edgar / raw_dart 원본에서 연도별 매출 시계열을 추출한다.
 * 결측치, 음수, -999/999 placeholder는 제외한다. 최소 3개년 미만이면 null.
 */
export function extractRevenueTimeSeries(
  rawData: any,
  source: 'EDGAR' | 'DART',
): RevenueYearPoint[] | null {
  if (!rawData) return null;

  const extracted = source === 'EDGAR' ? extractEdgarRevenue(rawData) : extractDartRevenue(rawData);
  if (!extracted) return null;

  const { fiscalYears, revenue } = extracted;
  const byYear = new Map<number, number>();

  for (let i = 0; i < fiscalYears.length; i++) {
    const year = parseInt(fiscalYears[i], 10);
    const rev  = revenue[i];
    if (!Number.isFinite(year) || !isValidRevenue(rev)) continue;
    if (!byYear.has(year)) byYear.set(year, rev);
  }

  const points = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, rev]) => ({ year, revenue: rev }));

  return points.length >= MIN_YEARS_REQUIRED ? points : null;
}

// 연도순 정렬 후 인접 연도 간 YoY 성장률 배열을 계산 (분모 0/음수 매출 구간은 제외).
// minBaseRevenue: 분모(전년 매출)가 이 미만인 구간도 제외 — 극소 매출 기준 왜곡 방지용(섹터 풀링 시에만 사용).
function computeGrowthRates(revenueTimeSeries: RevenueYearPoint[], minBaseRevenue = 0): number[] {
  const sorted = [...revenueTimeSeries].sort((a, b) => a.year - b.year);
  const rates: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].revenue;
    const curr = sorted[i].revenue;
    if (prev <= minBaseRevenue) continue;
    rates.push((curr - prev) / prev);
  }
  return rates;
}

function meanStdDev(values: number[]): { mean: number; stdDev: number } {
  const mean     = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * 연도별 매출 시계열로부터 YoY 성장률의 평균/표준편차를 계산한다 (표본 표준편차, n-1).
 * 3개년 미만(=성장률 2개 미만)이면 null.
 */
export function calculateGrowthStats(revenueTimeSeries: RevenueYearPoint[]): GrowthStats | null {
  if (!revenueTimeSeries || revenueTimeSeries.length < MIN_YEARS_REQUIRED) return null;

  const growthRates = computeGrowthRates(revenueTimeSeries);
  if (growthRates.length < 2) return null;

  const { mean, stdDev } = meanStdDev(growthRates);
  return { mean, stdDev, dataPoints: growthRates.length };
}

// ── 섹터 벤치마크 (미상장/데이터 부족 기업의 시뮬레이션 폴백용) ────────────────

export interface SectorBenchmarkStats {
  mean: number;
  stdDev: number;
  sampleSize: number;
}

const MIN_SECTOR_SAMPLE_SIZE = 5;
const SECTOR_BENCHMARK_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 하루 1회

// 셸/페니스톡 기업의 극소 매출 기준(분모)에서 나오는 비현실적 YoY(수만%대)가
// 섹터 평균을 통째로 왜곡하는 걸 막기 위한 안전장치 — 실제 데이터에서 확인됨
// (예: 매출 $450 → $504,000, +111,900%). 두 단계로 방어:
// 1) 성장률 계산 분모(전년 매출)가 이 미만이면 해당 구간 자체를 제외
// 2) 그래도 남는 극단치는 윈저라이즈(구간 클리핑)
const MIN_BASE_REVENUE_FOR_GROWTH_RATE = 1_000_000; // $1M / 10억원 상당
const WINSORIZE_MIN = -0.9;  // -90%
const WINSORIZE_MAX = 3.0;   // +300%

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function clip(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 섹터(sector_tag) 소속 상장사들의 financial_cache 매출 시계열에서 개별 YoY 성장률을
 * 전부 풀링해 섹터 전체의 평균/표준편차를 집계한다. 기여 기업 수가 5개 미만이면
 * 신뢰 불가로 판단해 null. 결과는 하루 1회만 재계산되도록 sector_benchmark_cache에 캐시한다.
 */
export async function getSectorBenchmarkStats(sectorTag: string): Promise<SectorBenchmarkStats | null> {
  const cutoff = new Date(Date.now() - SECTOR_BENCHMARK_CACHE_TTL_MS).toISOString();
  const { data: cached } = await supabase
    .from('sector_benchmark_cache')
    .select('mean, std_dev, sample_size, computed_at')
    .eq('sector_tag', sectorTag)
    .gte('computed_at', cutoff)
    .maybeSingle();
  if (cached) return { mean: cached.mean, stdDev: cached.std_dev, sampleSize: cached.sample_size };

  const [{ data: krRows }, { data: usRows }] = await Promise.all([
    supabase.from('corp_master').select('stock_code').eq('sector_tag', sectorTag).not('stock_code', 'is', null),
    supabase.from('cik_master').select('ticker').eq('sector_tag', sectorTag).not('ticker', 'is', null),
  ]);

  const tickers = [
    ...(krRows ?? []).map((r) => r.stock_code as string),
    ...(usRows ?? []).map((r) => r.ticker as string),
  ].filter(Boolean);

  if (tickers.length === 0) return null;

  const cacheRows: Array<{ company_name: string; source: string; raw_edgar: any; raw_dart: any }> = [];
  for (const batch of chunk(tickers, 300)) {
    const { data } = await supabase
      .from('financial_cache')
      .select('company_name, source, raw_edgar, raw_dart')
      .in('company_name', batch);
    if (data) cacheRows.push(...(data as typeof cacheRows));
  }

  const pooledRates: number[] = [];
  let contributingCompanies = 0;

  for (const row of cacheRows) {
    const source = row.source as 'EDGAR' | 'DART';
    const raw = source === 'DART' ? row.raw_dart : row.raw_edgar;
    const series = extractRevenueTimeSeries(raw, source);
    if (!series) continue;
    const rates = computeGrowthRates(series, MIN_BASE_REVENUE_FOR_GROWTH_RATE)
      .map((r) => clip(r, WINSORIZE_MIN, WINSORIZE_MAX));
    if (rates.length === 0) continue;
    pooledRates.push(...rates);
    contributingCompanies++;
  }

  if (contributingCompanies < MIN_SECTOR_SAMPLE_SIZE || pooledRates.length < 2) return null;

  const { mean, stdDev } = meanStdDev(pooledRates);
  const result: SectorBenchmarkStats = { mean, stdDev, sampleSize: contributingCompanies };

  await supabase.from('sector_benchmark_cache').upsert(
    { sector_tag: sectorTag, mean, std_dev: stdDev, sample_size: contributingCompanies, computed_at: new Date().toISOString() },
    { onConflict: 'sector_tag' },
  );

  return result;
}

// Box-Muller 변환 — 표준 정규분포 샘플을 생성해 mean/stdDev로 스케일
function sampleNormal(mean: number, stdDev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + stdDev * z;
}

function percentile(sortedAsc: number[], p: number): number {
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(p * sortedAsc.length)));
  return sortedAsc[idx];
}

const HISTOGRAM_BINS = 20;

function buildHistogram(values: number[]): number[] {
  const bins = new Array(HISTOGRAM_BINS).fill(0);
  const min  = Math.min(...values);
  const max  = Math.max(...values);
  const range = max - min || 1;

  for (const v of values) {
    let bin = Math.floor(((v - min) / range) * HISTOGRAM_BINS);
    bin = Math.min(HISTOGRAM_BINS - 1, Math.max(0, bin));
    bins[bin]++;
  }
  return bins;
}

/**
 * 정규분포(mean, stdDev)에서 연도별 성장률을 샘플링해 누적 매출 경로를 생성하는
 * 몬테카를로 시뮬레이션. iterations회 반복 후 연도별 P10/P50/P90과
 * 마지막 연도 분포(히스토그램 + 원본 배열)를 반환한다.
 */
export function runRevenueSimulation(params: SimulationParams): SimulationResult {
  const { baseRevenue, mean, stdDev, years = 3, iterations = 10_000 } = params;

  if (!Number.isFinite(baseRevenue) || baseRevenue <= 0) {
    throw new Error('runRevenueSimulation: baseRevenue must be a positive finite number');
  }
  if (!Number.isFinite(mean) || !Number.isFinite(stdDev) || stdDev < 0) {
    throw new Error('runRevenueSimulation: mean/stdDev must be finite, stdDev must be >= 0');
  }
  if (years <= 0 || iterations <= 0) {
    throw new Error('runRevenueSimulation: years/iterations must be positive');
  }

  // yearPaths[y] = 해당 연도의 iterations개 매출 샘플
  const yearPaths: number[][] = Array.from({ length: years }, () => []);

  for (let i = 0; i < iterations; i++) {
    let revenue = baseRevenue;
    for (let y = 0; y < years; y++) {
      const rate = sampleNormal(mean, stdDev);
      revenue = Math.max(0, revenue * (1 + rate));
      yearPaths[y].push(revenue);
    }
  }

  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];

  for (let y = 0; y < years; y++) {
    const sorted = [...yearPaths[y]].sort((a, b) => a - b);
    p10.push(percentile(sorted, 0.10));
    p50.push(percentile(sorted, 0.50));
    p90.push(percentile(sorted, 0.90));
  }

  const finalYearDistribution = yearPaths[years - 1];
  const histogram = buildHistogram(finalYearDistribution);

  return { p10, p50, p90, histogram, finalYearDistribution };
}

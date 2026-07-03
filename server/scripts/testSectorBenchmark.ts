// 스모크 테스트 — (1) 상장사 자체 시계열 경로 재확인, (2) 섹터 벤치마크 폴백 경로 신규 확인.
// 실행: npx ts-node server/scripts/testSectorBenchmark.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  extractRevenueTimeSeries,
  calculateGrowthStats,
  runRevenueSimulation,
  getSectorBenchmarkStats,
} from '../src/services/monteCarloService';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const fmtUsd = (n: number) => `${(n / 1_000_000_000).toFixed(2)}B USD`;
const fmtKrw = (n: number) => `${(n / 1_000_000_000_000).toFixed(2)}조원`;

function printSimResult(label: string, currency: 'KRW' | 'USD', baseRevenue: number, result: ReturnType<typeof runRevenueSimulation>, confidenceLevel: 'high' | 'low') {
  const fmt = currency === 'KRW' ? fmtKrw : fmtUsd;
  console.log(`  기준 매출: ${fmt(baseRevenue)}  confidenceLevel=${confidenceLevel}`);
  for (let y = 0; y < result.p50.length; y++) {
    console.log(`  Year +${y + 1}:  P10=${fmt(result.p10[y])}  P50=${fmt(result.p50[y])}  P90=${fmt(result.p90[y])}`);
  }
  const sane = result.p10.every((v, i) => v <= result.p50[i] && result.p50[i] <= result.p90[i] && v >= 0);
  console.log(`  ${sane ? '✓' : '✗'} 상식성 체크(P10<=P50<=P90, 전부 양수): ${sane}`);
}

// ── 1. 상장사 자체 시계열 경로 (confidenceLevel: high) 재확인 ──────────────────
async function runOwnHistoryPath(companyName: string, source: 'EDGAR' | 'DART', currency: 'KRW' | 'USD') {
  console.log(`\n=== [상장사 경로] ${label(companyName, source)} ===`);

  const col = source === 'EDGAR' ? 'raw_edgar' : 'raw_dart';
  const { data, error } = await supabase
    .from('financial_cache')
    .select(col)
    .eq('company_name', companyName)
    .maybeSingle();

  if (error || !data) {
    console.log(`  ✗ financial_cache 조회 실패: ${error?.message ?? 'no data'}`);
    return;
  }

  const rawData = (data as any)[col];
  const series = extractRevenueTimeSeries(rawData, source);
  if (!series) { console.log('  ✗ extractRevenueTimeSeries → null'); return; }

  const stats = calculateGrowthStats(series);
  if (!stats) { console.log('  ✗ calculateGrowthStats → null'); return; }
  console.log(`  성장률: mean=${(stats.mean * 100).toFixed(1)}%  stdDev=${(stats.stdDev * 100).toFixed(1)}%  dataPoints=${stats.dataPoints}`);

  const baseRevenue = series[series.length - 1].revenue;
  const result = runRevenueSimulation({ baseRevenue, mean: stats.mean, stdDev: stats.stdDev });
  printSimResult('own', currency, baseRevenue, result, 'high');
}

function label(companyName: string, source: string) {
  return `${companyName} (${source})`;
}

// ── 2. 섹터 벤치마크 폴백 경로 (confidenceLevel: low) 신규 확인 ────────────────
async function runSectorBenchmarkPath(sectorTag: string, assumedBaseRevenue: number) {
  console.log(`\n=== [섹터 벤치마크 경로] sectorTag=${sectorTag} ===`);

  const benchmark = await getSectorBenchmarkStats(sectorTag);
  if (!benchmark) {
    console.log(`  ✗ getSectorBenchmarkStats('${sectorTag}') → null (표본 부족)`);
    return;
  }
  console.log(`  섹터 성장률 벤치마크: mean=${(benchmark.mean * 100).toFixed(1)}%  stdDev=${(benchmark.stdDev * 100).toFixed(1)}%  sampleSize=${benchmark.sampleSize}개사`);

  const result = runRevenueSimulation({ baseRevenue: assumedBaseRevenue, mean: benchmark.mean, stdDev: benchmark.stdDev });
  printSimResult('benchmark', 'USD', assumedBaseRevenue, result, 'low');
}

async function main() {
  await runOwnHistoryPath('ADBE', 'EDGAR', 'USD');
  await runOwnHistoryPath('000660', 'DART', 'KRW');

  // 가상 스타트업: 매출 $10M, SAAS 섹터 벤치마크로 시뮬레이션
  await runSectorBenchmarkPath('SAAS', 10_000_000);
}

main().catch(err => {
  console.error('[testSectorBenchmark] Fatal:', err.message);
  process.exit(1);
});

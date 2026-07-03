// 몬테카를로 파이프라인 스모크 테스트 — financial_cache의 실제 raw_edgar/raw_dart로
// extractRevenueTimeSeries → calculateGrowthStats → runRevenueSimulation 전체 실행.
// 실행: npx ts-node server/scripts/testMonteCarlo.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  extractRevenueTimeSeries,
  calculateGrowthStats,
  runRevenueSimulation,
} from '../src/services/monteCarloService';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 조회도 막힘
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const fmtB = (n: number) => `${(n / 1_000_000_000).toFixed(2)}B`;

async function runFor(companyName: string, source: 'EDGAR' | 'DART', label: string) {
  console.log(`\n=== ${label} (${companyName}, ${source}) ===`);

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
  if (!series) {
    console.log('  ✗ extractRevenueTimeSeries → null (데이터 부족)');
    return;
  }
  console.log('  매출 시계열:', series.map(p => `${p.year}: ${fmtB(p.revenue)}`).join('  |  '));

  const stats = calculateGrowthStats(series);
  if (!stats) {
    console.log('  ✗ calculateGrowthStats → null (데이터 부족)');
    return;
  }
  console.log(`  성장률 통계: mean=${(stats.mean * 100).toFixed(1)}%  stdDev=${(stats.stdDev * 100).toFixed(1)}%  dataPoints=${stats.dataPoints}`);

  const baseRevenue = series[series.length - 1].revenue; // 최신 연도 매출을 기준값으로 사용
  const result = runRevenueSimulation({ baseRevenue, mean: stats.mean, stdDev: stats.stdDev, years: 3, iterations: 10_000 });

  console.log(`  기준 매출(최신년도): ${fmtB(baseRevenue)}`);
  for (let y = 0; y < result.p50.length; y++) {
    console.log(`  Year +${y + 1}:  P10=${fmtB(result.p10[y])}  P50=${fmtB(result.p50[y])}  P90=${fmtB(result.p90[y])}`);
  }
  console.log(`  finalYearDistribution 샘플 수: ${result.finalYearDistribution.length}`);
  console.log(`  histogram (20 bins): [${result.histogram.join(', ')}]`);

  // 상식성 체크: P10 <= P50 <= P90, 모두 양수
  const sane = result.p10.every((v, i) => v <= result.p50[i] && result.p50[i] <= result.p90[i] && v >= 0);
  console.log(`  ${sane ? '✓' : '✗'} 상식성 체크(P10<=P50<=P90, 전부 양수): ${sane}`);
}

async function main() {
  await runFor('ADBE', 'EDGAR', 'Adobe');
  await runFor('000660', 'DART', 'SK하이닉스');
}

main().catch(err => {
  console.error('[testMonteCarlo] Fatal:', err.message);
  process.exit(1);
});

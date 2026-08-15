// financial_cache.raw_edgar 캐시 중 depreciation 필드(2026-08-13 EBITDA 서버 조립 작업에서
// EdgarRawSeries에 신규 추가) 없는 옛 blob이 몇 개나 되는지 규모 파악용 1회성 스크립트.
// 확인 후 삭제 예정. 실행: npx ts-node server/scripts/checkFinancialCacheDepreciationCoverage.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { supabase } from '../src/lib/supabase';

async function main() {
  const { count: totalEdgar, error: e1 } = await supabase
    .from('financial_cache')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'EDGAR');
  if (e1) throw e1;

  const { count: totalAll, error: e0 } = await supabase
    .from('financial_cache')
    .select('id', { count: 'exact', head: true });
  if (e0) throw e0;

  console.log(`financial_cache 전체 행: ${totalAll}`);
  console.log(`source='EDGAR' 행: ${totalEdgar}`);

  const PAGE = 1000;
  let offset = 0;
  let scanned = 0;
  let missingDepreciation = 0;
  let hasRawEdgar = 0;
  const missingSample: string[] = [];

  for (;;) {
    const { data, error } = await supabase
      .from('financial_cache')
      .select('company_name, raw_edgar')
      .eq('source', 'EDGAR')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      scanned++;
      const raw = row.raw_edgar as any;
      if (!raw) continue;
      hasRawEdgar++;
      const depr = raw.depreciation;
      const missing = depr === undefined || depr === null;
      if (missing) {
        missingDepreciation++;
        if (missingSample.length < 20) missingSample.push(row.company_name);
      }
    }

    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`\n스캔한 EDGAR 행: ${scanned}`);
  console.log(`raw_edgar 있음: ${hasRawEdgar}`);
  console.log(`depreciation 필드 없음/null (=depreciation 필드 도입 이전 옛 캐시로 추정): ${missingDepreciation}`);
  console.log(`비율: ${hasRawEdgar > 0 ? ((missingDepreciation / hasRawEdgar) * 100).toFixed(1) : 0}%`);
  console.log(`\n샘플(최대 20개):`, missingSample);
}

main().catch(console.error);

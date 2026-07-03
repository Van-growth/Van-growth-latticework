// 해석 문장 생성 단독 스모크 테스트 (Claude API 1회 호출)
// 실행: npx ts-node server/scripts/testNarrative.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { generateGrowthScenarioNarrative } from '../src/lib/claude';

async function main() {
  console.log('=== high confidence (자체 시계열, Adobe 예시 수치) ===');
  const high = await generateGrowthScenarioNarrative('Adobe', {
    simulation: { p10: [26_180_000_000, 28_900_000_000, 31_910_000_000], p50: [26_270_000_000, 29_040_000_000, 32_090_000_000], p90: [26_360_000_000, 29_170_000_000, 32_270_000_000] },
    confidenceLevel: 'high',
    currency: 'USD',
  });
  console.log(high);

  console.log('\n=== low confidence (섹터 벤치마크, SAAS 스타트업 예시 수치) ===');
  const low = await generateGrowthScenarioNarrative('가상의스타트업', {
    simulation: { p10: [9_500_000, 8_700_000, 8_000_000], p50: [11_200_000, 12_500_000, 14_000_000], p90: [15_800_000, 22_000_000, 31_000_000] },
    confidenceLevel: 'low',
    currency: 'USD',
    sectorTag: 'SAAS',
  });
  console.log(low);
}

main().catch(err => { console.error('[testNarrative] Fatal:', err.message); process.exit(1); });

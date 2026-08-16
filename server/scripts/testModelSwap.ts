// claude-sonnet-4-6 → claude-sonnet-5 전환(2026-08-15) 실측 검증용 임시 스크립트 —
// 확인 후 삭제 예정. 골든셋 기업 1개로 analyzeCompany() 전체를 실제로 돌려 새 모델로
// 정상 동작하는지 확인한다 (에러 없이 9개 섹션이 채워지는지 확인).
// 실행: npx ts-node server/scripts/testModelSwap.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany } from '../src/lib/claude';

const COMPANY = 'Johnson & Johnson';

async function main() {
  console.log(`========== ${COMPANY} (model=claude-sonnet-5) ==========`);
  const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(COMPANY);
  console.log('financial source:', source, '| rawEdgar 있음:', !!rawEdgar);

  const analysis = await analyzeCompany(COMPANY, contextText || undefined, undefined, {
    language: 'en',
    rawEdgar,
    rawDart,
  });

  const sections = [
    'summary_v2', 'financials_v2', 'business_model_v2', 'competitors_v2',
    'value_chain_v2', 'strategy_v2', 'founder_v2',
  ] as const;

  console.log('\n===== 섹션별 채움 여부 =====');
  for (const key of sections) {
    const s: any = (analysis as any)[key];
    const hasContent = s && Object.keys(s).length > 0;
    console.log(`${key}: ${hasContent ? 'OK' : 'EMPTY/NULL'}`);
  }

  console.log('\n===== summary_v2.oneLiner =====');
  console.log(analysis.summary_v2?.oneLiner || '(none)');

  console.log('\n===== financials_v2.income_statement (연도/매출만) =====');
  console.log(JSON.stringify(analysis.financials_v2?.income_statement?.[0], null, 2));

  console.log('\n===== sources (요약 탭) =====');
  console.log(JSON.stringify(analysis.sources?.summary?.slice(0, 2), null, 2));

  console.log('\n========== 완료 — 에러 없이 여기까지 도달하면 모델 전환 정상 ==========');
}

main().catch(err => {
  console.error('!!!!! 실패 !!!!!');
  console.error(err);
  process.exit(1);
});

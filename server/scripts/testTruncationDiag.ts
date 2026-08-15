// callSection() stop_reason/output_tokens 로깅 추가(2026-08-15) 실측 검증용 임시
// 스크립트 — 확인 후 삭제 예정. NVIDIA(strategy_v2 6000에서도 재현된 파싱 실패 원인
// 확인)와 Amprius Technologies(요약 탭 빈 화면 재현 여부) 둘을 순서대로 돌린다.
// 원인 판별은 콘솔에 자연히 찍히는 "[claude] {section} FAIL ... (stop_reason=...,
// output_tokens=...)" 로그로 확인 — stop_reason=max_tokens면 진짜 길이초과,
// 아니면 길이와 무관한 JSON 문법 오류.
// 실행: npx ts-node server/scripts/testTruncationDiag.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany } from '../src/lib/claude';

const COMPANIES = ['NVIDIA', 'Amprius Technologies, Inc.'];

async function run(companyName: string) {
  console.log(`\n\n========== ${companyName} ==========`);
  const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(companyName);
  console.log('financial source:', source, '| rawEdgar 있음:', !!rawEdgar);

  const analysis = await analyzeCompany(companyName, contextText || undefined, undefined, {
    language: companyName === 'Amprius Technologies, Inc.' ? 'ko' : 'en',
    rawEdgar,
    rawDart,
  });

  const sections = [
    'summary_v2', 'financials_v2', 'business_model_v2', 'competitors_v2',
    'value_chain_v2', 'strategy_v2', 'founder_v2', 'cross_industry_nudge_v1',
  ] as const;
  console.log(`\n--- ${companyName} 섹션별 실제 콘텐츠 여부 ---`);
  for (const key of sections) {
    const s: any = (analysis as any)[key];
    // 얕은 키 존재가 아니라 실제 대표 필드가 채워졌는지로 판정(이전 회차의 얕은 체크
    // 문제 재발 방지).
    const filled = key === 'summary_v2' ? !!s?.oneLiner
      : key === 'strategy_v2' ? !!s?.strategy_coherence
      : key === 'financials_v2' ? (s?.income_statement?.length > 0)
      : key === 'cross_industry_nudge_v1' ? !!s?.industry_pain?.title
      : (s?.key_bullets?.length > 0);
    console.log(`${key}: ${filled ? 'FILLED' : 'EMPTY/PLACEHOLDER'}`);
  }
  console.log(`summary_v2.oneLiner: "${analysis.summary_v2?.oneLiner ?? ''}"`);
}

async function main() {
  for (const c of COMPANIES) {
    try {
      await run(c);
    } catch (err) {
      console.error(`!!!!! ${c} 처리 중 에러 !!!!!`, err);
    }
  }
  console.log('\n\n========== 전체 완료 ==========');
}

main().catch(console.error);

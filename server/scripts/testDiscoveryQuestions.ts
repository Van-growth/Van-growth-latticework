// discovery_questions 2단계 통합(2026-08-15) 실측 검증용 임시 스크립트 — 확인 후 삭제 예정.
// 골든셋 기업(NVIDIA, Ford Motor)으로 analyzeCompany() 전체를 돌려:
//   1) 9개 섹션의 discovery_questions 원문 출력 (육안으로 발표형 여부 확인)
//   2) financials_v2 벤치마크 이탈 질문이 실제로 생성/부착되는지 확인
//   3) 후보 풀(collectDiscoveryQuestionCandidates) 전체 출력
//   4) ICP 미입력 시 결정론적 선택(pickDefaultDiscoveryQuestions) 결과
//   5) ICP 설정 A/B 두 가지로 curateDiscoveryQuestions() 결과 비교 (실제로 달라지는지)
//   6) cross_industry_nudge_v1.financial_impact_question이 후보 풀/선택 결과에 섞이는지
// 실행: npx ts-node server/scripts/testDiscoveryQuestions.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { fetchFinancialContext } from '../src/lib/financialContext';
import { analyzeCompany, curateDiscoveryQuestions, generateBenchmarkDiscoveryQuestion } from '../src/lib/claude';
import { collectDiscoveryQuestionCandidates, pickDefaultDiscoveryQuestions, DiscoveryQuestionCandidate } from '../src/lib/discoveryQuestions';
import { computeSecBenchmarkDeviations } from '../src/lib/secIndustryBenchmark';

const COMPANIES = ['NVIDIA', 'Ford Motor'];

const SECTION_KEYS = [
  'summary_v2', 'financials_v2', 'business_model_v2', 'competitors_v2',
  'value_chain_v2', 'strategy_v2', 'industry_history_v2', 'tech_evolution_v2', 'founder_v2',
] as const;

const ICP_A = { product: 'CRM software for enterprise sales teams', targetIndustry: 'Financial Services', targetRole: 'VP of Sales' };
const ICP_B = { product: 'Supply chain risk monitoring platform', targetIndustry: 'Manufacturing', targetRole: 'Chief Procurement Officer' };

function printCandidates(label: string, candidates: DiscoveryQuestionCandidate[]) {
  console.log(`\n-- ${label} (${candidates.length}) --`);
  for (const c of candidates) console.log(`  [id ${c.id}] (${c.section}) ${c.question}`);
}

async function testCompany(companyName: string) {
  console.log(`\n\n========== ${companyName} ==========`);

  const { contextText, rawEdgar, rawDart, source } = await fetchFinancialContext(companyName);
  console.log('financial source:', source, '| rawEdgar 있음:', !!rawEdgar, '| rawDart 있음:', !!rawDart);

  console.log('\n[1/6] analyzeCompany() 전체 실행 중...');
  const analysis = await analyzeCompany(companyName, contextText || undefined, undefined, {
    language: 'en',
    rawEdgar,
    rawDart,
  });

  console.log('\n===== [2/6] 9개 섹션 discovery_questions 원문 =====');
  for (const key of SECTION_KEYS) {
    const dq = (analysis as any)[key]?.discovery_questions ?? [];
    console.log(`\n--- ${key} (${dq.length}) ---`);
    if (dq.length === 0) console.log('  (empty)');
    dq.forEach((q: string, i: number) => console.log(`  ${i + 1}. ${q}`));
  }
  console.log('\n--- cross_industry_nudge_v1.industry_pain.financial_impact_question ---');
  console.log('  ' + (analysis.cross_industry_nudge_v1?.industry_pain?.financial_impact_question || '(none)'));

  console.log('\n===== [3/6] financials_v2 벤치마크 이탈 질문 =====');
  console.log('financials_v2.discovery_questions (callSection 직후, 벤치마크 부착 전):');
  (analysis.financials_v2.discovery_questions ?? []).forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
  if (rawEdgar) {
    const deviations = await computeSecBenchmarkDeviations(rawEdgar);
    console.log('computeSecBenchmarkDeviations() 결과:', JSON.stringify(deviations, null, 2));
    if (deviations?.status === 'compared' && deviations.items?.length) {
      const benchmarkQuestion = await generateBenchmarkDiscoveryQuestion(companyName, deviations.sicCode, deviations.items, 'en');
      console.log('generateBenchmarkDiscoveryQuestion() 결과:', benchmarkQuestion);
      if (benchmarkQuestion) {
        analysis.financials_v2.discovery_questions = [benchmarkQuestion, ...(analysis.financials_v2.discovery_questions ?? [])].slice(0, 5);
      }
      console.log('부착 후 financials_v2.discovery_questions:');
      (analysis.financials_v2.discovery_questions ?? []).forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    } else {
      console.log('벤치마크 이탈 없음(±30% 미만) 또는 표본 부족 — 이 기업은 벤치마크 질문 부착 대상 아님(정상 동작).');
    }
  } else {
    console.log('rawEdgar 없음 — SEC 벤치마크 대상 아님(정상, EDGAR 소스 전용 기능).');
  }

  const candidates = collectDiscoveryQuestionCandidates(analysis as any);
  printCandidates('[4/6] 전체 후보 풀 (collectDiscoveryQuestionCandidates)', candidates);
  const nudgeInPool = candidates.some(c => c.section === 'cross_industry_nudge_v1');
  console.log(`\n[6/6] cross_industry_nudge_v1 후보 풀 포함 여부: ${nudgeInPool ? 'YES' : 'NO (financial_impact_question 비어있었을 가능성)'}`);

  const deterministic = pickDefaultDiscoveryQuestions(candidates, analysis.financials_v2);
  printCandidates('[5/6] ICP 미입력 — 결정론적 선택 결과', deterministic);

  console.log('\n[5/6] ICP A/B 큐레이션 비교 중 (Claude 호출 2회)...');
  const curatedA = await curateDiscoveryQuestions(companyName, candidates, ICP_A, 'en');
  const curatedB = await curateDiscoveryQuestions(companyName, candidates, ICP_B, 'en');

  console.log(`\n-- ICP A: ${JSON.stringify(ICP_A)} --`);
  curatedA?.forEach(c => {
    const orig = candidates.find(cand => cand.id === c.id);
    console.log(`  [id ${c.id}, section=${orig?.section}] ${c.question}`);
  });

  console.log(`\n-- ICP B: ${JSON.stringify(ICP_B)} --`);
  curatedB?.forEach(c => {
    const orig = candidates.find(cand => cand.id === c.id);
    console.log(`  [id ${c.id}, section=${orig?.section}] ${c.question}`);
  });

  const idsA = new Set((curatedA ?? []).map(c => c.id));
  const idsB = new Set((curatedB ?? []).map(c => c.id));
  const sameIds = idsA.size === idsB.size && [...idsA].every(id => idsB.has(id));
  console.log(`\nICP A vs B 선택된 후보 id 집합 동일 여부: ${sameIds ? 'SAME (문구만 다를 수 있음)' : 'DIFFERENT (선택 자체가 달라짐)'}`);

  const nudgeSelectedA = (curatedA ?? []).some(c => candidates.find(cand => cand.id === c.id)?.section === 'cross_industry_nudge_v1');
  const nudgeSelectedB = (curatedB ?? []).some(c => candidates.find(cand => cand.id === c.id)?.section === 'cross_industry_nudge_v1');
  const nudgeSelectedDefault = deterministic.some(c => c.section === 'cross_industry_nudge_v1');
  console.log(`cross_industry_nudge_v1이 최종 선택에 포함된 경우: A=${nudgeSelectedA} B=${nudgeSelectedB} default=${nudgeSelectedDefault}`);
}

async function main() {
  for (const companyName of COMPANIES) {
    try {
      await testCompany(companyName);
    } catch (err) {
      console.error(`\n\n!!!!! ${companyName} 처리 중 에러 !!!!!`);
      console.error(err);
      const msg = (err as Error)?.message ?? '';
      if (/usage limit|rate limit|quota|billing/i.test(msg)) {
        console.error('\n[STOP] Anthropic API 사용량/레이트 한도로 보임 — 이후 기업 스킵.');
        break;
      }
    }
  }
  console.log('\n\n========== 전체 완료 ==========');
}

main().catch(console.error);

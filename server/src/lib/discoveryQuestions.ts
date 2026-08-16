// ICP 인사이트 탭 2단계 통합(2026-08-15)용 discovery_questions 후보 풀 수집 —
// 이전의 5카테고리 신호 수집(icpSignals.ts, financial/investment/technology/competitive/
// market)을 대체한다. 이제 각 섹션(summary_v2 등 9개)이 자체 프롬프트에서 이미
// discovery_questions를 생성해두므로, 여기서는 그걸 그대로 모으기만 하는 순수 함수다 —
// 신규 web_search나 Claude 호출 없음.
import type {
  SummaryV2,
  FinancialsV2,
  BusinessModelV2,
  CompetitorsV2,
  ValueChainV2,
  StrategyV2,
  IndustryHistoryV2,
  TechEvolutionV2,
  FounderV2,
  CrossIndustryNudgeV1,
  SectionSource,
} from './claude';

export interface DiscoveryQuestionCandidate {
  id: number;
  section: string;
  question: string;
  sources: SectionSource[];
}

interface DiscoveryQuestionInput {
  summary_v2?: SummaryV2 | null;
  financials_v2?: FinancialsV2 | null;
  business_model_v2?: BusinessModelV2 | null;
  competitors_v2?: CompetitorsV2 | null;
  value_chain_v2?: ValueChainV2 | null;
  strategy_v2?: StrategyV2 | null;
  industry_history_v2?: IndustryHistoryV2 | null;
  tech_evolution_v2?: TechEvolutionV2 | null;
  founder_v2?: FounderV2 | null;
  cross_industry_nudge_v1?: CrossIndustryNudgeV1 | null;
}

// 섹션 노출 순서 — pickDefaultDiscoveryQuestions()가 ICP 없을 때 이 순서를 그대로
// 우선순위(summary_v2부터)로 사용한다.
const SECTION_ORDER: Array<Exclude<keyof DiscoveryQuestionInput, 'cross_industry_nudge_v1'>> = [
  'summary_v2', 'financials_v2', 'business_model_v2', 'competitors_v2',
  'value_chain_v2', 'strategy_v2', 'industry_history_v2', 'tech_evolution_v2', 'founder_v2',
];

// 9개 섹션의 discovery_questions + cross_industry_nudge_v1의 financial_impact_question을
// 하나의 후보 풀로 모은다. id는 이 함수가 순서대로 매기는 안정적인 참조키 — 2단계
// 큐레이션(curateDiscoveryQuestions)이 "이 id들 중에서만 골라라"라고 강제하는 근거가 된다.
export function collectDiscoveryQuestionCandidates(analysis: DiscoveryQuestionInput): DiscoveryQuestionCandidate[] {
  const candidates: DiscoveryQuestionCandidate[] = [];
  let nextId = 1;

  for (const section of SECTION_ORDER) {
    const data = analysis[section];
    for (const question of data?.discovery_questions ?? []) {
      const trimmed = question?.trim();
      if (!trimmed) continue;
      candidates.push({ id: nextId++, section, question: trimmed, sources: data?.sources ?? [] });
    }
  }

  // market 트리거(기존 5카테고리 중 유일하게 전용 discovery_questions 배열이 없는 섹션) —
  // cross_industry_nudge_v1은 이미 industry_pain.financial_impact_question이라는 질문형
  // 필드를 갖고 있어 그대로 후보 1개로 재사용한다(ponytail: 이미 있으면 재사용, 새 필드
  // 추가 안 함).
  const nudge = analysis.cross_industry_nudge_v1;
  const nudgeQuestion = nudge?.industry_pain?.financial_impact_question?.trim();
  if (nudgeQuestion) {
    candidates.push({ id: nextId++, section: 'cross_industry_nudge_v1', question: nudgeQuestion, sources: nudge?.sources ?? [] });
  }

  return candidates;
}

function hasFinancialBenchmarkDeviation(financials: FinancialsV2 | null | undefined): boolean {
  return financials?.sec_benchmark_comparison?.status === 'compared'
    && (financials.sec_benchmark_comparison.items?.length ?? 0) > 0;
}

// 섹션당 상한 — 각 섹션의 discovery_questions 생성 프롬프트가 이미 3-5개로 제한하므로
// 이 값은 방어적 상한(생성 단계가 어겼을 때의 안전망)일 뿐, 정상 동작에서는 거의 항상
// 섹션이 만든 개수 그대로 통과한다. 2026-08-17 UX 피드백 — 이전엔 전체 총량을 5개로
// 캡해서 9개 섹션이 만든 후보 풀(최대 ~45개)이 최종 화면에서는 항상 5개로 뭉개졌음
// (섹션별 3-5개 설계가 최종 노출 단계에서 지켜지지 않던 버그) → 전체 캡을 없애고
// 섹션별 캡만 적용하도록 전환.
const PER_SECTION_MAX = 5;

// curateDiscoveryQuestions()(claude.ts)도 Claude 응답 후 동일한 방어적 상한을 적용하려고
// export — 섹션별 캡 기준을 두 곳에서 다르게 두지 않기 위함. section 필드만 있으면 되므로
// 전체 DiscoveryQuestionCandidate 형태를 강제하지 않는 제네릭으로 둔다(claude.ts 호출부는
// sources 필드가 없는 축약된 형태를 넘긴다).
export function capPerSection<T extends { section: string }>(candidates: T[]): T[] {
  const seenPerSection = new Map<string, number>();
  const result: T[] = [];
  for (const c of candidates) {
    const count = seenPerSection.get(c.section) ?? 0;
    if (count >= PER_SECTION_MAX) continue;
    seenPerSection.set(c.section, count + 1);
    result.push(c);
  }
  return result;
}

// ICP(icp_product/icp_target_industry/icp_target_role)가 전부 비어있을 때(선택 입력이라
// 흔한 경우) Claude 큐레이션 호출 없이 결정론적으로 고른다 — 불필요한 Claude 호출을
// 피하는 게 이 코드베이스의 기존 원칙(제로 유저 레이버 원칙과 동일 계열)과 맞다. 전체
// 총량 캡은 없음(섹션별 캡만) — 우선순위: 재무 벤치마크 이탈 플래그가 있으면
// financials_v2 후보를 앞으로 당기고, 없으면 SECTION_ORDER(summary_v2부터) 그대로.
export function pickDefaultDiscoveryQuestions(
  candidates: DiscoveryQuestionCandidate[],
  financials_v2: FinancialsV2 | null | undefined,
): DiscoveryQuestionCandidate[] {
  if (candidates.length === 0) return [];
  const prioritized = hasFinancialBenchmarkDeviation(financials_v2)
    ? [...candidates].sort((a, b) => (a.section === 'financials_v2' ? 0 : 1) - (b.section === 'financials_v2' ? 0 : 1))
    : candidates;
  return capPerSection(prioritized);
}

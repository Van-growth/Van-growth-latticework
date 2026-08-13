import type {
  FinancialsV2,
  SummaryV2,
  TechEvolutionV2,
  CompetitorsV2,
  CrossIndustryNudgeV1,
} from './claude';

export type IcpSignalCategory = 'financial' | 'investment' | 'technology' | 'competitive' | 'market';

export interface IcpSignal {
  category: IcpSignalCategory;
  hasSignal: boolean;
  rawData: unknown;
}

interface IcpSignalInput {
  financials_v2?: FinancialsV2 | null;
  summary_v2?: SummaryV2 | null;
  tech_evolution_v2?: TechEvolutionV2 | null;
  competitors_v2?: CompetitorsV2 | null;
  cross_industry_nudge_v1?: CrossIndustryNudgeV1 | null;
}

// ICP 인사이트용 신호 5종 수집 — 이미 생성된 analyses 행에서 추출만 한다(신규 web_search나
// Claude 호출 없음, 순수 함수). 카테고리별 함의(무슨 뜻인지)는 여기서 만들지 않고 프롬프트
// 단계(ICP_INSIGHT_SYSTEM)에서 "사실이 아니라 결과(consequence)"로 그때그때 합성한다 — 미리
// 만든 카테고리별 템플릿 라이브러리를 두지 않기로 확정한 설계(ponytail 원칙, CLAUDE.md
// "ICP 맞춤형 인사이트 탭" 백로그 항목 참고).
export function collectIcpSignals(analysis: IcpSignalInput): IcpSignal[] {
  const financialDeviations = analysis.financials_v2?.sec_benchmark_comparison?.status === 'compared'
    ? (analysis.financials_v2.sec_benchmark_comparison.items ?? [])
    : [];

  const triggerEvents = analysis.summary_v2?.trigger_events ?? [];

  const industryPain = analysis.cross_industry_nudge_v1?.industry_pain ?? null;
  const industryPainDescription = industryPain?.description ?? [];
  // cross_industry_example(타산업 해결사례)은 hasSignal 판정에는 관여하지 않는 보조 필드 —
  // industry_pain이 메인 신호라는 원칙 유지, description이 비어있으면 example만 있어도 스킵.
  const crossIndustryExample = analysis.cross_industry_nudge_v1?.cross_industry_example ?? null;

  return [
    {
      category: 'financial',
      hasSignal: financialDeviations.length > 0,
      rawData: financialDeviations,
    },
    {
      category: 'investment',
      hasSignal: triggerEvents.length > 0,
      rawData: triggerEvents,
    },
    {
      category: 'technology',
      hasSignal: analysis.tech_evolution_v2 != null,
      rawData: analysis.tech_evolution_v2 ?? null,
    },
    {
      // 배치2 필수 필드라 정상 완료된 분석이면 항상 존재 — 스킵 조건 없음(설계 스펙 그대로).
      // null 방어만 유지(analysis.competitors_v2 자체가 없는 비정상 케이스 대비).
      category: 'competitive',
      hasSignal: analysis.competitors_v2 != null,
      rawData: analysis.competitors_v2 ?? null,
    },
    {
      category: 'market',
      hasSignal: industryPainDescription.length > 0,
      rawData: { industry_pain: industryPain, cross_industry_example: crossIndustryExample },
    },
  ];
}

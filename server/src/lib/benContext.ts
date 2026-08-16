// "Ben" 채팅 어시스턴트의 시스템 프롬프트 구성 — 정적 톤/역할 규칙과 분석별 데이터를
// 별도의 두 캐시 블록으로 나눈다(callSection()의 단일 캐시 블록 패턴의 자연스러운 확장 —
// Ben은 정적 규칙(절대 안 바뀜) + 분석 데이터(그 분석을 보는 동안은 고정, 대화마다 안 바뀜)
// 라는 두 층의 정적성을 갖는 첫 호출부라 브레이크포인트 2개가 필요하다).
import type {
  Language,
  SummaryV2, IndustryHistoryV2, TechEvolutionV2, ValueChainV2, BusinessModelV2,
  CompetitorsV2, StrategyV2, FinancialsV2, FounderV2,
} from './claude';

export interface BenAnalysisRow {
  summary_v2: SummaryV2 | null;
  industry_history_v2: IndustryHistoryV2 | null;
  tech_evolution_v2: TechEvolutionV2 | null;
  value_chain_v2: ValueChainV2 | null;
  business_model_v2: BusinessModelV2 | null;
  competitors_v2: CompetitorsV2 | null;
  strategy_v2: StrategyV2 | null;
  financials_v2: FinancialsV2 | null;
  founder_v2: FounderV2 | null;
  purpose_category: string | null;
  purpose_detail: string | null;
  language: string | null;
}

const BEN_TONE: Record<Language, string> = {
  en: 'Answer in English.',
  ko: 'Answer in Korean (한국어로 답변) — keep company/technology names and tickers in their original form.',
};

// sectionSystem()(callSection() 공용 시스템 프롬프트)의 [Tone & voice] 규칙을 그대로 계승 —
// 이 앱 전체의 콘텐츠 원칙(투자자 언어 금지, Bull/Bear 대신 성장 모멘텀/핵심 리스크)이
// 채팅에서도 깨지지 않게 한다.
export function benStaticSystem(language: Language): string {
  return `You are Ben — a sharp, no-fluff analyst embedded in a company research report on 1min. A user is reading the report and asking you questions about it.

${BEN_TONE[language]}

[Grounding — non-negotiable]
Answer only using the analysis data provided in the next system block (and anything the user says earlier in this conversation). If something isn't covered by that data, say so plainly rather than inventing an answer or reasoning from general knowledge about the company. Never present an outside guess as if it came from the report.

[Tone & voice]
Write like a sharp US B2B practitioner — Sales, BD, or Strategy — briefing a peer, not like an equity research report. Aim for Gong / HubSpot / Salesforce blog voice, not McKinsey deck voice.
- Investor vocabulary stays banned: no "valuation multiple," no "P/E," no ROE/ROIC/owner-earnings framing, no stock-price talk.
- No Bull/Bear framing — talk in terms of growth momentum and core risks instead.
- No academic or overly formal tone. Skip hedges like "it can be argued that" or "it is worth noting that."

[Chat-specific rules]
- This is a chat, not another report section — keep answers concise (a few sentences to a short paragraph, or a tight bulleted list when the question calls for a breakdown). Don't pad with restated context the user already has open in the report.
- Markdown is fine (bullets, bold, short headers) but don't overuse it.
- If asked something outside a company-research scope entirely (unrelated small talk, requests to write unrelated content), redirect back to what you can help with — analyzing this company.`;
}

function joinNonEmpty(items: (string | null | undefined)[]): string {
  return items.filter((s): s is string => !!s && s.trim().length > 0).join('\n');
}

function serializeSection<T extends { sources?: unknown } | null>(label: string, section: T): string {
  if (!section) return '';
  // sources[]는 채팅 그라운딩에 불필요한 인용 메타데이터(URL 등)라 컨텍스트 크기만
  // 늘린다 — 캐시 블록에서 의도적으로 제외.
  const { sources: _sources, ...rest } = section as Record<string, unknown>;
  if (Object.keys(rest).length === 0) return '';
  return `## ${label}\n${JSON.stringify(rest, null, 1)}`;
}

// 분석별 데이터 블록 — 대화 세션 내내 고정이라 별도 cache_control 브레이크포인트 대상
// (routes/ben.ts에서 이 문자열에 cache_control을 건다).
export function buildBenAnalysisContext(companyName: string, analysis: BenAnalysisRow): string {
  const sections = joinNonEmpty([
    serializeSection('Summary', analysis.summary_v2),
    serializeSection('Value Chain', analysis.value_chain_v2),
    serializeSection('Business Model', analysis.business_model_v2),
    serializeSection('Competitors', analysis.competitors_v2),
    serializeSection('Financials', analysis.financials_v2),
    serializeSection('Strategy', analysis.strategy_v2),
    serializeSection('Founder', analysis.founder_v2),
    serializeSection('Industry History', analysis.industry_history_v2),
    serializeSection('Tech Evolution', analysis.tech_evolution_v2),
  ]);

  const purposeLine = analysis.purpose_category
    ? `[Reader's stated purpose for this analysis]\ncategory: ${analysis.purpose_category}${analysis.purpose_detail ? `\ndetail: ${analysis.purpose_detail}` : ''}\n`
    : '';

  return `[Company being analyzed]\n${companyName}\n\n${purposeLine}[Analysis data]\n${sections || '(no section data available yet)'}`;
}

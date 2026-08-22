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

// 관리자 대시보드 전용 Ben — /api/admin/insights/ask. 리포트를 보는 일반 유저나 특정
// 한 명을 보는 게 아니라(2026-08-22, 개별 유저 채팅은 폐기됨 — 아래 참고), 관리자
// (sg.van.p@gmail.com, profiles.role='admin')가 /admin 경로에서 Ben 런처를 열었을 때
// 전체 유저 집계를 묻는 용도라 톤/그라운딩 지시가 benStaticSystem()과 다르다.
export function benAdminAggregateSystem(): string {
  return `You are Ben, acting as an internal analyst for the admin of 1min (a company-research product). The admin is looking at the /admin/users dashboard and asking you questions about the overall user base — not any single user.

Answer in Korean (한국어로 답변) — the admin operates in Korean.

[Grounding — non-negotiable]
Answer only using the aggregate statistics provided in the next system block (and anything the admin said earlier in this conversation). If something isn't covered by that data, say so plainly rather than guessing. This context intentionally contains no individual user data (no emails, no names) — never invent or imply a per-user detail.

[Tone]
Direct and concise, like a product analyst briefing the founder — no fluff, no hedging. Use the exact numbers given rather than vague approximations when an exact figure is available.

[Scope]
This is strictly an internal diagnostic tool for understanding aggregate user behavior (plan mix, purpose/industry/org-size mix, signup trend, analysis activity, popular companies). Don't discuss individual users, and don't answer questions unrelated to this user base.`;
}

export interface BenAdminAggregateProfileRow {
  id: string;
  created_at: string | null;
  is_premium_override: boolean | null;
  purpose: string[] | null;
  industry: string | null;
  org_size: string | null;
}

export interface BenAdminAggregateUsageRow {
  user_id: string;
  analysis_target: string;
  is_cache_view: boolean;
}

function distributionText(counts: Map<string, number>): string {
  const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}명`).join(', ') : '(데이터 없음)';
}

// 관리자 집계 컨텍스트 블록 — 개인정보(이메일 등) 없이 전체 유저 통계만 직렬화.
// 분석 0회 판정은 GET /api/admin/users/stats의 zeroAnalysisCount/Rate와 동일 정의
// (analysis_usage.is_cache_view=false 행이 하나도 없는 유저) — 이 프로젝트에서 이미
// "analysisCount 정의는 항상 이 필터로 통일"이 원칙으로 확정돼 있다(2026-08-22
// vans.mba1@gmail.com 실측으로 발견된 불일치 수정 때 재확인).
export function buildBenAdminAggregateContext(
  profiles: BenAdminAggregateProfileRow[],
  usageRows: BenAdminAggregateUsageRow[],
): string {
  const total = profiles.length;
  const premiumCount = profiles.filter(p => p.is_premium_override).length;
  const freeCount = total - premiumCount;

  const purposeCounts = new Map<string, number>();
  const industryCounts = new Map<string, number>();
  const orgSizeCounts = new Map<string, number>();
  for (const p of profiles) {
    for (const purpose of p.purpose ?? []) purposeCounts.set(purpose, (purposeCounts.get(purpose) ?? 0) + 1);
    if (p.industry) industryCounts.set(p.industry, (industryCounts.get(p.industry) ?? 0) + 1);
    if (p.org_size) orgSizeCounts.set(p.org_size, (orgSizeCounts.get(p.org_size) ?? 0) + 1);
  }

  const realAnalysisUserIds = new Set(usageRows.filter(r => !r.is_cache_view).map(r => r.user_id));
  const zeroAnalysisCount = profiles.filter(p => !realAnalysisUserIds.has(p.id)).length;
  const zeroAnalysisRate = total > 0 ? Math.round((zeroAnalysisCount / total) * 1000) / 10 : 0; // %, 소수 1자리

  const now = Date.now();
  const last7d = profiles.filter(p => p.created_at && now - new Date(p.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const last30d = profiles.filter(p => p.created_at && now - new Date(p.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000).length;

  // 인기 검색 기업은 캐시 조회 포함 전체 활동 기준(순수 "관심도" 지표) — 위
  // zeroAnalysisCount만 엄격한 is_cache_view=false 정의를 따른다.
  const companyCounts = new Map<string, number>();
  for (const r of usageRows) companyCounts.set(r.analysis_target, (companyCounts.get(r.analysis_target) ?? 0) + 1);
  const topCompaniesText = Array.from(companyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => `- ${name}: ${count}회`)
    .join('\n') || '(데이터 없음)';

  return `[Aggregate user stats — 개인정보(이메일 등) 미포함, 전체 집계만]
전체 유저: ${total}명
프리미엄: ${premiumCount}명 / 무료: ${freeCount}명
최근 7일 신규가입: ${last7d}명 / 최근 30일 신규가입: ${last30d}명
분석 0회 유저: ${zeroAnalysisCount}명 (${zeroAnalysisRate}%) — 신규분석/재분석 기준(캐시 조회 제외)

[목적별 분포]
${distributionText(purposeCounts)}

[산업별 분포]
${distributionText(industryCounts)}

[조직 규모별 분포]
${distributionText(orgSizeCounts)}

[인기 검색 기업 Top 10 — 캐시 조회 포함]
${topCompaniesText}`;
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

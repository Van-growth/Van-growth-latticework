import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types (V2 schema) ─────────────────────────────────────────────────────────

export interface Source {
  url: string;
  title: string;
}

export interface AnalysisSources {
  summary?: Source[];
  industry_history?: Source[];
  tech_evolution?: Source[];
  value_chain?: Source[];
  business_model?: Source[];
  competitors?: Source[];
  strategy?: Source[];
  financials?: Source[];
}

export interface SummaryV2 {
  company: string;
  ticker: string | null;
  industry: string;
  hq: string;
  value_chain_position: 'upstream' | 'midstream' | 'downstream';
  products: { name: string; revenue_share: number }[];
  key_metrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[];
  top_customers: string[];
  key_markets: { country: string; revenue_share: number }[];
  one_line: string;
  bull_case: string;
  bear_case: string;
}

export interface IndustryHistoryV2 {
  industry_name: string;
  timeline: {
    period: string;
    title: string;
    technology: string;
    market_need: string;
    key_players: string[];
    significance: string;
  }[];
  why_durable: string;
  chasm_points: string[];
}

export interface TechEvolutionV2 {
  tech_name: string;
  stages: {
    stage: number;
    period: string;
    title: string;
    description: string;
    hype_level: 'emerging' | 'hype' | 'trough' | 'recovery' | 'mainstream';
    key_enablers: string[];
    key_players: string[];
  }[];
  current_stage: string;
  next_inflection: string;
}

export interface ValueChainLayerLeader {
  name: string;
  country: string;
  why_leader: string;
}

export interface ValueChainLayer {
  name: string;
  description: string;
  is_subject: boolean;
  pricing_power: 'high' | 'medium' | 'low';
  bottleneck: boolean;
  global_leaders: ValueChainLayerLeader[];
}

export interface ValueChainV2 {
  industry: string;
  layers: ValueChainLayer[];
  value_flow: string;
  subject_position: string;
}

export interface RevenueStream {
  name: string;
  type: 'subscription' | 'transaction' | 'service' | 'license' | 'other';
  revenue_share: number;
  operating_margin: number;
  growth_rate: number;
}

export interface BusinessSegment {
  name: string;
  revenue_share: number;
  characteristics: string;
}

export interface MoatV2 {
  type: string;
  strength: 'strong' | 'medium' | 'weak';
  description: string;
}

export interface BusinessModelV2 {
  revenue_streams: RevenueStream[];
  segments: BusinessSegment[];
  growth_motion: 'PLG' | 'SLG' | 'FLG' | 'hybrid';
  growth_motion_detail: string;
  unit_economics: {
    gross_margin: number;
    operating_margin: number;
    net_margin: number;
    fcf_margin: number;
    nrr: number;
  };
  moat: MoatV2[];
}

export interface DirectCompetitorV2 {
  name: string;
  country: string;
  market_share: string;
  strengths: string[];
  weaknesses: string[];
  vs_subject: string;
}

export interface CompetitorsV2 {
  direct: DirectCompetitorV2[];
  indirect: { name: string; threat: string }[];
  substitutes: { name: string; threat: string }[];
  competitive_position: 'leader' | 'challenger' | 'niche' | 'follower';
}

export interface StrategyV2 {
  corporate: {
    direction: string;
    portfolio: string;
    ma_partnerships: string[];
    geographic: string;
  };
  business: {
    direction: string;
    competitive_advantage: string;
    go_to_market: string;
    product_roadmap: string[];
  };
  financial: {
    direction: string;
    capital_allocation: string;
    investment_priority: string;
    return_target: string;
  };
  strategy_coherence: string;
  ten_year_durability: string;
}

export interface FinancialsV2Row {
  item: string;
  fy2021?: string;
  fy2022?: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
  yoy?: string;
}

export interface FinancialsV2BSRow {
  item: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
}

export interface FinancialsV2 {
  narrative: string;
  income_statement: FinancialsV2Row[];
  balance_sheet: FinancialsV2BSRow[];
  cash_flow: {
    operating: string;
    investing: string;
    financing: string;
    fcf: string;
    notes: string;
  };
  munger_buffett_metrics: {
    roe: string;
    roic: string;
    owner_earnings: string;
    debt_to_equity: string;
    interest_coverage: string;
    reinvestment_rate: string;
  };
  key_risks: string[];
}

export interface AnalysisData {
  summary_v2: SummaryV2;
  industry_history_v2: IndustryHistoryV2;
  tech_evolution_v2: TechEvolutionV2;
  value_chain_v2: ValueChainV2;
  business_model_v2: BusinessModelV2;
  competitors_v2: CompetitorsV2;
  strategy_v2: StrategyV2;
  financials_v2: FinancialsV2;
  sources: AnalysisSources;
}

export interface LinkedInDraft {
  draft_number: number;
  content: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ANALYSIS_DATA: AnalysisData = {
  summary_v2: {
    company: '', ticker: null, industry: '', hq: '',
    value_chain_position: 'midstream',
    products: [], key_metrics: [], top_customers: [], key_markets: [],
    one_line: '', bull_case: '', bear_case: '',
  },
  industry_history_v2: { industry_name: '', timeline: [], why_durable: '', chasm_points: [] },
  tech_evolution_v2: { tech_name: '', stages: [], current_stage: '', next_inflection: '' },
  value_chain_v2: { industry: '', layers: [], value_flow: '', subject_position: '' },
  business_model_v2: {
    revenue_streams: [], segments: [],
    growth_motion: 'hybrid', growth_motion_detail: '',
    unit_economics: { gross_margin: 0, operating_margin: 0, net_margin: 0, fcf_margin: 0, nrr: 0 },
    moat: [],
  },
  competitors_v2: { direct: [], indirect: [], substitutes: [], competitive_position: 'niche' },
  strategy_v2: {
    corporate: { direction: '', portfolio: '', ma_partnerships: [], geographic: '' },
    business: { direction: '', competitive_advantage: '', go_to_market: '', product_roadmap: [] },
    financial: { direction: '', capital_allocation: '', investment_priority: '', return_target: '' },
    strategy_coherence: '', ten_year_durability: '',
  },
  financials_v2: {
    narrative: '',
    income_statement: [], balance_sheet: [],
    cash_flow: { operating: '', investing: '', financing: '', fcf: '', notes: '' },
    munger_buffett_metrics: { roe: '', roic: '', owner_earnings: '', debt_to_equity: '', interest_coverage: '', reinvestment_rate: '' },
    key_risks: [],
  },
  sources: {},
};

// ── Low-level helpers ─────────────────────────────────────────────────────────

const WEB_SEARCH_TOOL = [{ type: 'web_search_20250305', name: 'web_search' }] as any;

async function runWithWebSearch(
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxRounds = 10,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt,
      tools: WEB_SEARCH_TOOL,
      messages,
    });

    const texts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n\n');

    if (response.stop_reason === 'end_turn') return texts;

    messages.push({ role: 'assistant', content: response.content });

    const toolResults = (response.content as Anthropic.ContentBlock[])
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ type: 'tool_result' as const, tool_use_id: b.id }));

    if (toolResults.length > 0) {
      messages.push({ role: 'user', content: toolResults });
    } else if (texts) {
      return texts;
    }
  }

  throw new Error('Max conversation rounds exceeded');
}

function extractJson<T>(raw: string, label = 'response'): T | null {
  const text = raw.trim();

  try { return JSON.parse(text) as T; } catch {}

  const fenced = text.match(/```(?:json|typescript|js)?\s*\n?([\s\S]*?)\n?```/s);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    try { return JSON.parse(inner) as T; } catch {}
    const innerBlock = inner.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (innerBlock) {
      try { return JSON.parse(innerBlock[0]) as T; } catch {}
    }
  }

  const block = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (block) {
    try { return JSON.parse(block[0]) as T; } catch {}
  }

  console.error(`[claude] ${label}: JSON parse failed. Preview:\n${text.slice(0, 400)}`);
  return null;
}

// ── Section prompts ───────────────────────────────────────────────────────────

const SECTION_SYSTEM = `당신은 전문 기업 분석가입니다. 제공된 리서치 데이터를 바탕으로 지정된 섹션만 분석합니다.
규칙: 마크다운·코드블록·추가 설명 없이 순수 JSON만 출력. 모든 텍스트는 한국어 (기업명·기술명·티커는 원어 유지). 불확실한 수치는 "추정 불가"로 명시.`;

const SECTION_SCHEMAS: Record<string, string> = {
  summary_v2: `아래 스키마의 JSON 객체만 출력:
{"company":"기업명","ticker":"티커 or null","industry":"산업분류","hq":"본사 도시, 국가","value_chain_position":"upstream|midstream|downstream","products":[{"name":"제품명","revenue_share":숫자}],"key_metrics":[{"label":"매출","value":"수치","trend":"up|down|flat"},{"label":"영업이익률","value":"수치%","trend":"up|down|flat"},{"label":"시가총액","value":"수치","trend":"up|down|flat"},{"label":"YoY 성장률","value":"수치%","trend":"up|down|flat"}],"top_customers":["고객사명 최대5개"],"key_markets":[{"country":"국가","revenue_share":숫자}],"one_line":"투자자 관점 핵심 한줄 20자이내","bull_case":"강세 시나리오 2줄이내","bear_case":"약세 시나리오 2줄이내"}`,

  industry_history_v2: `아래 스키마의 JSON 객체만 출력:
{"industry_name":"산업명","timeline":[{"period":"시기","title":"시대제목 15자이내","technology":"핵심기술 1줄","market_need":"시장수요 1줄","key_players":["기업명(국가)"],"significance":"중요성 1줄"}],"why_durable":"지속가능이유 2줄이내","chasm_points":["캐즘시점과이유 1줄 최대3개"]}
timeline은 연대순 4~6개.`,

  tech_evolution_v2: `아래 스키마의 JSON 객체만 출력:
{"tech_name":"핵심기술명","stages":[{"stage":1,"period":"시기","title":"단계제목 15자이내","description":"설명 2줄이내","hype_level":"emerging|hype|trough|recovery|mainstream","key_enablers":["핵심요인 최대3개"],"key_players":["기업명 최대4개"]}],"current_stage":"현재단계 1줄","next_inflection":"다음변곡점 1줄"}
stages는 4~6개.`,

  value_chain_v2: `아래 스키마의 JSON 객체만 출력:
{"industry":"산업명","layers":[{"name":"레이어명","description":"설명 1줄","is_subject":false,"pricing_power":"high|medium|low","bottleneck":false,"global_leaders":[{"name":"기업명","country":"국가","why_leader":"선도이유 1줄"}]}],"value_flow":"가격전가메커니즘 2줄이내","subject_position":"분석기업 포지션 2줄이내"}
layers는 4~6개. 분석 대상 기업이 속한 레이어에 is_subject:true 설정.`,

  business_model_v2: `아래 스키마의 JSON 객체만 출력:
{"revenue_streams":[{"name":"수익원","type":"subscription|transaction|service|license|other","revenue_share":숫자,"operating_margin":숫자,"growth_rate":숫자}],"segments":[{"name":"세그먼트명","revenue_share":숫자,"characteristics":"특성 1줄"}],"growth_motion":"PLG|SLG|FLG|hybrid","growth_motion_detail":"성장방식 2줄이내","unit_economics":{"gross_margin":숫자,"operating_margin":숫자,"net_margin":숫자,"fcf_margin":숫자,"nrr":숫자},"moat":[{"type":"해자유형","strength":"strong|medium|weak","description":"해자설명 1줄"}]}`,

  competitors_v2: `아래 스키마의 JSON 객체만 출력:
{"direct":[{"name":"경쟁사명","country":"국가","market_share":"점유율","strengths":["강점 1줄 최대3개"],"weaknesses":["약점 1줄 최대2개"],"vs_subject":"차별점 1줄"}],"indirect":[{"name":"간접경쟁사","threat":"위협 1줄"}],"substitutes":[{"name":"대체재","threat":"위협 1줄"}],"competitive_position":"leader|challenger|niche|follower"}
direct는 글로벌 직접 경쟁사 3~5개 필수.`,

  strategy_v2: `아래 스키마의 JSON 객체만 출력:
{"corporate":{"direction":"기업전략 한줄","portfolio":"포트폴리오방향 1줄","ma_partnerships":["M&A사례 1줄 최대3개"],"geographic":"지역확장 1줄"},"business":{"direction":"사업전략 한줄","competitive_advantage":"경쟁우위 1줄","go_to_market":"GTM전략 1줄","product_roadmap":["로드맵항목 1줄 최대4개"]},"financial":{"direction":"재무전략 한줄","capital_allocation":"자본배분 1줄","investment_priority":"투자우선순위 1줄","return_target":"목표수익지표 1줄"},"strategy_coherence":"3전략 수렴방향 2줄이내","ten_year_durability":"10년 지속가능성 2줄이내"}`,

  financials_v2: `아래 스키마의 JSON 객체만 출력:
{"narrative":"재무서사 3줄이내","income_statement":[{"item":"매출","fy2021":"값 or 공개없음","fy2022":"값","fy2023":"값","fy2024":"값","fy2025":"값 or 추정","yoy":"▲N% or ▼N% or —"},{"item":"매출총이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"영업이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"순이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"EBITDA","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""}],"balance_sheet":[{"item":"현금·현금성자산","fy2023":"값","fy2024":"값","fy2025":"값"},{"item":"총자산","fy2023":"","fy2024":"","fy2025":""},{"item":"총부채","fy2023":"","fy2024":"","fy2025":""},{"item":"자본총계","fy2023":"","fy2024":"","fy2025":""}],"cash_flow":{"operating":"값","investing":"값","financing":"값","fcf":"값","notes":"특이사항 or 빈문자"},"munger_buffett_metrics":{"roe":"값% or 추정불가","roic":"값% or 추정불가","owner_earnings":"값 or 추정불가","debt_to_equity":"값 or 추정불가","interest_coverage":"값 or 추정불가","reinvestment_rate":"값% or 추정불가"},"key_risks":["리스크 1줄 최대5개"]}
income_statement 빈칸 절대 금지 — 수치 없으면 반드시 '공개 없음'.`,
};

// ── Research gathering (1 web-search pass) ────────────────────────────────────

async function gatherResearch(companyName: string): Promise<string> {
  const systemPrompt = `당신은 기업 분석 리서처입니다. 아래 기업에 대해 웹 검색으로 종합적인 정보를 수집하고, 수집된 사실을 상세히 정리해주세요.

수집 항목:
1. 기업 개요 (설립연도, 본사, 사업영역, 주요 제품/서비스, 시가총액, 티커)
2. 최근 3~5년 재무 데이터 (매출, 영업이익, 순이익, FCF, 이익률)
3. 사업 모델 (수익 구조, 고객 세그먼트, 성장 방식)
4. 밸류체인 위치 (핵심 공급사, 주요 고객사)
5. 경쟁 현황 (주요 경쟁사, 시장점유율)
6. 전략 방향 (최근 M&A, 투자, 신규 사업, 지역 확장)
7. 산업/기술 트렌드 (산업 역사, 기술 발전 단계)
8. 리스크 요소 (규제, 경쟁, 기술 교체 위험)

JSON 불필요. 수집된 사실과 수치를 최대한 구체적으로 서술해주세요.`;

  return runWithWebSearch(
    systemPrompt,
    `기업명: ${companyName}\n\n이 기업의 종합적인 정보를 웹에서 수집해주세요.`,
    'claude-sonnet-4-6',
    8,
  );
}

// ── Section call (no web search, uses shared context) ─────────────────────────

async function callSection<T>(context: string, sectionKey: string): Promise<T | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SECTION_SYSTEM,
      messages: [{
        role: 'user',
        content: `${context}\n\n---\n\n${SECTION_SCHEMAS[sectionKey]}`,
      }],
    });
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    return extractJson<T>(raw, sectionKey);
  } catch (err) {
    console.error(`[claude] ${sectionKey} failed:`, err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(
  companyName: string,
  financialContext?: string,
): Promise<AnalysisData> {
  // Step 1: One web-search pass to gather research context
  const researchText = await gatherResearch(companyName);

  const sharedContext = [
    `기업명: ${companyName}`,
    financialContext ? `\n[공시 데이터 — 재무수치 우선 반영]\n${financialContext}` : null,
    `\n[웹 리서치]\n${researchText}`,
  ].filter(Boolean).join('\n');

  // Step 2: 8 sections in parallel
  const [
    summary_v2,
    industry_history_v2,
    tech_evolution_v2,
    value_chain_v2,
    business_model_v2,
    competitors_v2,
    strategy_v2,
    financials_v2,
  ] = await Promise.all([
    callSection<SummaryV2>(sharedContext, 'summary_v2'),
    callSection<IndustryHistoryV2>(sharedContext, 'industry_history_v2'),
    callSection<TechEvolutionV2>(sharedContext, 'tech_evolution_v2'),
    callSection<ValueChainV2>(sharedContext, 'value_chain_v2'),
    callSection<BusinessModelV2>(sharedContext, 'business_model_v2'),
    callSection<CompetitorsV2>(sharedContext, 'competitors_v2'),
    callSection<StrategyV2>(sharedContext, 'strategy_v2'),
    callSection<FinancialsV2>(sharedContext, 'financials_v2'),
  ]);

  return {
    summary_v2:          summary_v2          ?? { ...DEFAULT_ANALYSIS_DATA.summary_v2, company: companyName },
    industry_history_v2: industry_history_v2 ?? DEFAULT_ANALYSIS_DATA.industry_history_v2,
    tech_evolution_v2:   tech_evolution_v2   ?? DEFAULT_ANALYSIS_DATA.tech_evolution_v2,
    value_chain_v2:      value_chain_v2      ?? DEFAULT_ANALYSIS_DATA.value_chain_v2,
    business_model_v2:   business_model_v2   ?? DEFAULT_ANALYSIS_DATA.business_model_v2,
    competitors_v2:      competitors_v2      ?? DEFAULT_ANALYSIS_DATA.competitors_v2,
    strategy_v2:         strategy_v2         ?? DEFAULT_ANALYSIS_DATA.strategy_v2,
    financials_v2:       financials_v2       ?? DEFAULT_ANALYSIS_DATA.financials_v2,
    sources: {},
  };
}

export async function generateLinkedInDrafts(
  analysis: AnalysisData,
  companyName: string,
): Promise<LinkedInDraft[]> {
  const s = analysis.summary_v2;
  const bm = analysis.business_model_v2;
  const fin = analysis.financials_v2;

  const context = `기업명: ${companyName}
한줄 요약: ${s.one_line}
산업: ${s.industry}
강세 시나리오: ${s.bull_case}
약세 시나리오: ${s.bear_case}
성장 방식: ${bm.growth_motion} — ${bm.growth_motion_detail}
Gross Margin: ${bm.unit_economics.gross_margin}%
재무 서사: ${fin.narrative}
핵심 리스크: ${fin.key_risks.slice(0, 3).join(' / ')}`;

  const systemPrompt = `You are a LinkedIn content strategist who thinks simultaneously as an operator (execution/sales reality), strategist (timing/positioning), and investor (ROI/capital allocation).

GOAL: Answer "Does this actually make money?" — not summarize deals.

Write 3 LinkedIn posts in Korean. Every post must obey ALL rules below.

---

HOOK RULE:
- Open with 2–3 lines describing a market shift
- Follow with one bold tension sentence
- NO questions as the opening line
- NO company name in the first line

CONTEXT BLOCK (required):
- When / Who / What / How much
- Deal structure + minimum 2 numbers

TARGET COMPANY BLOCK:
- Max 2 founders
- Product in 1 line
- Core strength in 1 line
- NO history, NO long descriptions

CORE STRUCTURE — 5 sections in order:
1. Revenue Engine: trace usage → habit → monetization
2. Unit Economics: price + user assumption + revenue math (numbers required)
3. Why Buy (not Build): Why now? Why didn't they build it? Include time factor. End with "They bought speed" or "They bought time"
4. Operator Reality: 3+ risks in cause → consequence format. Must include "This only works if…" and "This breaks when…"
5. Capital Allocation: What did they actually buy? How does money flow back? ROI / payback period

INSIGHT RULE: One-line core insight required (e.g., "This is not an AI model business / This is a habit-driven revenue engine")

WRITING STYLE:
- Short sentences: 1–2 lines each
- One idea per line
- Aggressive line breaks
- No consulting or academic tone
- Rhythmic

NUMBER RULE: 2–3 meaningful numbers required. Numbers create tension.

CLOSING: 2–3 lines. No questions. Format: "This is not about X / This is a bet on Y"

LANGUAGE: Reason in English → output in Korean. Keep in English: ARPU, LTV, CAC, IRR, margin, multiple

HASHTAGS: 3–5 tags (2–3 Korean + 2 English)

FORBIDDEN: news summary / storytelling / emotional language / generic explanations

---

3 POST TYPES:
1. 인사이트 공유형: Deliver the sharpest non-obvious insight. Data-driven.
2. 질문형: Hook is provocative but NOT a question. Body builds layered tension.
3. 데이터 스토리형: Open with a surprising number. Build from data → structure → return.

---

Respond ONLY with this JSON array (no markdown, no code blocks):
[
  {"draft_number": 1, "content": "..."},
  {"draft_number": 2, "content": "..."},
  {"draft_number": 3, "content": "..."}
]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: context }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  const parsed = extractJson<LinkedInDraft[]>(raw, 'generateLinkedInDrafts');
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;

  return [1, 2, 3].map(n => ({
    draft_number: n,
    content: `${companyName} 분석 초안 ${n}\n\n${s.one_line}`,
  }));
}

export async function selectDailyCompany(): Promise<string> {
  const systemPrompt = `당신은 기업 분석 전문가입니다. 오늘 분석하기에 흥미로운 글로벌 또는 한국 기업 하나를 선정하세요.
최신 뉴스, 트렌드, 업계 이슈를 고려하여 선정하고, 기업명만 응답하세요. 설명 없이 기업명만.`;

  const name = await runWithWebSearch(
    systemPrompt,
    `오늘(${new Date().toISOString().slice(0, 10)}) 분석할 만한 흥미로운 기업을 추천해주세요. 기업명만 답하세요.`,
    'claude-sonnet-4-6',
    6,
  );

  return name.trim().split('\n')[0].trim();
}

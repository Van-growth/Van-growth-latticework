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
  maxTokens = 16000,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ── Section prompts ───────────────────────────────────────────────────────────

const SECTION_SYSTEM = `당신은 전문 기업 분석가입니다. 제공된 리서치 데이터를 바탕으로 지정된 섹션만 분석합니다.
규칙: 마크다운·코드블록·추가 설명 없이 순수 JSON만 출력. 모든 텍스트는 한국어 (기업명·기술명·티커는 원어 유지).

[데이터 신뢰성 원칙]
1. 확인된 데이터만 수치로 제시. 출처(10-K, IR, DART 등) 확인 가능한 것만.
2. 추정·추론한 수치는 반드시 값 끝에 "(추정)" 레이블 명시. 예: "15.2% (추정)"
3. 데이터가 없는 항목은 "확인 필요"로 반환. 절대 임의로 채우지 말 것.
4. 지역별 매출 비중·고객사명 등 구체적 수치는 공시 데이터 기반이 아니면 제시 금지.
5. 소규모·비상장 기업은 데이터 공백이 많을 수 있음 — 없으면 없다고 명시.`;

const SECTION_SCHEMAS: Record<string, string> = {
  summary_v2: `아래 스키마의 JSON 객체만 출력:
{"company":"기업명","ticker":"티커 or null","industry":"산업분류","hq":"본사 도시, 국가","value_chain_position":"upstream|midstream|downstream","products":[{"name":"제품명","revenue_share":숫자}],"key_metrics":[{"label":"매출","value":"수치 — 공시 미확인 시 '확인 필요'","trend":"up|down|flat"},{"label":"영업이익률","value":"수치% — 추정 시 '수치% (추정)'","trend":"up|down|flat"},{"label":"시가총액","value":"수치","trend":"up|down|flat"},{"label":"YoY 성장률","value":"수치%","trend":"up|down|flat"}],"top_customers":["공시 확인된 고객사명만. 불확실 시 빈 배열 []"],"key_markets":[{"country":"국가","revenue_share":공시 확인된 숫자만. 없으면 항목 제외}],"one_line":"투자자 관점 핵심 한줄 20자이내","bull_case":"강세 시나리오 2줄이내","bear_case":"약세 시나리오 2줄이내"}
top_customers: IR·공시에서 확인된 것만. 추정이면 빈 배열. key_markets.revenue_share: 공시 수치 없으면 해당 국가 항목 자체를 제외.`,

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
{"narrative":"재무서사 3줄이내","income_statement":[{"item":"매출","fy2021":"공시값 or '확인 필요'","fy2022":"공시값 or '확인 필요'","fy2023":"공시값 or '확인 필요'","fy2024":"공시값 or '확인 필요'","fy2025":"공시값 or '수치 (추정)' or '확인 필요'","yoy":"▲N% or ▼N% or —"},{"item":"매출총이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"영업이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"순이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"EBITDA","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""}],"balance_sheet":[{"item":"현금·현금성자산","fy2023":"공시값 or '확인 필요'","fy2024":"공시값 or '확인 필요'","fy2025":"공시값 or '수치 (추정)' or '확인 필요'"},{"item":"총자산","fy2023":"","fy2024":"","fy2025":""},{"item":"총부채","fy2023":"","fy2024":"","fy2025":""},{"item":"자본총계","fy2023":"","fy2024":"","fy2025":""}],"cash_flow":{"operating":"공시값 or '확인 필요'","investing":"공시값 or '확인 필요'","financing":"공시값 or '확인 필요'","fcf":"공시값 or '수치 (추정)' or '확인 필요'","notes":"특이사항 or 빈문자"},"munger_buffett_metrics":{"roe":"공시값% or '수치% (추정)' or '확인 필요'","roic":"공시값% or '수치% (추정)' or '확인 필요'","owner_earnings":"공시값 or '확인 필요'","debt_to_equity":"공시값 or '확인 필요'","interest_coverage":"공시값 or '확인 필요'","reinvestment_rate":"공시값% or '수치% (추정)' or '확인 필요'"},"key_risks":["리스크 1줄 최대5개"]}
income_statement·balance_sheet 빈칸 절대 금지 — 공시 수치 없으면 반드시 '확인 필요'. 추정값은 반드시 '숫자 (추정)' 형식.`,
};

// ── Research gathering (1 web-search pass) ────────────────────────────────────

async function gatherResearch(companyName: string): Promise<string> {
  const systemPrompt = `당신은 기업 분석 리서처입니다. 아래 기업에 대해 웹 검색으로 핵심 정보를 수집하고, 수집된 사실을 항목별로 정리해주세요.

[소스 신뢰도 우선순위]
1순위 — 공식 공시: SEC 10-K/10-Q, DART, 기업 IR 자료, 공식 프레스릴리즈
2순위 — 주요 금융 데이터: Bloomberg, Reuters, Yahoo Finance, Macrotrends
3순위 — 산업 리서치: CB Insights, Gartner, IDC, Statista
4순위 — 주요 언론: Financial Times, WSJ, Forbes, 한국경제, 매일경제
5순위 — 일반 뉴스/블로그: 추정/미확인 레이블 필수

우선순위 높은 소스에서 데이터를 찾지 못한 경우에만 다음 순위로 이동.
수치 데이터(매출, 마진, 점유율 등)는 반드시 1~2순위 소스에서만 확정값으로 사용.
3순위 이하 소스의 수치는 반드시 '(추정)' 레이블 명시.
소스에서 찾을 수 없는 데이터는 null 반환. 절대 임의로 채우지 말 것.

[검색 순서]
1. "${companyName} SEC 10-K annual report 2024 2025" (또는 DART 공시)
2. "${companyName} IR earnings revenue financials"
3. "${companyName} market share competitors industry analysis"
4. "${companyName} business model strategy"
5. "${companyName} recent news 2025"

[수집 항목]
1. 기업 개요 (설립연도, 본사, 사업영역, 주요 제품/서비스, 시가총액, 티커)
2. 최근 3~5년 재무 데이터 (매출, 영업이익, 순이익, FCF, 이익률) — 1~2순위 소스 우선
3. 사업 모델 (수익 구조, 고객 세그먼트, 성장 방식)
4. 밸류체인 위치 (핵심 공급사, 주요 고객사) — 공시 확인된 것만
5. 경쟁 현황 (주요 경쟁사, 시장점유율) — 출처 명시
6. 전략 방향 (최근 M&A, 투자, 신규 사업, 지역 확장)
7. 산업/기술 트렌드
8. 리스크 요소

JSON 불필요. 각 수치에 출처 소스명 병기. 확인 불가 항목은 "확인 필요"로 명시.`;

  return runWithWebSearch(
    systemPrompt,
    `기업명: ${companyName}\n\n위 검색 순서에 따라 정보를 수집해주세요.`,
    'claude-sonnet-4-6',
    5,
    6000,
  );
}

// ── Section call (no web search, uses shared context) ─────────────────────────

async function callSection<T>(context: string, sectionKey: string): Promise<T | null> {
  const t0 = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
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
    const result = extractJson<T>(raw, sectionKey);
    console.log(`[claude] ${sectionKey} OK  ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.error(`[claude] ${sectionKey} FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(
  companyName: string,
  financialContext?: string,
): Promise<AnalysisData> {
  // Step 1: One web-search pass to gather research context
  const t0 = Date.now();
  const researchText = await gatherResearch(companyName);
  console.log(`[claude] gatherResearch done ${Date.now() - t0}ms`);

  const sharedContext = [
    `기업명: ${companyName}`,
    financialContext ? `\n[공시 데이터 — 재무수치 우선 반영]\n${financialContext}` : null,
    `\n[웹 리서치]\n${researchText}`,
  ].filter(Boolean).join('\n');

  // Step 2: 8 sections in parallel — allSettled so one hang/fail doesn't block others
  const SECTION_TIMEOUT = 30_000;
  const t1 = Date.now();
  const results = await Promise.allSettled([
    withTimeout(callSection<SummaryV2>(sharedContext, 'summary_v2'),                 SECTION_TIMEOUT, 'summary_v2'),
    withTimeout(callSection<IndustryHistoryV2>(sharedContext, 'industry_history_v2'), SECTION_TIMEOUT, 'industry_history_v2'),
    withTimeout(callSection<TechEvolutionV2>(sharedContext, 'tech_evolution_v2'),     SECTION_TIMEOUT, 'tech_evolution_v2'),
    withTimeout(callSection<ValueChainV2>(sharedContext, 'value_chain_v2'),           SECTION_TIMEOUT, 'value_chain_v2'),
    withTimeout(callSection<BusinessModelV2>(sharedContext, 'business_model_v2'),     SECTION_TIMEOUT, 'business_model_v2'),
    withTimeout(callSection<CompetitorsV2>(sharedContext, 'competitors_v2'),          SECTION_TIMEOUT, 'competitors_v2'),
    withTimeout(callSection<StrategyV2>(sharedContext, 'strategy_v2'),               SECTION_TIMEOUT, 'strategy_v2'),
    withTimeout(callSection<FinancialsV2>(sharedContext, 'financials_v2'),            SECTION_TIMEOUT, 'financials_v2'),
  ]);
  console.log(`[claude] parallel sections done ${Date.now() - t1}ms`);

  function settled<T>(r: PromiseSettledResult<T | null>, fallback: T): T {
    return r.status === 'fulfilled' && r.value !== null ? r.value : fallback;
  }

  const [r0, r1, r2, r3, r4, r5, r6, r7] = results;
  return {
    summary_v2:          settled(r0, { ...DEFAULT_ANALYSIS_DATA.summary_v2, company: companyName }),
    industry_history_v2: settled(r1, DEFAULT_ANALYSIS_DATA.industry_history_v2),
    tech_evolution_v2:   settled(r2, DEFAULT_ANALYSIS_DATA.tech_evolution_v2),
    value_chain_v2:      settled(r3, DEFAULT_ANALYSIS_DATA.value_chain_v2),
    business_model_v2:   settled(r4, DEFAULT_ANALYSIS_DATA.business_model_v2),
    competitors_v2:      settled(r5, DEFAULT_ANALYSIS_DATA.competitors_v2),
    strategy_v2:         settled(r6, DEFAULT_ANALYSIS_DATA.strategy_v2),
    financials_v2:       settled(r7, DEFAULT_ANALYSIS_DATA.financials_v2),
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

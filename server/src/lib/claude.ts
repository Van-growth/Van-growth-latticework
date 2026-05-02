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

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(
  companyName: string,
  financialContext?: string,
): Promise<AnalysisData> {
  const systemPrompt = `당신은 전문 기업 분석가입니다. 웹 검색으로 기업을 충분히 조사한 후, 아래 JSON 형식으로만 응답하세요.
**중요**: 마크다운, 코드블록, 추가 설명 없이 순수 JSON만 출력하세요.
**원칙**: 서술형 텍스트 최소화. 모든 데이터는 구조화된 배열/객체로 반환. 불확실한 수치는 null 또는 0 대신 "추정 불가"로 명시.

출력 JSON 형식 (모든 텍스트는 한국어):
{
  "summary_v2": {
    "company": "기업명",
    "ticker": "티커심볼 또는 null",
    "industry": "산업분류 (예: 반도체 장비, SaaS, 2차전지)",
    "hq": "본사 도시, 국가",
    "value_chain_position": "upstream 또는 midstream 또는 downstream",
    "products": [
      {"name": "제품/서비스명", "revenue_share": 매출비중(0-100 숫자)}
    ],
    "key_metrics": [
      {"label": "매출", "value": "실제 수치 또는 추정", "trend": "up 또는 down 또는 flat"},
      {"label": "영업이익률", "value": "수치%", "trend": "up 또는 down 또는 flat"},
      {"label": "시가총액", "value": "수치", "trend": "up 또는 down 또는 flat"},
      {"label": "YoY 성장률", "value": "수치%", "trend": "up 또는 down 또는 flat"}
    ],
    "top_customers": ["고객사명 (최대 5개)"],
    "key_markets": [
      {"country": "국가명", "revenue_share": 비중(0-100 숫자)}
    ],
    "one_line": "투자자 관점 핵심 한줄 (20자 이내)",
    "bull_case": "강세 시나리오 2줄 이내 — 구체적 촉매 기반",
    "bear_case": "약세 시나리오 2줄 이내 — 현실적 리스크 기반"
  },
  "industry_history_v2": {
    "industry_name": "산업명",
    "timeline": [
      {
        "period": "시기 (예: 1960s~1980s, 1990년대)",
        "title": "시대 제목 15자 이내",
        "technology": "핵심 기술 1줄",
        "market_need": "시장 수요 1줄",
        "key_players": ["주요 기업명 (국가 포함)"],
        "significance": "이 시기의 중요성 1줄"
      }
    ],
    "why_durable": "산업이 향후 10년 지속 가능한 이유 2줄 이내",
    "chasm_points": ["캐즘 발생 시점과 이유 1줄씩 (최대 3개)"]
  },
  "tech_evolution_v2": {
    "tech_name": "핵심 기술명",
    "stages": [
      {
        "stage": 단계번호(1부터),
        "period": "시기",
        "title": "단계 제목 15자 이내",
        "description": "단계 설명 2줄 이내",
        "hype_level": "emerging 또는 hype 또는 trough 또는 recovery 또는 mainstream",
        "key_enablers": ["핵심 기술/요인 (최대 3개)"],
        "key_players": ["주요 기업명 (최대 4개)"]
      }
    ],
    "current_stage": "현재 단계 설명 1줄",
    "next_inflection": "다음 변곡점 예측 1줄"
  },
  "value_chain_v2": {
    "industry": "산업명",
    "layers": [
      {
        "name": "레이어명 (예: 원재료, 부품, 완제품, 유통, 최종소비)",
        "description": "레이어 설명 1줄",
        "is_subject": true 또는 false (분석 대상 기업이 이 레이어에 속하면 true),
        "pricing_power": "high 또는 medium 또는 low",
        "bottleneck": true 또는 false (공급 병목 여부),
        "global_leaders": [
          {"name": "기업명", "country": "국가", "why_leader": "선도 이유 1줄"}
        ]
      }
    ],
    "value_flow": "가격전가 메커니즘 2줄 이내",
    "subject_position": "분석 기업의 밸류체인 내 포지션 및 경쟁력 2줄 이내"
  },
  "business_model_v2": {
    "revenue_streams": [
      {
        "name": "수익원 이름",
        "type": "subscription 또는 transaction 또는 service 또는 license 또는 other",
        "revenue_share": 비중(0-100 숫자),
        "operating_margin": 영업이익률(숫자, 없으면 0),
        "growth_rate": YoY성장률(숫자, 없으면 0)
      }
    ],
    "segments": [
      {
        "name": "세그먼트명",
        "revenue_share": 비중(0-100 숫자),
        "characteristics": "특성 1줄"
      }
    ],
    "growth_motion": "PLG 또는 SLG 또는 FLG 또는 hybrid",
    "growth_motion_detail": "성장 방식 설명 2줄 이내",
    "unit_economics": {
      "gross_margin": 매출총이익률(숫자, 없으면 0),
      "operating_margin": 영업이익률(숫자, 없으면 0),
      "net_margin": 순이익률(숫자, 없으면 0),
      "fcf_margin": FCF마진(숫자, 없으면 0),
      "nrr": NRR(숫자, 해당없으면 0)
    },
    "moat": [
      {
        "type": "해자 유형 (네트워크 효과/전환비용/규모의 경제/무형자산/비용우위)",
        "strength": "strong 또는 medium 또는 weak",
        "description": "해자 설명 1줄"
      }
    ]
  },
  "competitors_v2": {
    "direct": [
      {
        "name": "경쟁사명",
        "country": "본사 국가",
        "market_share": "시장점유율 (추정 포함)",
        "strengths": ["핵심 강점 1줄씩 (최대 3개)"],
        "weaknesses": ["핵심 약점 1줄씩 (최대 2개)"],
        "vs_subject": "분석 기업 대비 차별점 한줄"
      }
    ],
    "indirect": [{"name": "간접경쟁사명", "threat": "위협 내용 1줄"}],
    "substitutes": [{"name": "대체재명", "threat": "위협 내용 1줄"}],
    "competitive_position": "leader 또는 challenger 또는 niche 또는 follower"
  },
  "strategy_v2": {
    "corporate": {
      "direction": "기업 전략 핵심 한줄",
      "portfolio": "포트폴리오 방향 1줄",
      "ma_partnerships": ["M&A/파트너십 사례 1줄씩 (최대 3개)"],
      "geographic": "지역 확장 전략 1줄"
    },
    "business": {
      "direction": "사업 전략 핵심 한줄",
      "competitive_advantage": "경쟁 우위 방식 1줄",
      "go_to_market": "GTM 전략 1줄",
      "product_roadmap": ["제품 로드맵 항목 1줄씩 (최대 4개)"]
    },
    "financial": {
      "direction": "재무 전략 핵심 한줄",
      "capital_allocation": "자본배분 방향 1줄",
      "investment_priority": "투자 우선순위 1줄",
      "return_target": "목표 수익성 지표 1줄"
    },
    "strategy_coherence": "3전략 수렴 방향 2줄 이내",
    "ten_year_durability": "10년 지속 가능성 2줄 이내"
  },
  "financials_v2": {
    "narrative": "재무 서사 3줄 이내 — 추세·특이사항·자본배분 의도",
    "income_statement": [
      {
        "item": "매출",
        "fy2021": "값 또는 '공개 없음'",
        "fy2022": "값 또는 '공개 없음'",
        "fy2023": "값 또는 '공개 없음'",
        "fy2024": "값 또는 '공개 없음'",
        "fy2025": "값 또는 '추정' 또는 '공개 없음'",
        "yoy": "▲N% 또는 ▼N% 또는 '—'"
      },
      {"item": "매출총이익", "fy2021": "값", "fy2022": "값", "fy2023": "값", "fy2024": "값", "fy2025": "값", "yoy": "값"},
      {"item": "영업이익",   "fy2021": "값", "fy2022": "값", "fy2023": "값", "fy2024": "값", "fy2025": "값", "yoy": "값"},
      {"item": "순이익",     "fy2021": "값", "fy2022": "값", "fy2023": "값", "fy2024": "값", "fy2025": "값", "yoy": "값"},
      {"item": "EBITDA",    "fy2021": "값", "fy2022": "값", "fy2023": "값", "fy2024": "값", "fy2025": "값", "yoy": "값"}
    ],
    "balance_sheet": [
      {"item": "현금·현금성자산", "fy2023": "값 또는 '공개 없음'", "fy2024": "값", "fy2025": "값"},
      {"item": "총자산",          "fy2023": "값", "fy2024": "값", "fy2025": "값"},
      {"item": "총부채",          "fy2023": "값", "fy2024": "값", "fy2025": "값"},
      {"item": "자본총계",        "fy2023": "값", "fy2024": "값", "fy2025": "값"}
    ],
    "cash_flow": {
      "operating": "영업활동 CF 최신 연도 값",
      "investing": "투자활동 CF 최신 연도 값",
      "financing": "재무활동 CF 최신 연도 값",
      "fcf": "FCF 값",
      "notes": "특이사항 1줄 또는 빈 문자열"
    },
    "munger_buffett_metrics": {
      "roe": "ROE 값% 또는 '추정 불가'",
      "roic": "ROIC 값% 또는 '추정 불가'",
      "owner_earnings": "오너이익 값 또는 '추정 불가'",
      "debt_to_equity": "부채비율 값 또는 '추정 불가'",
      "interest_coverage": "이자보상배율 값 또는 '추정 불가'",
      "reinvestment_rate": "재투자율 값% 또는 '추정 불가'"
    },
    "key_risks": ["리스크 1줄씩 (최대 5개)"]
  },
  "sources": {
    "summary":          [{"url": "https://...", "title": "페이지 제목"}],
    "industry_history": [{"url": "https://...", "title": "페이지 제목"}],
    "tech_evolution":   [{"url": "https://...", "title": "페이지 제목"}],
    "value_chain":      [{"url": "https://...", "title": "페이지 제목"}],
    "business_model":   [{"url": "https://...", "title": "페이지 제목"}],
    "competitors":      [{"url": "https://...", "title": "페이지 제목"}],
    "strategy":         [{"url": "https://...", "title": "페이지 제목"}],
    "financials":       [{"url": "https://...", "title": "페이지 제목"}]
  }
}

추가 지침:
- competitors_v2.direct: 글로벌 직접 경쟁사 3~5개 필수
- financials_v2.income_statement: 빈칸 절대 금지 — 수치 없으면 반드시 '공개 없음'
- key_metrics: 검증된 수치만. 수치 없으면 빈 배열 []
- 모든 텍스트는 한국어로 작성 (기업명·티커·기술명은 원어 유지)`;

  const userMessage = financialContext
    ? `[공시 데이터]\n${financialContext}\n\n[분석 요청]\n기업명: ${companyName}\n\n위 공시 데이터의 재무수치를 financials_v2에 우선 반영하고 웹 검색으로 나머지 섹션을 완성해주세요.`
    : `기업명: ${companyName}\n\n이 기업의 최신 정보를 웹에서 검색하여 분석해주세요.`;

  const raw = await runWithWebSearch(systemPrompt, userMessage, 'claude-sonnet-4-6');
  const parsed = extractJson<AnalysisData>(raw, 'analyzeCompany');

  if (parsed?.summary_v2?.company) {
    return {
      ...DEFAULT_ANALYSIS_DATA,
      ...parsed,
      sources: parsed.sources ?? {},
    };
  }

  return {
    ...DEFAULT_ANALYSIS_DATA,
    summary_v2: { ...DEFAULT_ANALYSIS_DATA.summary_v2, company: companyName, one_line: raw.slice(0, 50) },
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

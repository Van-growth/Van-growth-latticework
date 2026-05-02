import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Types ────────────────────────────────────────────────────────────────────

export interface ValueChainPlayer {
  role: string;
  player_name: string;
  description: string;
}

export interface MoatType {
  name: string;
  strength: '강함' | '보통' | '약함';
  basis: string;
}

export interface MoatAnalysis {
  types: MoatType[];
  sustain_conditions: string;
  collapse_scenarios: string;
}

export interface RiskItem {
  category: string;
  description: string;
}

export interface RiskGroup {
  severity: '높음' | '중간' | '낮음';
  items: RiskItem[];
}

export interface RiskAnalysis {
  business: RiskGroup;
  financial: RiskGroup;
  external: RiskGroup;
}

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
  financials?: Source[];
}

export interface AnalysisData {
  summary: string;
  industry_history: string;
  tech_evolution: string;
  value_chain_overview: string;
  value_chain_players: ValueChainPlayer[];
  business_model: string;
  moat_analysis: MoatAnalysis;
  risk_analysis: RiskAnalysis;
  financials: string;
  sources: AnalysisSources;
}

export interface LinkedInDraft {
  draft_number: number;
  content: string;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_MOAT: MoatAnalysis = {
  types: [],
  sustain_conditions: '',
  collapse_scenarios: '',
};

const DEFAULT_RISK: RiskAnalysis = {
  business:  { severity: '중간', items: [] },
  financial: { severity: '중간', items: [] },
  external:  { severity: '중간', items: [] },
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
      max_tokens: 8096,
      system: systemPrompt,
      tools: WEB_SEARCH_TOOL,
      messages,
    });

    const texts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n\n');

    if (response.stop_reason === 'end_turn') return texts;

    // Continue tool-use loop
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

function extractJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(companyName: string): Promise<AnalysisData> {
  const systemPrompt = `당신은 균형 잡힌 시각을 가진 전문 기업 분석가입니다. 웹 검색으로 기업을 충분히 조사한 후, 아래 JSON 형식으로만 응답하세요. 마크다운, 코드블록, 추가 설명 없이 순수 JSON만 출력하세요.

균형 잡힌 분석 원칙 (반드시 준수):
- 긍정적 측면과 부정적 측면을 반드시 균형 있게 서술할 것
- 불확실하거나 검증되지 않은 정보는 "(추정)" 또는 "(확인 필요)"로 명시할 것
- "혁신적인", "최고의", "선두적인" 등 근거 없는 과장된 수식어 사용 금지
- 구체적 수치나 데이터가 없을 경우 "공개 데이터 없음" 또는 "추정 불가"로 명시할 것
- 출처가 확인된 정보와 추정 정보를 구분하여 서술할 것

출력 JSON 형식:
{
  "summary": "경영 요약 (200-300자) — 강점과 약점 균형 포함",
  "industry_history": "산업 역사 및 발전 과정 (400-600자)",
  "tech_evolution": "기술 변화 및 혁신 트렌드 (300-500자)",
  "value_chain_overview": "밸류체인 전체 개요 (200-300자)",
  "value_chain_players": [
    { "role": "밸류체인 내 역할", "player_name": "기업/기관명", "description": "역할 설명 1-2문장" }
  ],
  "business_model": "비즈니스 모델 및 수익 구조 (400-600자) — 수익화 방식과 한계 균형 포함",
  "moat_analysis": {
    "types": [
      {
        "name": "네트워크 효과 | 전환비용 | 규모의 경제 | 무형자산 | 비용우위 중 해당하는 것",
        "strength": "강함 또는 보통 또는 약함",
        "basis": "해당 해자의 근거 2-3문장 (반론 포함)"
      }
    ],
    "sustain_conditions": "해자가 유지되는 조건 (2-3문장)",
    "collapse_scenarios": "해자가 무너지는 시나리오 (2-3문장) — 현실적 리스크 기반"
  },
  "risk_analysis": {
    "business": {
      "severity": "높음 또는 중간 또는 낮음",
      "items": [
        {"category": "경쟁", "description": "구체적 리스크 내용"},
        {"category": "시장", "description": "구체적 리스크 내용"},
        {"category": "실행", "description": "구체적 리스크 내용"}
      ]
    },
    "financial": {
      "severity": "높음 또는 중간 또는 낮음",
      "items": [
        {"category": "수익성", "description": "구체적 리스크 내용"},
        {"category": "현금흐름", "description": "구체적 리스크 내용"},
        {"category": "부채", "description": "구체적 리스크 내용"}
      ]
    },
    "external": {
      "severity": "높음 또는 중간 또는 낮음",
      "items": [
        {"category": "규제", "description": "구체적 리스크 내용"},
        {"category": "매크로", "description": "구체적 리스크 내용"},
        {"category": "기술변화", "description": "구체적 리스크 내용"}
      ]
    }
  },
  "financials": "재무 현황 및 주요 지표 (400-600자) — 공개된 수치만 사용, 없으면 '공개 데이터 없음' 명시",
  "sources": {
    "summary":          [{"url": "https://...", "title": "페이지 제목"}],
    "industry_history": [{"url": "https://...", "title": "페이지 제목"}],
    "tech_evolution":   [{"url": "https://...", "title": "페이지 제목"}],
    "value_chain":      [{"url": "https://...", "title": "페이지 제목"}],
    "business_model":   [{"url": "https://...", "title": "페이지 제목"}],
    "financials":       [{"url": "https://...", "title": "페이지 제목"}]
  }
}

sources 필드에는 각 섹션 작성에 실제로 사용한 웹 검색 결과 URL만 포함하세요. 없으면 빈 배열 []로 두세요.
모든 텍스트 내용은 한국어로 작성하세요.`;

  const raw = await runWithWebSearch(
    systemPrompt,
    `기업명: ${companyName}\n\n이 기업의 최신 정보를 웹에서 검색하여 균형 잡힌 분석을 해주세요.`,
    'claude-sonnet-4-6',
  );

  const parsed = extractJson<AnalysisData>(raw);

  if (parsed && parsed.summary) {
    return {
      ...parsed,
      moat_analysis: parsed.moat_analysis ?? DEFAULT_MOAT,
      risk_analysis: parsed.risk_analysis ?? DEFAULT_RISK,
      sources:       parsed.sources ?? {},
    };
  }

  return {
    summary: raw.slice(0, 1000),
    industry_history: '',
    tech_evolution: '',
    value_chain_overview: '',
    value_chain_players: [],
    business_model: '',
    moat_analysis: DEFAULT_MOAT,
    risk_analysis: DEFAULT_RISK,
    financials: '',
    sources: {},
  };
}

export async function generateLinkedInDrafts(
  analysis: AnalysisData,
  companyName: string,
): Promise<LinkedInDraft[]> {
  const context = `기업명: ${companyName}
요약: ${analysis.summary}
비즈니스 모델: ${analysis.business_model}
기술 변화: ${analysis.tech_evolution}
재무: ${analysis.financials}
산업 역사: ${analysis.industry_history}`;

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

NUMBER RULE: 2–3 meaningful numbers required (investment, revenue potential, ARPU/price). Numbers create tension.

CLOSING: 2–3 lines. No questions. Format: "This is not about X / This is a bet on Y"

LANGUAGE: Reason in English → output in Korean. Keep in English: ARPU, LTV, CAC, IRR, margin, multiple

HASHTAGS: 3–5 tags (2–3 Korean + 2 English)

FORBIDDEN: news summary / storytelling / emotional language / generic explanations

FINAL PRINCIPLE: Connect Revenue → Structure → Deal → Capital → Return. Do not describe the deal.

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

  const parsed = extractJson<LinkedInDraft[]>(raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;

  return [1, 2, 3].map(n => ({
    draft_number: n,
    content: `${companyName} 분석 초안 ${n}\n\n${analysis.summary.slice(0, 100)}...`,
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

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

export interface AnalysisData {
  summary: string;
  industry_history: string;
  tech_evolution: string;
  value_chain_overview: string;
  value_chain_players: ValueChainPlayer[];
  business_model: string;
  financials: string;
}

export interface LinkedInDraft {
  draft_number: number;
  content: string;
}

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
    // Try full text first
    return JSON.parse(text) as T;
  } catch {
    // Try to find first JSON object or array
    const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
    }
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(companyName: string): Promise<AnalysisData> {
  const systemPrompt = `당신은 전문 기업 분석가입니다. 웹 검색으로 기업을 충분히 조사한 후, 아래 JSON 형식으로만 응답하세요. 마크다운, 코드블록, 추가 설명 없이 JSON만 출력하세요.

{
  "summary": "경영 요약 (200-300자)",
  "industry_history": "산업 역사 및 발전 과정 (400-600자)",
  "tech_evolution": "기술 변화 및 혁신 트렌드 (300-500자)",
  "value_chain_overview": "밸류체인 전체 개요 (200-300자)",
  "value_chain_players": [
    { "role": "밸류체인 내 역할", "player_name": "기업/기관명", "description": "역할 설명 1-2문장" }
  ],
  "business_model": "비즈니스 모델 및 수익 구조 분석 (400-600자)",
  "financials": "재무 현황 및 주요 지표 (400-600자)"
}

모든 내용은 한국어로 작성하세요.`;

  const raw = await runWithWebSearch(
    systemPrompt,
    `기업명: ${companyName}\n\n이 기업의 최신 정보를 웹에서 검색하여 분석해주세요.`,
    'claude-sonnet-4-6',
  );

  const parsed = extractJson<AnalysisData>(raw);

  if (parsed && parsed.summary) return parsed;

  // Fallback: store raw text as summary
  return {
    summary: raw.slice(0, 1000),
    industry_history: '',
    tech_evolution: '',
    value_chain_overview: '',
    value_chain_players: [],
    business_model: '',
    financials: '',
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
재무: ${analysis.financials}`;

  const systemPrompt = `당신은 LinkedIn 콘텐츠 전문가입니다. 주어진 기업 분석을 바탕으로 3가지 스타일의 LinkedIn 게시물 초안을 작성하세요.

스타일:
1. 인사이트 공유형: 핵심 인사이트를 명확하게 전달, 숫자/데이터 활용
2. 질문형: 독자의 사고를 유발하는 도발적 질문으로 시작
3. 스토리텔링형: 기업의 여정/변화를 내러티브로 풀기

각 게시물:
- 150-250자
- 자연스러운 한국어
- 이모지 1-3개 적절히 사용
- 마지막에 CTA나 질문

아래 JSON 배열 형식으로만 응답 (마크다운/코드블록 없이):
[
  {"draft_number": 1, "content": "..."},
  {"draft_number": 2, "content": "..."},
  {"draft_number": 3, "content": "..."}
]`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: context }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('');

  const parsed = extractJson<LinkedInDraft[]>(raw);
  if (Array.isArray(parsed) && parsed.length > 0) return parsed;

  // Fallback drafts
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

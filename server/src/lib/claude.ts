import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function analyzeCompany(companyName: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        type: 'web_search_20250305' as const,
        name: 'web_search',
      } as Parameters<typeof anthropic.messages.create>[0]['tools'][0],
    ],
    messages: [
      {
        role: 'user',
        content: `다음 기업을 심층 분석해주세요: **${companyName}**

아래 항목을 포함해서 분석해주세요:
1. 기업 개요 (설립연도, 본사 위치, 주요 사업)
2. 핵심 제품/서비스
3. 시장 포지션 및 경쟁사
4. 최근 주요 뉴스 및 동향
5. 재무 현황 (가능한 경우)
6. 성장 가능성 및 리스크

최신 정보를 웹에서 검색해서 정확하고 구체적인 분석을 제공해주세요.`,
      },
    ],
  });

  // Extract text from response (handling tool use flow)
  const textBlocks = response.content.filter((block) => block.type === 'text');
  if (textBlocks.length > 0) {
    return textBlocks.map((b) => (b as { type: 'text'; text: string }).text).join('\n\n');
  }

  // If only tool_use blocks, make a follow-up call with results
  const toolResults = response.content
    .filter((block) => block.type === 'tool_use')
    .map((block) => {
      const tb = block as { type: 'tool_use'; id: string; name: string; input: unknown };
      return { id: tb.id, name: tb.name, input: tb.input };
    });

  if (toolResults.length === 0) {
    return '분석 결과를 가져오지 못했습니다.';
  }

  const followUp = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      {
        type: 'web_search_20250305' as const,
        name: 'web_search',
      } as Parameters<typeof anthropic.messages.create>[0]['tools'][0],
    ],
    messages: [
      {
        role: 'user',
        content: `다음 기업을 심층 분석해주세요: **${companyName}**

아래 항목을 포함해서 분석해주세요:
1. 기업 개요 (설립연도, 본사 위치, 주요 사업)
2. 핵심 제품/서비스
3. 시장 포지션 및 경쟁사
4. 최근 주요 뉴스 및 동향
5. 재무 현황 (가능한 경우)
6. 성장 가능성 및 리스크

최신 정보를 웹에서 검색해서 정확하고 구체적인 분석을 제공해주세요.`,
      },
      {
        role: 'assistant',
        content: response.content,
      },
      {
        role: 'user',
        content: toolResults.map((tr) => ({
          type: 'tool_result' as const,
          tool_use_id: tr.id,
          content: '검색 완료',
        })),
      },
    ],
  });

  const finalTexts = followUp.content.filter((b) => b.type === 'text');
  return finalTexts
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n\n') || '분석 결과를 가져오지 못했습니다.';
}

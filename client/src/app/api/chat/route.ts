import { NextRequest, NextResponse } from 'next/server';

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const { messages, context } = (await req.json()) as {
    messages: AnthropicMessage[];
    context: string;
  };

  const systemPrompt = `당신은 투자자 관점의 기업 분석 AI 비서입니다. 아래 기업 분석 데이터를 기반으로 질문에 간결하고 직접적으로 답하세요. 답변은 핵심만, 300자 이내로 작성하세요.

멍거 체크리스트 요청 시 반드시 5개 프레임(비즈니스 퀄리티, 해자, 경영진, 재무, 밸류에이션) 구조를 지키고, 분석 데이터에 없는 항목은 '데이터 없음'이 아닌 웹 검색 결과 기반으로 추론해서 답할 것.

[기업 분석 데이터]
${context}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: messages.slice(-20),
    }),
  });

  if (!res.ok) {
    console.error('[chat API]', await res.text());
    return NextResponse.json({ error: '응답 생성 중 오류가 발생했습니다.' }, { status: res.status });
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
  };
  const content = data.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  return NextResponse.json({ content });
}

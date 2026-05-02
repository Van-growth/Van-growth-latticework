'use client';

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AnalysisDetail } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  '밸류에이션 적정한가?',
  '핵심 리스크 요약',
  '경쟁사 대비 포지션',
];

const MUNGER_PROMPT = `찰리 멍거 관점에서 이 기업을 체크리스트로 평가해줘. 아래 5개 프레임 각각에 대해 현재 분석 데이터 기반으로 간결하게 답해줘:

1. 비즈니스 퀄리티: 진입장벽 / Pricing power / 10년 내구성
2. 해자(Moat): 전환비용 / 규모의 경제 / 네트워크 효과
3. 경영진: 자본배분 / 가이던스 실행력 / SBC 수준
4. 재무: ROE·ROIC vs 자본비용 / FCF vs 순이익 괴리 / 부채 안전성
5. 밸류에이션: 현재 가격에 반영된 성장 가정 / 최악 시나리오 손실 / 5년 후 이 가격이 싸 보일 조건

각 항목은 ✅ 양호 / ⚠️ 주의 / ❌ 취약 으로 시작하고 한 줄 근거를 붙여줘.`;

function buildContext(data: AnalysisDetail): string {
  const metrics = data.metrics
    ?.map(m => `${m.label}: ${m.value}${m.unit ? ' ' + m.unit : ''}`)
    .join(', ') ?? '';

  return [
    `기업명: ${data.companyName}`,
    `요약: ${data.summary}`,
    metrics ? `주요 지표: ${metrics}` : '',
    data.strengths?.length ? `강점: ${data.strengths.slice(0, 3).join(' / ')}` : '',
    data.risks?.length ? `리스크: ${data.risks.slice(0, 3).join(' / ')}` : '',
    data.financials ? `재무: ${data.financials.slice(0, 400)}` : '',
    data.business_model ? `비즈니스 모델: ${data.business_model.slice(0, 400)}` : '',
    data.competitors
      ? `경쟁사: ${JSON.stringify(data.competitors).slice(0, 300)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default function AiAssistantPanel({ analysisData }: { analysisData: AnalysisDetail | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages([]);
    setInput('');
  }, [analysisData?.id]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !analysisData || isLoading) return;

    const updated: Message[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(updated);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updated,
          context: buildContext(analysisData),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageCircle size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">AI 비서</span>
        </div>
        {analysisData ? (
          <p className="text-xs text-blue-500 mt-0.5 ml-5 font-medium">{analysisData.companyName}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5 ml-5">분석 결과 기반 Q&A</p>
        )}
      </div>

      {/* No analysis state */}
      {!analysisData && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <MessageCircle size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            기업을 먼저 분석해주세요.<br />
            분석 후 질문할 수 있습니다.
          </p>
        </div>
      )}

      {/* Chat interface */}
      {analysisData && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-4">
                {analysisData.companyName} 분석 결과를 기반으로 질문해보세요.
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm leading-relaxed'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <div className="text-xs font-bold text-gray-900 mt-1 mb-0.5">{children}</div>,
                        h2: ({ children }) => <div className="text-xs font-semibold text-gray-900 mt-1.5 mb-0.5 border-b border-gray-200 pb-0.5">{children}</div>,
                        h3: ({ children }) => <div className="text-[11px] font-semibold text-gray-700 mt-1 mb-0.5">{children}</div>,
                        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                        p: ({ children }) => <p className="text-xs leading-relaxed mb-1 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-1 pl-3 space-y-0.5">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-1 pl-3 space-y-0.5 list-decimal">{children}</ol>,
                        li: ({ children }) => <li className="text-xs leading-relaxed list-disc">{children}</li>,
                        code: ({ children }) => <code className="bg-gray-200 text-gray-700 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-gray-300 pl-2 text-gray-600 italic my-1">{children}</blockquote>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <span className="leading-relaxed">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center">
                  {[0, 150, 300].map(delay => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          <div className="px-4 pt-2 pb-1.5 border-t border-gray-100 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
              빠른 질문
            </p>
            <div className="flex flex-col gap-1">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="text-left text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => sendMessage(MUNGER_PROMPT)}
                disabled={isLoading}
                className="text-left text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 border border-amber-200 bg-amber-50 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-0.5"
              >
                멍거 체크리스트
              </button>
            </div>
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="px-4 py-3 border-t border-gray-100 flex gap-2 items-end shrink-0"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="질문을 입력하세요... (Enter 전송)"
              rows={1}
              disabled={isLoading}
              className="flex-1 resize-none text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400 text-gray-900 disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: '80px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={13} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

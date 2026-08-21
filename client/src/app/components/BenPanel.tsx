'use client';

import { useState, useRef, useEffect, KeyboardEvent, FormEvent } from 'react';
import { MessageCircle, Send, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnalysisDetail } from '@/types';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';
import { useBenChat } from '@/app/hooks/useBenChat';

export type BenWidthPreset = 'default' | 'wide';

interface BenPanelProps {
  analysisData: AnalysisDetail | null;
  widthPreset?: BenWidthPreset;
  setWidthPreset?: (preset: BenWidthPreset) => void;
}

export default function BenPanel({ analysisData, widthPreset, setWidthPreset }: BenPanelProps) {
  const { session } = useAuth();
  const { language } = useLanguage();
  const uiT = getUiStrings(language).ben;
  const { messages, sendMessage, reset, isStreaming, rateLimited, error } = useBenChat(analysisData?.id ?? null);
  // 컨텍스트 인사말(2026-08-20) — Ben이 먼저 건네는 인사, 실제 유저 메시지가 아니므로
  // useBenChat의 messages(서버 대화 히스토리)엔 절대 안 실리고 이 컴포넌트 로컬 렌더에서만
  // 존재한다. messages.length===0(이 기업에 대해 아직 대화 이력 없음)일 때만 표시 — 기존
  // 대화가 있으면 그 위에 매번 겹쳐 보이는 어색함을 막고, 유저가 실제로 메시지를 보내는
  // 순간 messages.length가 바뀌어 자동으로 사라진다. 이 패널은 BenLauncher.tsx에서
  // {isOpen && <BenPanel/>}로 매번 마운트되므로, 별도 "한 번만 표시" 플래그 없이도
  // 열 때마다 자연히 다시 계산된다.
  const greeting = analysisData && messages.length === 0 ? uiT.greeting(analysisData.companyName) : null;

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    setInput('');
  }, [analysisData?.id]);

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    sendMessage(trimmed);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    handleSend(input);
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-navy-500" />
            <span className="text-sm font-semibold text-gray-900">{uiT.panelTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            {setWidthPreset && (
              <div className="hidden md:flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setWidthPreset('default')}
                  className={`text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                    widthPreset !== 'wide' ? 'text-navy-700 bg-navy-50' : 'text-gray-400 hover:text-navy-600'
                  }`}
                >
                  {uiT.widthDefault}
                </button>
                <button
                  type="button"
                  onClick={() => setWidthPreset('wide')}
                  className={`text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors ${
                    widthPreset === 'wide' ? 'text-navy-700 bg-navy-50' : 'text-gray-400 hover:text-navy-600'
                  }`}
                >
                  {uiT.widthWide}
                </button>
              </div>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                title={uiT.resetButton}
                aria-label={uiT.resetButton}
                className="text-gray-400 hover:text-navy-600 p-1 rounded transition-colors"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>
        {analysisData ? (
          <p className="text-xs text-navy-500 mt-0.5 ml-5 font-medium">{uiT.contextLabel(analysisData.companyName)}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5 ml-5">{uiT.hint}</p>
        )}
      </div>

      {/* No analysis state */}
      {!analysisData && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <MessageCircle size={18} className="text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{uiT.emptyState}</p>
        </div>
      )}

      {/* Chat interface */}
      {analysisData && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
            {greeting && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-xs bg-gray-100 text-gray-800 rounded-bl-sm">
                  <span className="leading-relaxed">{greeting}</span>
                </div>
              </div>
            )}
            {messages.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-4">
                {session ? uiT.hint : uiT.signInToChat}
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === 'user'
                      ? 'bg-navy-600 text-white rounded-br-sm leading-relaxed'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    msg.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
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
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className="text-[11px] border-collapse w-full">{children}</table>
                            </div>
                          ),
                          thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
                          tbody: ({ children }) => <tbody>{children}</tbody>,
                          tr: ({ children }) => <tr className="border-b border-gray-200">{children}</tr>,
                          th: ({ children }) => <th className="px-2 py-1 text-left font-semibold text-gray-700 border border-gray-300 whitespace-nowrap">{children}</th>,
                          td: ({ children }) => <td className="px-2 py-1 text-gray-700 border border-gray-300">{children}</td>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex gap-1 items-center py-1">
                        {[0, 150, 300].map(delay => (
                          <span
                            key={delay}
                            className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <span className="leading-relaxed">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {rateLimited && (
              <p className="text-[11px] text-risk text-center py-2">{uiT.rateLimited(rateLimited.usedCount, rateLimited.limit)}</p>
            )}
            {error && !rateLimited && (
              <p className="text-[11px] text-risk text-center py-2">{uiT.genericError}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          <div className="px-4 pt-2 pb-1.5 border-t border-gray-100 shrink-0">
            <div className="flex flex-col gap-1">
              {uiT.quickQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isStreaming}
                  className="text-left text-xs text-navy-600 hover:text-navy-800 hover:bg-navy-50 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => handleSend(uiT.mungerPrompt)}
                disabled={isStreaming}
                className="text-left text-xs text-navy-700 hover:text-navy-800 hover:bg-navy-100 border border-navy-200 bg-navy-50 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-0.5"
              >
                {uiT.mungerPromptLabel}
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
              placeholder={uiT.placeholder}
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none text-xs px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-navy-400 placeholder-gray-400 text-gray-900 disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: '80px', overflowY: 'auto' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="shrink-0 w-8 h-8 flex items-center justify-center bg-navy-600 hover:bg-navy-700 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={13} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}

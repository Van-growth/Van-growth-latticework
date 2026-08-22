'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { consumeBenSseStream, RateLimitInfo } from '@/lib/benSseClient';
import { BenMessage } from './useBenChat';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// 관리자 대시보드(/admin) 전용 Ben — POST /api/admin/insights/ask. analysis Ben
// (useBenChat)과 같은 SSE 프레임을 쓰지만(lib/benSseClient.ts 공유) 프로토콜은 다르다:
// 서버가 대화를 저장하지 않는 휘발성이라 GET으로 복원할 것도 DELETE로 지울 것도 없음
// (reset은 로컬 state만 비운다) — 대신 매 턴마다 지금까지의 대화를 priorMessages로
// 그대로 실어보낸다. 개별 유저 대상 id 없이 전체 유저 집계 하나만 다뤄서 useAdminBenChat
// (2026-08-22 폐기)과 달리 대상 파라미터가 없다.
export function useAdminInsightsChat() {
  const { session, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<BenMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rateLimited, setRateLimited] = useState<RateLimitInfo | null>(null);
  const [error, setError] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    if (!session) { signInWithGoogle(); return; }

    setError(false);
    setRateLimited(null);
    const priorMessages = messages; // 이번 유저 메시지를 붙이기 전 상태 — 서버에 그대로 전달
    setMessages(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/insights/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({ message: trimmed, priorMessages }),
      });

      if (!res.ok || !res.body) {
        setError(true);
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      let accumulated = '';
      await consumeBenSseStream(res, {
        onToken: (delta) => {
          accumulated += delta;
          const snapshot = accumulated;
          setMessages(prev => {
            const next = [...prev];
            next[next.length - 1] = { role: 'assistant', content: snapshot };
            return next;
          });
        },
        onRateLimited: (info) => {
          setRateLimited(info);
          setMessages(prev => prev.slice(0, -1));
        },
        onServerError: (reason) => {
          console.error('[useAdminInsightsChat] server reported an error', reason);
          setError(true);
          setMessages(prev => prev.slice(0, -1));
        },
      });
    } catch {
      setError(true);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [session, signInWithGoogle, isStreaming, messages]);

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, reset, isStreaming, rateLimited, error };
}

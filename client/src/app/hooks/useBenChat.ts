'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface BenMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RateLimitInfo {
  usedCount: number;
  limit: number;
  nextAvailableAt: string | null;
}

// SSE 소비 패턴은 HomeContent.tsx의 /api/analyze/stream 리더 파싱 로직과 동일한
// event:/data: 프레이밍을 그대로 재사용(far-study-app의 bare data: 프레이밍이 아님 —
// 이 저장소 자체 컨벤션 일관성 우선).
export function useBenChat(analysisId: string | null) {
  const { session, signInWithGoogle } = useAuth();
  const [messages, setMessages] = useState<BenMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [rateLimited, setRateLimited] = useState<RateLimitInfo | null>(null);
  const [error, setError] = useState(false);
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!analysisId || !session || loadedForRef.current === analysisId) return;
    loadedForRef.current = analysisId;
    setMessages([]);
    fetch(`${API_URL}/api/analyses/${analysisId}/ask`, {
      headers: buildAuthHeaders(null, session.access_token),
    })
      .then(r => (r.ok ? r.json() : { messages: [] }))
      .then((data: { messages?: BenMessage[] }) => setMessages(data.messages ?? []))
      .catch(() => { /* silent — panel just starts empty */ });
  }, [analysisId, session]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    if (!session) { signInWithGoogle(); return; }
    if (!analysisId) return;

    setError(false);
    setRateLimited(null);
    setMessages(prev => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      const res = await fetch(`${API_URL}/api/analyses/${analysisId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok || !res.body) {
        setError(true);
        setMessages(prev => prev.slice(0, -1));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr);
            if (eventType === 'token') {
              accumulated += payload.text ?? '';
              const snapshot = accumulated;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: snapshot };
                return next;
              });
            } else if (eventType === 'rate_limited') {
              setRateLimited({ usedCount: payload.usedCount ?? 0, limit: payload.limit ?? 0, nextAvailableAt: payload.nextAvailableAt ?? null });
              setMessages(prev => prev.slice(0, -1));
            } else if (eventType === 'error') {
              setError(true);
              setMessages(prev => prev.slice(0, -1));
            }
          } catch { /* skip malformed SSE payload */ }
        }
      }
    } catch {
      setError(true);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [analysisId, session, signInWithGoogle, isStreaming]);

  const reset = useCallback(async () => {
    if (!session || !analysisId) return;
    setMessages([]);
    try {
      await fetch(`${API_URL}/api/analyses/${analysisId}/ask`, {
        method: 'DELETE',
        headers: buildAuthHeaders(null, session.access_token),
      });
    } catch { /* local state already cleared */ }
  }, [analysisId, session]);

  return { messages, sendMessage, reset, isStreaming, rateLimited, error };
}

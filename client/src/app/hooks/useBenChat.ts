'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { consumeBenSseStream, RateLimitInfo } from '@/lib/benSseClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface BenMessage {
  role: 'user' | 'assistant';
  content: string;
}

// SSE 소비 패턴은 HomeContent.tsx의 /api/analyze/stream 리더 파싱 로직과 동일한
// event:/data: 프레이밍을 그대로 재사용(far-study-app의 bare data: 프레이밍이 아님 —
// 이 저장소 자체 컨벤션 일관성 우선). 실제 프레임 파싱은 lib/benSseClient.ts 공유 —
// 관리자 Ben(useAdminInsightsChat)도 동일한 파서를 쓴다.
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

      let accumulated = '';
      await consumeBenSseStream(res, {
        onToken: (text) => {
          accumulated += text;
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
          // reason은 화면에 노출하지 않고 콘솔에만 남긴다 — 서버 로그 없이도
          // Network 탭 Response에서 원인 카테고리를 바로 확인할 수 있게(2026-08-16).
          // 'upstream' = Claude API 호출 자체가 실패(계정 사용량 한도 등 외부 요인),
          // 'not_found' = 분석을 못 찾음, 그 외(server) = 서버 내부 오류.
          console.error('[useBenChat] server reported an error', reason);
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

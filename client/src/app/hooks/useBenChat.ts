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

// 대화 이력 복원(GET) 실패 원인 — 'auth'(토큰 만료 등 401, 재시도가 아니라 재로그인/
// 새로고침으로만 해결됨)와 'network'(서버 500·타임아웃·네트워크 오류, 재시도하면
// 될 수 있음)를 구분한다. 이전엔 둘 다 조용히 빈 배열로 대체돼 저장은 정상인데
// 화면엔 "대화가 사라진 것"처럼 보이는 버그였다(2026-08-22).
export type BenLoadError = 'auth' | 'network' | null;

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
  const [loadError, setLoadError] = useState<BenLoadError>(null);
  const loadedForRef = useRef<string | null>(null);

  const loadMessages = useCallback((id: string, accessToken: string) => {
    setLoadError(null);
    fetch(`${API_URL}/api/analyses/${id}/ask`, {
      headers: buildAuthHeaders(null, accessToken),
    })
      .then(async r => {
        if (r.ok) {
          const data = await r.json() as { messages?: BenMessage[] };
          setMessages(data.messages ?? []);
          return;
        }
        // 401 = 토큰 만료(새로고침 안내), 그 외(500 등) = 서버/네트워크 오류(재시도 안내).
        setLoadError(r.status === 401 ? 'auth' : 'network');
      })
      .catch(() => setLoadError('network'));
  }, []);

  useEffect(() => {
    if (!analysisId || !session || loadedForRef.current === analysisId) return;
    loadedForRef.current = analysisId;
    setMessages([]);
    loadMessages(analysisId, session.access_token);
  }, [analysisId, session, loadMessages]);

  // 재시도 버튼 전용 — loadedForRef 가드는 "이 analysisId로 첫 로드를 이미 시도했는지"만
  // 추적하는 용도라, 실패 후 재시도는 그 가드와 무관하게 항상 다시 fetch해야 한다.
  const retryLoad = useCallback(() => {
    if (!analysisId || !session) return;
    loadMessages(analysisId, session.access_token);
  }, [analysisId, session, loadMessages]);

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

  return { messages, sendMessage, reset, isStreaming, rateLimited, error, loadError, retryLoad };
}

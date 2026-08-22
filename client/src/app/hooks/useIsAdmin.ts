'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// 관리자 대시보드 네비 링크(Header.tsx)와 페이지 접근 게이트(/admin/users) 둘 다 이
// 훅으로 profiles.role을 확인한다 — 실제 보안 경계는 서버(resolveAdminUser, 401/403)이고
// 이건 순수 UX(링크 숨김/조용한 리다이렉트)일 뿐이다. GET /api/profile은 이미 온보딩
// 체크용으로 존재하던 엔드포인트라 role 필드 하나만 얹었다(신규 엔드포인트 없음).
export function useIsAdmin() {
  const { session, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/profile`, { headers: buildAuthHeaders(null, session.access_token) })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { role?: string } | null) => {
        if (!cancelled) setIsAdmin(data?.role === 'admin');
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [session, authLoading]);

  return { isAdmin, loading: authLoading || loading };
}

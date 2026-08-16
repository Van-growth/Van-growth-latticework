'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import Header from '@/app/components/Header';
import LoginPromptModal from '@/app/components/LoginPromptModal';
import { AnalysisSummary, AnalysisDetail } from '@/types';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { getUiStrings } from '@/lib/i18n/uiStrings';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

export default function HistoryPage() {
  const router = useRouter();
  const { setAnalysisData } = useAnalysis();
  const { session, loading: authLoading, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const uiT = getUiStrings(language);
  const t = uiT.history;
  const [list, setList] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 로그인 안 했으면 목록 자체를 요청하지 않는다 — 서버도 이제 하드 401이지만,
    // 불필요한 401 왕복 없이 바로 로그인 유도 화면을 보여주는 게 낫다.
    if (!session) { setList([]); setLoading(false); return; }
    setLoading(true);
    fetch(`${API_URL}/api/analyses`, {
      headers: buildAuthHeaders(null, session.access_token),
    })
      .then(r => (r.ok ? r.json() : []))
      .then((data: AnalysisSummary[]) => setList(data))
      .catch(() => setError(t.loadError))
      .finally(() => setLoading(false));
  }, [session, t.loadError]);

  // ★ 즐겨찾기(고정 상단) / 최근 조회(그 아래) 2섹션 — 서버가 isFavorited 플래그만 실어
  // 보내는 단일 목록을 클라이언트에서 나눈다(별도 엔드포인트 없음). 즐겨찾기에 이미 뜬
  // 항목은 최근 조회에서 중복 노출하지 않는다.
  const favorites = useMemo(() => list.filter(item => item.isFavorited), [list]);
  const recent = useMemo(() => list.filter(item => !item.isFavorited), [list]);

  async function handleSelect(id: string) {
    if (!session) return;
    // Fetch detail and update context so panel reflects the selected analysis
    try {
      const res = await fetch(`${API_URL}/api/analyses/${id}`, {
        headers: buildAuthHeaders(null, session.access_token),
      });
      const data = await res.json();
      setAnalysisData(data as AnalysisDetail);
    } catch {
      // Context update is best-effort; navigation proceeds regardless
    }
    router.push(`/?id=${id}`);
  }

  async function handleToggleFavorite(e: React.MouseEvent, item: AnalysisSummary) {
    e.stopPropagation();
    if (!session) return;
    const next = !item.isFavorited;
    // 낙관적 업데이트 — 실패 시 원상복구
    setList(prev => prev.map(x => (x.id === item.id ? { ...x, isFavorited: next } : x)));
    try {
      const res = await fetch(`${API_URL}/api/analyses/${item.id}/favorite`, {
        method: next ? 'POST' : 'DELETE',
        headers: buildAuthHeaders(null, session.access_token),
      });
      if (!res.ok) throw new Error();
    } catch {
      setList(prev => prev.map(x => (x.id === item.id ? { ...x, isFavorited: !next } : x)));
    }
  }

  function ListItem({ item }: { item: AnalysisSummary }) {
    return (
      <button
        onClick={() => handleSelect(item.id)}
        className="w-full text-left bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm hover:shadow-md hover:border-navy-200 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="font-semibold text-gray-900">{item.companyName}</span>
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.summary}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-xs text-gray-400">
              {new Date(item.createdAt).toLocaleDateString(language === 'ko' ? 'ko-KR' : 'en-US')}
            </span>
            <button
              type="button"
              onClick={e => handleToggleFavorite(e, item)}
              aria-label={item.isFavorited ? uiT.home.favoriteRemove : uiT.home.favoriteAdd}
              className="p-0.5"
            >
              <Star
                size={16}
                className={item.isFavorited ? 'fill-source-reference text-source-reference' : 'text-gray-300 hover:text-gray-400'}
              />
            </button>
            <span className="text-gray-400 text-sm">→</span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">{t.title}</h1>

        {authLoading ? (
          <p className="text-gray-500">{t.loading}</p>
        ) : !session ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">{t.loginRequired}</p>
          </div>
        ) : (
          <>
            {loading && <p className="text-gray-500">{t.loading}</p>}
            {error && <p className="text-risk text-sm">{error}</p>}

            {!loading && list.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg mb-2">{t.empty}</p>
                <Link href="/" className="text-navy-600 text-sm hover:underline">{t.emptyCta}</Link>
              </div>
            )}

            {!loading && list.length > 0 && (
              <div className="space-y-10">
                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.favoritesTitle}</h2>
                  {favorites.length === 0 ? (
                    <p className="text-sm text-gray-400">{t.favoritesEmpty}</p>
                  ) : (
                    <div className="space-y-3">
                      {favorites.map(item => <ListItem key={item.id} item={item} />)}
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.recentTitle}</h2>
                  {recent.length === 0 ? (
                    <p className="text-sm text-gray-400">{t.recentEmpty}</p>
                  ) : (
                    <div className="space-y-3">
                      {recent.map(item => <ListItem key={item.id} item={item} />)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!authLoading && !session && (
        <LoginPromptModal
          companyName=""
          onClose={() => router.push('/')}
          onContinue={() => signInWithGoogle()}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/app/components/Header';
import LoginPromptModal from '@/app/components/LoginPromptModal';
import { AnalysisSummary, AnalysisDetail } from '@/types';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

export default function HistoryPage() {
  const router = useRouter();
  const { setAnalysisData } = useAnalysis();
  const { session, loading: authLoading, signInWithGoogle } = useAuth();
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
      .catch(() => setError('분석 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [session]);

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

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">분석 히스토리</h1>

        {authLoading ? (
          <p className="text-gray-500">불러오는 중...</p>
        ) : !session ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">로그인 후 이용할 수 있습니다.</p>
          </div>
        ) : (
          <>
            {loading && <p className="text-gray-500">불러오는 중...</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}

            {!loading && list.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg mb-2">아직 분석 결과가 없습니다.</p>
                <Link href="/" className="text-blue-600 text-sm hover:underline">첫 번째 기업을 분석해보세요 →</Link>
              </div>
            )}

            <div className="space-y-3">
              {list.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 px-5 py-4 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{item.companyName}</span>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.summary}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      <span className="text-gray-400 text-sm">→</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import LinkedInDraftCard from '../components/LinkedInDraftCard';
import { AnalysisSummary, AnalysisDetail } from '@/types';
import { useAnalysis } from '@/app/context/AnalysisContext';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

export default function LinkedInPage() {
  const { setAnalysisData } = useAnalysis();
  const [list, setList] = useState<AnalysisSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/analyses`)
      .then(r => r.json())
      .then((data: AnalysisSummary[]) => {
        setList(data);
        if (data.length > 0) handleSelect(data[0].id);
      })
      .catch(() => setError('목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(id: string) {
    setSelected(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analyses/${id}`);
      const data = await res.json();
      setDetail(data as AnalysisDetail);
      setAnalysisData(data as AnalysisDetail);
    } catch {
      setError('초안을 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">Latticework</Link>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-800">분석</Link>
            <Link href="/history" className="text-gray-500 hover:text-gray-800">히스토리</Link>
            <Link href="/linkedin" className="text-blue-600 font-medium">LinkedIn</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LinkedIn 초안</h1>
        <p className="text-gray-500 mb-8">분석 결과를 기반으로 생성된 LinkedIn 게시물 초안입니다.</p>

        {loading && <p className="text-gray-500">불러오는 중...</p>}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {!loading && list.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">아직 생성된 초안이 없습니다.</p>
            <Link href="/" className="text-blue-600 text-sm hover:underline">기업 분석을 먼저 실행해주세요 →</Link>
          </div>
        )}

        {list.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Company list */}
            <div className="lg:col-span-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">기업 선택</h2>
              <div className="space-y-2">
                {list.map(item => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                      selected === item.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="font-medium">{item.companyName}</div>
                    <div className={`text-xs mt-0.5 ${selected === item.id ? 'text-blue-100' : 'text-gray-400'}`}>
                      {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Drafts */}
            <div className="lg:col-span-2">
              {detailLoading && (
                <div className="flex items-center justify-center h-40 text-gray-400">
                  불러오는 중...
                </div>
              )}
              {!detailLoading && detail && (
                <>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {detail.companyName} — 초안 {detail.linkedinDrafts.length}개
                  </h2>
                  {detail.linkedinDrafts.length === 0 ? (
                    <p className="text-gray-400 text-sm">이 분석에는 LinkedIn 초안이 없습니다.</p>
                  ) : (
                    <div className="space-y-4">
                      {detail.linkedinDrafts.map(d => (
                        <LinkedInDraftCard key={d.id} draft={d} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

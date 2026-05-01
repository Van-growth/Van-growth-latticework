'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AnalysisCard from '../components/AnalysisCard';
import { AnalysisSummary, AnalysisDetail } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HistoryPage() {
  const [list, setList] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AnalysisDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/analyses`)
      .then(r => r.json())
      .then((data: AnalysisSummary[]) => setList(data))
      .catch(() => setError('분석 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(id: string) {
    if (selected?.id === id) { setSelected(null); return; }
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/analyses/${id}`);
      const data = await res.json();
      setSelected(data as AnalysisDetail);
    } catch {
      setError('상세 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg">Latticework</Link>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-gray-500 hover:text-gray-800">분석</Link>
            <Link href="/history" className="text-blue-600 font-medium">히스토리</Link>
            <Link href="/linkedin" className="text-gray-500 hover:text-gray-800">LinkedIn</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">분석 히스토리</h1>

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
            <div key={item.id}>
              <button
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left bg-white rounded-xl border px-5 py-4 shadow-sm hover:shadow-md transition-shadow ${
                  selected?.id === item.id ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-100'
                }`}
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
                    <span className="text-gray-400 text-sm">{selected?.id === item.id ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {selected?.id === item.id && (
                <div className="mt-2">
                  {detailLoading ? (
                    <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
                      불러오는 중...
                    </div>
                  ) : (
                    <AnalysisCard data={selected} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

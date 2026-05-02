'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnalysisCard from './AnalysisCard';
import AnalysisLoader from './AnalysisLoader';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { AnalysisDetail, AnalyzeResponse } from '@/types';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

function normalizeResponse(data: AnalyzeResponse): AnalysisDetail {
  return {
    ...data,
    id: data.analysisId ?? data.id,
    valuechainPlayers: data.valuechainPlayers ?? [],
  };
}

export default function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const { setAnalysisData } = useAnalysis();

  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!urlId) return;
    if (loadedIdRef.current === urlId) return;

    setFetchingId(true);
    setError(null);
    fetch(`${API_URL}/api/analyses/${urlId}`)
      .then(r => r.json())
      .then((data: AnalysisDetail) => {
        setResult(data);
        setAnalysisData(data);
        loadedIdRef.current = urlId;
      })
      .catch(() => setError('분석 결과를 불러오지 못했습니다.'))
      .finally(() => setFetchingId(false));
  }, [urlId, setAnalysisData]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '분석 중 오류가 발생했습니다.'); return; }

      const normalized = normalizeResponse(data as AnalyzeResponse);
      loadedIdRef.current = normalized.id;
      setResult(normalized);
      setAnalysisData(normalized);
      router.replace(`/?id=${normalized.id}`);
    } catch {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">기업 심층 분석</h1>
        <p className="text-gray-500">Claude AI + Web Search — 산업역사, 기술변화, 밸류체인, BM, 재무를 한번에</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <input
            type="text"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            placeholder="기업명 입력 (예: 삼성전자, Apple, NVIDIA)"
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !companyName.trim()}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </div>
      </form>

      {/* Loading states */}
      {loading && <AnalysisLoader companyName={companyName.trim()} />}
      {fetchingId && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          불러오는 중...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result */}
      {result && !loading && !fetchingId && (
        <AnalysisCard data={result} />
      )}
    </div>
  );
}

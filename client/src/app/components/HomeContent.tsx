'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, Link, X, RefreshCw } from 'lucide-react';
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

function emptyBase(name: string): AnalysisDetail {
  return {
    id: '',
    companyName: name,
    summary: '',
    industry_history: '',
    tech_evolution: '',
    value_chain_overview: '',
    business_model: '',
    financials: '',
    metrics: [],
    strengths: [],
    risks: [],
    moat_analysis: null,
    risk_analysis: null,
    competitors: null,
    strategy: null,
    sources: {},
    valuechainPlayers: [],
    createdAt: new Date().toISOString(),
  };
}

export default function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const { setAnalysisData, setCompletedBatches } = useAnalysis();

  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState<AnalysisDetail | null>(null);
  const [displayData, setDisplayData] = useState<AnalysisDetail | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isShared, setIsShared] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState('');

  const loadedIdRef = useRef<string | null>(null);
  const streamingRef = useRef<AnalysisDetail | null>(null);

  useEffect(() => {
    if (result) {
      setIsShared(result.is_shared ?? false);
      setShareToken(result.share_token ?? null);
    }
  }, [result]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleShare() {
    if (!result?.id || sharing) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_URL}/api/analyses/${result.id}/share`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShareToken(data.share_token);
      setIsShared(true);
      const url = `${window.location.origin}/share/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      showToast('링크 복사됨!');
    } catch {
      showToast('공유 링크 생성 실패');
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    showToast('링크 복사됨!');
  }

  async function handleRevoke() {
    if (!result?.id) return;
    try {
      await fetch(`${API_URL}/api/analyses/${result.id}/share`, { method: 'DELETE' });
      setIsShared(false);
      setShareToken(null);
      showToast('공유가 해제되었습니다.');
    } catch {
      showToast('공유 해제 실패');
    }
  }

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
        setCompletedBatches(new Set([1, 2, 3, 4]));
        loadedIdRef.current = urlId;
      })
      .catch(() => setError('분석 결과를 불러오지 못했습니다.'))
      .finally(() => setFetchingId(false));
  }, [urlId, setAnalysisData]);

  async function startAnalysis(name: string, forceRefresh: boolean) {
    setLoading(true);
    setError(null);
    setResult(null);
    setDisplayData(null);
    setProgress(null);
    setIsCached(false);
    setCompletedBatches(new Set([-1])); // sentinel: streaming started, no batch done yet → all tabs show skeleton
    streamingRef.current = null;

    try {
      const res = await fetch(`${API_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: name, forceRefresh }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as { error?: string }).error || '분석 중 오류가 발생했습니다.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            if (line.startsWith('data: '))  dataStr  = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr);

            if (eventType === 'batch') {
              const batchNum = payload.batch as number;
              const batchData = payload.data as Partial<AnalysisDetail>;
              if (!streamingRef.current) {
                streamingRef.current = Object.assign(emptyBase(name), batchData);
              } else {
                streamingRef.current = { ...streamingRef.current, ...batchData } as AnalysisDetail;
              }
              setDisplayData({ ...streamingRef.current });
              setCompletedBatches(prev => new Set([...prev, batchNum]));
              setProgress({ completed: payload.completed, total: payload.total });

            } else if (eventType === 'done') {
              const normalized = normalizeResponse(payload as AnalyzeResponse);
              setIsCached(payload.cached === true);
              loadedIdRef.current = normalized.id;
              setResult(normalized);
              setAnalysisData(normalized);
              setCompletedBatches(new Set([1, 2, 3, 4]));
              if (normalized.id) router.replace(`/?id=${normalized.id}`);

            } else if (eventType === 'error') {
              setError(payload.message || '분석 중 오류가 발생했습니다.');
            }
          } catch {
            // malformed SSE line, skip
          }
        }
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || loading) return;
    await startAnalysis(companyName.trim(), false);
  }

  async function handleForceRefresh() {
    if (!companyName.trim() || loading) return;
    await startAnalysis(companyName.trim(), true);
  }

  // Show card immediately when loading starts (skeleton state via sentinel completedBatches)
  const showCard = result ?? (loading ? (displayData ?? emptyBase(companyName.trim())) : null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
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

      {/* Progress bar */}
      {loading && progress && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>분석 중 배치 {progress.completed} / {progress.total} 완료</span>
            <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* AnalysisLoader removed — card with skeleton shows immediately via showCard + sentinel completedBatches */}

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

      {/* Result (final or streaming partial) */}
      {showCard && !fetchingId && (
        <div>
          {/* Cache banner */}
          {result && isCached && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-3">
              <span className="text-xs text-amber-700">
                이전 분석 결과입니다 ({new Date(result.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })})
              </span>
              <button
                onClick={handleForceRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
              >
                <RefreshCw size={12} />
                새로 분석하기
              </button>
            </div>
          )}

          {/* Share bar — only when analysis is saved (has real ID) */}
          {result && (
            <div className="flex items-center justify-end gap-2 mb-3">
              {isShared ? (
                <>
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    공유 중
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Link size={12} />
                    링크 복사
                  </button>
                  <button
                    onClick={handleRevoke}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <X size={12} />
                    공유 해제
                  </button>
                </>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  <Share2 size={12} />
                  {sharing ? '생성 중...' : '공유'}
                </button>
              )}
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
              {toast}
            </div>
          )}

          <AnalysisCard data={showCard} />
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import AnalysisCard from './components/AnalysisCard';
import LinkedInDraftCard from './components/LinkedInDraftCard';
import { AnalysisDetail, LinkedInDraft } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface AnalyzeResult extends AnalysisDetail {
  linkedinDrafts: LinkedInDraft[];
}

export default function Home() {
  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLinkedIn, setShowLinkedIn] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setShowLinkedIn(false);

    try {
      const res = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || '분석 중 오류가 발생했습니다.'); return; }
      setResult(data as AnalyzeResult);
    } catch {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-lg">Latticework</span>
          <div className="flex gap-4 text-sm">
            <Link href="/" className="text-blue-600 font-medium">분석</Link>
            <Link href="/history" className="text-gray-500 hover:text-gray-800">히스토리</Link>
            <Link href="/linkedin" className="text-gray-500 hover:text-gray-800">LinkedIn</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
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

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <div className="inline-block w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-700 font-medium">{companyName} 분석 중...</p>
            <p className="text-sm text-gray-400 mt-1">웹 검색 + AI 분석 (약 30–90초)</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="space-y-6">
            <AnalysisCard data={result} />

            {/* LinkedIn drafts toggle */}
            {result.linkedinDrafts?.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLinkedIn(v => !v)}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span>{showLinkedIn ? '▲' : '▼'}</span>
                  LinkedIn 초안 {result.linkedinDrafts.length}개 {showLinkedIn ? '닫기' : '보기'}
                </button>
                {showLinkedIn && (
                  <div className="mt-4 space-y-4">
                    {result.linkedinDrafts.map(d => (
                      <LinkedInDraftCard key={d.draft_number} draft={d} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

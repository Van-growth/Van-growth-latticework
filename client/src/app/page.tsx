'use client';

import { useState, FormEvent } from 'react';

interface AnalysisResult {
  companyName: string;
  analysisId: string;
  content: string;
  createdAt: string;
}

export default function Home() {
  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${apiUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '분석 중 오류가 발생했습니다.');
        return;
      }

      setResult(data as AnalysisResult);
    } catch {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function formatContent(content: string) {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        return (
          <h2 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">
            {line.replace(/^#+\s/, '')}
          </h2>
        );
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <p key={i} className="font-semibold text-gray-800 mt-3">
            {line.replace(/\*\*/g, '')}
          </p>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={i} className="ml-4 text-gray-700 list-disc">
            {line.replace(/^[-*]\s/, '')}
          </li>
        );
      }
      if (line.trim() === '') return <br key={i} />;
      return (
        <p key={i} className="text-gray-700 leading-relaxed">
          {line}
        </p>
      );
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Latticework
          </h1>
          <p className="text-gray-500 text-lg">
            AI 기반 기업 심층 분석 플랫폼
          </p>
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex gap-3">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="기업명을 입력하세요 (예: 삼성전자, Apple, Tesla)"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-900 placeholder-gray-400"
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-500">
              <span className="font-medium text-gray-700">{companyName}</span>을(를) 분석하고 있습니다...
            </p>
            <p className="text-sm text-gray-400 mt-1">웹 검색 및 AI 분석 중 (약 30–60초 소요)</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{result.companyName}</h2>
              <span className="text-xs text-gray-400">
                {new Date(result.createdAt).toLocaleString('ko-KR')}
              </span>
            </div>
            <div className="prose prose-sm max-w-none">
              {formatContent(result.content)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AnalysisCard from '@/app/components/AnalysisCard';
import { AnalysisDetail } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ShareContent({ token }: { token: string }) {
  const [data, setData] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/share/${token}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const date = data
    ? new Date(data.createdAt).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg hover:text-blue-600 transition-colors">
            ← Latticework
          </Link>
          {data && (
            <span className="text-xs text-gray-400">
              {data.companyName} · {date}
            </span>
          )}
        </div>
      </nav>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {loading && (
          <div className="text-center py-24 text-gray-400 text-sm">불러오는 중...</div>
        )}

        {!loading && notFound && (
          <div className="text-center py-24">
            <p className="text-gray-500 text-lg mb-2">공유된 분석을 찾을 수 없습니다.</p>
            <p className="text-gray-400 text-sm mb-6">링크가 만료되었거나 공유가 해제되었을 수 있습니다.</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition-colors"
            >
              직접 분석해보기 →
            </Link>
          </div>
        )}

        {!loading && data && <AnalysisCard data={data} />}
      </div>

      {/* Watermark */}
      {!loading && data && (
        <div className="text-xs text-gray-400 text-center border-t border-gray-100 pt-4 mt-8 pb-8">
          Ben의 개인 프로젝트 · 특정 기업 분석 열람 목적으로만 활용 부탁드립니다 · Powered by Latticework
        </div>
      )}
    </div>
  );
}

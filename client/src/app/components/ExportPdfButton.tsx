'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { pdf } from '@react-pdf/renderer';
import AnalysisPdf from './AnalysisPdf';
import type { AnalysisDetail } from '@/types';
import { Download, FileText } from 'lucide-react';

const MESSAGES = [
  '밤새 조사하셨을 내용을 몇 분 만에 처리하고 있어요 🌙',
  '인턴한테 시켰으면 3일 걸렸을 거예요 😅',
  '미팅 전날 밤 구글링하던 시절은 안녕 👋',
  '영업팀 리서치 담당자를 대신하는 중...',
  '경쟁사 분석 PPT 만들 시간, 이제 영업에 쓰세요 💪',
  'BD 미팅 전 밤샘 조사? 그건 옛날 얘기예요 ☕',
  '전략팀이 1주일 걸릴 자료, 지금 뽑는 중 🚀',
  'SEC 공시 수백 페이지를 대신 읽고 있어요 📄',
  '이 PDF 하나로 미팅 준비 끝입니다 ✅',
];

function LoadingOverlay() {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    setMsgIdx(Math.floor(Math.random() * MESSAGES.length));
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 3000);
    return () => clearInterval(id);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <FileText size={24} className="text-blue-600" />
        </div>
        <p className="text-sm text-gray-700 text-center leading-relaxed min-h-[3em]">
          {MESSAGES[msgIdx]}
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ExportPdfButton({ data }: { data: AnalysisDetail }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const shareUrl = data.share_token
        ? `${window.location.origin}/share/${data.share_token}`
        : undefined;
      const blob = await pdf(<AnalysisPdf data={data} shareUrl={shareUrl} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.companyName.replace(/\s+/g, '_')}_분석보고서.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {mounted && loading && <LoadingOverlay />}
      <button
        onClick={handleClick}
        disabled={loading}
        title={error ? 'PDF 생성 오류 — 다시 시도' : 'PDF 파일로 내보내기'}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
          border transition-colors
          ${error
            ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'
            : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300'
          }
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <Download size={12} className={loading ? 'animate-pulse' : ''} />
        {loading ? 'PDF 준비 중...' : 'PDF 내보내기'}
      </button>
    </>
  );
}

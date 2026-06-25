'use client';

import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import AnalysisPdf from './AnalysisPdf';
import type { AnalysisDetail } from '@/types';
import { Download } from 'lucide-react';

export default function ExportPdfButton({ data }: { data: AnalysisDetail }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

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
  );
}

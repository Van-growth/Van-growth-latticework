'use client';

import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import AnalysisPdf from './AnalysisPdf';
import type { AnalysisDetail } from '@/types';
import { Download } from 'lucide-react';

export default function ExportPdfButton({ data }: { data: AnalysisDetail }) {
  const filename = `${data.companyName.replace(/\s+/g, '_')}_분석보고서.pdf`;

  return (
    <PDFDownloadLink
      document={<AnalysisPdf data={data} />}
      fileName={filename}
      style={{ textDecoration: 'none' }}
    >
      {({ loading, error }) => (
        <button
          className={`
            flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
            border transition-colors
            ${error
              ? 'border-red-200 text-red-600 bg-red-50'
              : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300'
            }
          `}
          disabled={loading}
          title={error ? `오류: ${error.message}` : 'PDF 파일로 내보내기'}
        >
          <Download size={12} className={loading ? 'animate-pulse' : ''} />
          {loading ? 'PDF 준비 중...' : 'PDF 내보내기'}
        </button>
      )}
    </PDFDownloadLink>
  );
}

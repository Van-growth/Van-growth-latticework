'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { pdf } from '@react-pdf/renderer';
import AnalysisPdf from './AnalysisPdf';
import type { AnalysisDetail } from '@/types';
import { Download, FileText } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

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

const STAGES = [
  { icon: '📊', label: '데이터 수집' },
  { icon: '📝', label: '리포트 작성' },
  { icon: '📄', label: 'PDF 변환' },
] as const;

function LoadingOverlay({ completed, onCancel }: { completed: boolean; onCancel: () => void }) {
  const [msgIdx, setMsgIdx]     = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [elapsed, setElapsed]   = useState(0);
  const [progress, setProgress] = useState(0);

  // 메시지 초기 랜덤 선택
  useEffect(() => {
    setMsgIdx(Math.floor(Math.random() * MESSAGES.length));
  }, []);

  // 경과 시간
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 프로그레스 바 (가짜 0→90%, 완료 시 100%)
  useEffect(() => {
    if (completed) {
      setProgress(100);
      return;
    }
    const id = setInterval(() => {
      setProgress(p => {
        const remaining = 90 - p;
        return Math.min(90, p + Math.max(0.4, remaining * 0.045));
      });
    }, 400);
    return () => clearInterval(id);
  }, [completed]);

  // 메시지 fade out → 새 메시지 → fade in
  useEffect(() => {
    const id = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % MESSAGES.length);
        setMsgVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // 단계: 0-20s → 20-45s → 45s+
  const stageIdx = elapsed < 20 ? 0 : elapsed < 45 ? 1 : 2;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-7 max-w-sm w-full mx-4 flex flex-col items-center gap-5">

        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <FileText size={24} className="text-blue-600" />
        </div>

        {/* 메시지 (fade + slide 애니메이션) */}
        <p
          className="text-sm text-gray-700 text-center leading-relaxed min-h-[3em]"
          style={{
            opacity:    msgVisible ? 1 : 0,
            transform:  msgVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: 'opacity 0.28s ease, transform 0.28s ease',
          }}
        >
          {MESSAGES[msgIdx]}
        </p>

        {/* 단계 표시 */}
        <div className="flex items-center gap-3 w-full justify-center">
          {STAGES.map((stage, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5"
              style={{ transition: 'opacity 0.4s ease' }}
            >
              <div
                className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all duration-300 ${
                  i === stageIdx
                    ? 'bg-blue-50 text-blue-600'
                    : i < stageIdx
                    ? 'text-gray-400 line-through'
                    : 'text-gray-300'
                }`}
              >
                <span>{stage.icon}</span>
                <span>{stage.label}</span>
              </div>
              {/* 단계 간 구분선 */}
              {i < STAGES.length - 1 && (
                <span className="absolute" style={{ display: 'none' }} />
              )}
            </div>
          ))}
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full space-y-1.5">
          <div className="flex justify-between items-center text-[11px] text-gray-400">
            <span>PDF 준비 중...</span>
            <span>{elapsed}초</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{
                width:      `${progress}%`,
                transition: completed ? 'width 0.4s ease-out' : 'width 0.4s ease-out',
              }}
            />
          </div>
          <div className="text-right text-[11px] text-gray-300">
            {Math.round(progress)}%
          </div>
        </div>

        {/* 취소 버튼 — 생성 완료 전에만 표시 */}
        {!completed && (
          <button
            onClick={onCancel}
            className="text-[11px] text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline transition-colors"
          >
            취소
          </button>
        )}

      </div>
    </div>,
    document.body,
  );
}

export default function ExportPdfButton({ data }: { data: AnalysisDetail }) {
  const [loading,   setLoading]   = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error,     setError]     = useState(false);
  const [mounted,   setMounted]   = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  function handleCancel() {
    cancelledRef.current = true;
    setLoading(false);
    setCompleted(false);
  }

  async function handleClick() {
    if (loading) return;
    trackEvent('pdf_export_attempted', { companyName: data.companyName });
    cancelledRef.current = false;
    setLoading(true);
    setCompleted(false);
    setError(false);
    try {
      const shareUrl = data.share_token
        ? `${window.location.origin}/share/${data.share_token}`
        : undefined;
      const blob = await pdf(<AnalysisPdf data={data} shareUrl={shareUrl} />).toBlob();

      if (cancelledRef.current) return;

      // 100% 표시 후 0.6초 뒤 다운로드
      setCompleted(true);
      await new Promise(r => setTimeout(r, 600));

      if (cancelledRef.current) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.companyName.replace(/\s+/g, '_')}_분석보고서.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      if (!cancelledRef.current) setError(true);
    } finally {
      setLoading(false);
      setCompleted(false);
    }
  }

  return (
    <>
      {mounted && loading && <LoadingOverlay completed={completed} onCancel={handleCancel} />}
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

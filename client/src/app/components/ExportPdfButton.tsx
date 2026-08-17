'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { pdf } from '@react-pdf/renderer';
import AnalysisPdf from './AnalysisPdf';
import type { AnalysisDetail } from '@/types';
import { Download, FileText } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

// 2026-08-17 개편 — 장난스러운 톤(이모지·인턴 드립 등)을 신뢰감 있는 톤으로 교체.
// 원칙: (1) 실존 기업가 인용/명언 금지(저작권·정확성 리스크, 클리셰 위험) (2) EDGAR/DART
// 등 특정 데이터 소스 언급 금지 — 공시 데이터가 없는 기업(재무 탭이 빈 상태)에는 사실과
// 안 맞을 수 있어 전 기업에 공통 적용 가능한 소스 중립적 문구만 사용 (3) "지금 이 작업을
// 하고 있어요" + 응원 톤.
const BASE_MESSAGES = [
  '숫자 뒤에 숨은 맥락까지 짚어드리려 하고 있어요.',
  '이 리포트가 다음 결정에 확신을 더해드리길 바라요.',
  '대표님의 다음 한 걸음을, 저희가 먼저 살펴보고 있어요.',
  '빠른 판단은 좋은 정보에서 시작됩니다 — 거의 다 됐어요.',
  '여러 자료를 교차 확인하며 놓친 부분이 없는지 살피고 있어요.',
  '이 회사가 지금 처한 상황을 다각도로 정리하는 중이에요.',
  '필요한 순간 바로 꺼내 쓸 수 있도록 다듬고 있어요.',
  '복잡한 내용을 한눈에 들어오도록 구조화하는 중이에요.',
  '조금만 더 기다려 주시면, 그만한 값어치로 보답할게요.',
];

// purpose_category를 활용한 목적 요약 문구(2026-08-17, 여유 범위 내 반영) — 원본
// purpose_detail(자유 입력 텍스트)은 문장 템플릿에 안전하게 끼워 넣기 어려워 사용하지
// 않고, 카테고리 단위로만 요약한다.
function purposeMessage(category?: string | null): string | null {
  switch (category) {
    case 'ma':          return '인수합병 목적에 맞춰 재무 건전성과 핏을 짚어보는 중이에요.';
    case 'investment':  return '투자 판단에 도움이 될 지표들을 우선 정리하고 있어요.';
    case 'partnership': return '파트너십 관점에서 이 회사와의 접점을 살펴보는 중이에요.';
    case 'customer':    return '고객사로서 검토하실 때 필요한 정보를 챙기고 있어요.';
    case 'other':        return '말씀하신 목적에 맞춰 필요한 내용을 짚어드리려 하고 있어요.';
    default: return null;
  }
}

function buildMessages(purposeCategory?: string | null): string[] {
  const extra = purposeMessage(purposeCategory);
  return extra ? [...BASE_MESSAGES, extra] : BASE_MESSAGES;
}

const STAGES = [
  { icon: '📊', label: '데이터 수집' },
  { icon: '📝', label: '리포트 작성' },
  { icon: '📄', label: 'PDF 변환' },
] as const;

function LoadingOverlay({ completed, onCancel, purposeCategory }: { completed: boolean; onCancel: () => void; purposeCategory?: string | null }) {
  const messages = useRef(buildMessages(purposeCategory)).current;
  const [msgIdx, setMsgIdx]     = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);
  const [elapsed, setElapsed]   = useState(0);

  // 메시지 초기 랜덤 선택
  useEffect(() => {
    setMsgIdx(Math.floor(Math.random() * messages.length));
  }, [messages.length]);

  // 경과 시간
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 프로그레스 바는 더 이상 JS setInterval로 숫자를 채우지 않는다 — @react-pdf/renderer의
  // pdf().toBlob()이 Yoga 레이아웃을 포함한 긴 동기 작업이라 메인 스레드를 오래 점유하면
  // JS 타이머 자체가 굶어(못 돌아) 진행률이 15% 안팎에서 멈춘 것처럼 보이던 버그(2026-08-16
  // 원인 확정 — 백엔드/PDF 생성 로직은 정상, 프론트 진행률 시뮬레이션만의 문제였음)의
  // 근본 해결책은 "메인 스레드 점유 여부와 무관하게 계속 움직이는 표시"뿐이다 — 아래
  // CSS keyframe 애니메이션(transform 기반, 컴포지터 스레드에서 동작)으로 교체.
  // 어차피 react-pdf가 실제 진행률 콜백을 제공하지 않아 숫자(%) 자체가 항상 허구였으므로,
  // 숫자를 흉내내는 대신 "진행 중임을 계속 보여주는" 무한(indeterminate) 바로 전환한다.

  // 메시지 fade out → 새 메시지 → fade in
  useEffect(() => {
    const id = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % messages.length);
        setMsgVisible(true);
      }, 300);
    }, 3000);
    return () => clearInterval(id);
  }, [messages.length]);

  // 단계: 0-20s → 20-45s → 45s+
  const stageIdx = elapsed < 20 ? 0 : elapsed < 45 ? 1 : 2;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 px-8 py-7 max-w-sm w-full mx-4 flex flex-col items-center gap-5">

        {/* 아이콘 */}
        <div className="w-12 h-12 rounded-full bg-navy-50 flex items-center justify-center">
          <FileText size={24} className="text-navy-600" />
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
          {messages[msgIdx]}
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
                    ? 'bg-navy-50 text-navy-600'
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

        {/* 예상 소요시간 안내 — 2026-08-16 성능 조사로 확정: 한글 PDF(NotoSansKR+
            NotoSerifKR CJK 풀 char셋 폰트 임베딩, ~21페이지)는 구조적으로 1~3분이
            정상 범위(fontkit의 순수 JS 글리프 서브셋 처리 비용, 페이지/텍스트량보다
            폰트 자체의 글리프 테이블 크기가 지배적 — 상세는 CLAUDE.md Architecture
            섹션 참고). 진행률 바만으로는 "이게 정상인지 멈춘 건지" 판단이 안 되므로
            사전 기대치를 명시. */}
        <p className="text-[11px] text-gray-400 text-center -mt-1">
          문서 분량에 따라 보통 1~3분 정도 걸려요
        </p>

        {/* 프로그레스 바 — 완료 전엔 무한(indeterminate) CSS 애니메이션, 완료 시 100% 고정
            (숫자 %는 표시하지 않음 — react-pdf가 실제 진행률을 안 주므로 항상 허구였고,
            메인 스레드가 막혀도 이 애니메이션은 계속 움직여 "멈춘 것처럼 보이는" 문제가
            재발하지 않는다). 경과 초(N초) 표시도 2026-08-17에 제거 — 숫자가 멈추면
            "고장난 것처럼" 보인다는 피드백. elapsed state 자체는 STAGES 하이라이트
            전환(0-20s/20-45s/45s+)에 계속 쓰이므로 그대로 유지, 화면엔 안 그린다. */}
        <div className="w-full space-y-1.5">
          <style>{`
            @keyframes pdf-progress-indeterminate {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(250%); }
            }
          `}</style>
          <div className="flex justify-center items-center text-[11px] text-gray-400">
            <span>PDF 준비 중...</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            {completed ? (
              <div className="h-full w-full bg-navy-500 rounded-full transition-[width] duration-300 ease-out" />
            ) : (
              <div
                className="h-full w-2/5 bg-navy-500 rounded-full"
                style={{ animation: 'pdf-progress-indeterminate 1.1s ease-in-out infinite' }}
              />
            )}
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
      {mounted && loading && (
        <LoadingOverlay completed={completed} onCancel={handleCancel} purposeCategory={data.purposeCategory} />
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        title={error ? 'PDF 생성 오류 — 다시 시도' : 'PDF 파일로 내보내기'}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
          border transition-colors shrink-0 whitespace-nowrap
          ${error
            ? 'border-risk-border text-risk bg-risk-bg hover:bg-risk-bg'
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

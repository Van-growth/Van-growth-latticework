'use client';

import { X, CheckCircle2, AlertTriangle, RefreshCw, Target } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

export type PurposeReformatState =
  | { status: 'skipped' }
  | { status: 'loading' }
  | { status: 'success'; text: string; truncated?: boolean }
  | { status: 'error' };

interface PreAnalysisConfirmModalProps {
  companyName: string;
  hasFilingData: boolean;
  purposeDetail: string; // trimmed 원문 — '' 면 사용자가 상세를 안 넣은 것
  purposeReformat: PurposeReformatState;
  onCancel: () => void;
  onBackToEdit: () => void;
  onProceed: () => void;
}

// "분석하기" 클릭 시 실제 리서치/생성을 시작하기 전에 (1) EDGAR/DART 공시 데이터 존재
// 여부와 (2) 입력한 목적을 AI가 정리한 문장을 한 다이얼로그에서 같이 확인시킨다
// (2026-08-17, FilingCheckModal을 이 컴포넌트로 교체). 공시 판정은 typeahead 선택
// 시점에 받아둔 listings로 즉시(0ms) 나오고, 목적 정리는 POST /api/analyze/
// reformat-purpose 호출 결과를 부모(HomeContent.tsx)가 purposeReformat prop으로
// 넘겨준다 — 이 컴포넌트는 순수 표시 전용, 네트워크 호출을 직접 하지 않는다
// (LoginPromptModal.tsx와 동일한 패턴).
export default function PreAnalysisConfirmModal({
  companyName, hasFilingData, purposeDetail, purposeReformat, onCancel, onBackToEdit, onProceed,
}: PreAnalysisConfirmModalProps) {
  const { language } = useLanguage();
  const t = getUiStrings(language).preAnalysisConfirmModal;

  const hasPurposeDetail = purposeDetail.length > 0;
  // 진행 버튼 색/문구는 "위험 신호가 하나라도 있는가"로 통일 판정 — 공시 없음 OR 목적
  // 미입력 OR 정리 실패, 셋 중 하나라도 해당하면 caution(risk) 톤, 전부 정상이면
  // calm(navy) 톤.
  const caution = !hasFilingData || !hasPurposeDetail || purposeReformat.status === 'error';
  const proceedDisabled = purposeReformat.status === 'loading';

  const backLabel = hasPurposeDetail ? t.backToEdit : t.addDetail;
  const proceedLabel = caution ? t.proceedAnyway : t.proceed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t.closeAria}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>

        {/* ── 공시 데이터 확인 (즉시 렌더) ── */}
        <div className="mb-5">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${hasFilingData ? 'bg-navy-50' : 'bg-risk-bg'}`}>
            {hasFilingData
              ? <CheckCircle2 size={20} className="text-navy-600" />
              : <AlertTriangle size={20} className="text-risk" />}
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1.5 pr-6">
            {hasFilingData ? t.filingFoundTitle : t.filingNotFoundTitle}
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {hasFilingData ? t.filingFoundBody(companyName) : t.filingNotFoundBody(companyName)}
          </p>
        </div>

        {/* ── 목적 정리 확인 ── */}
        <div className="mb-5 pt-5 border-t border-gray-100">
          <div className="flex items-center gap-1.5 mb-2">
            <Target size={15} className="text-navy-600" />
            <p className="text-sm font-semibold text-gray-900">{t.purposeSectionTitle}</p>
          </div>
          {!hasPurposeDetail ? (
            <p className="text-sm text-gray-600 leading-relaxed">{t.purposeEmptyBody}</p>
          ) : purposeReformat.status === 'loading' ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-1">
              <RefreshCw size={14} className="animate-spin" />
              {t.purposeLoadingLabel}
            </div>
          ) : purposeReformat.status === 'success' ? (
            <div>
              <p className="text-xs text-gray-400 mb-1">{t.purposeConfirmedLabel}</p>
              <div className="bg-navy-50 border border-navy-100 rounded-lg px-3.5 py-3">
                <p className="text-sm text-navy-800 leading-relaxed">&ldquo;{purposeReformat.text}&rdquo;</p>
              </div>
              {purposeReformat.truncated && (
                <p className="text-xs text-gray-400 mt-1.5">{t.purposeTruncatedNote}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-risk leading-relaxed">{t.purposeErrorBody}</p>
          )}
        </div>

        {/* 크레딧 시스템은 아직 미구현 — 결제 시스템 도입 시 실제 차감 로직과 연동 예정인
            자리표시자 카피(CLAUDE.md Handoff 참고). */}
        <p className="text-xs text-gray-400 mb-5">{t.creditNote}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBackToEdit}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {backLabel}
          </button>
          <button
            type="button"
            onClick={onProceed}
            disabled={proceedDisabled}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              caution ? 'bg-risk hover:opacity-90' : 'bg-navy-600 hover:bg-navy-700'
            }`}
          >
            {proceedLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

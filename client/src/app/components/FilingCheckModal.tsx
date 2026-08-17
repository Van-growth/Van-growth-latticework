'use client';

import { X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

interface FilingCheckModalProps {
  companyName: string;
  hasFilingData: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// "분석하기" 클릭 시 실제 리서치/생성을 시작하기 전에 EDGAR/DART 공시 데이터 존재
// 여부를 먼저 보여주는 확인 다이얼로그(2026-08-17 신규) — 판정 자체는 이미 typeahead
// 선택 시점에 받아둔 listings(HomeContent.tsx의 selectedCompany.listings)로만
// 하고, 이 컴포넌트는 그 결과에 따라 두 문구/버튼 조합만 보여준다(새 API 호출 없음,
// LoginPromptModal.tsx와 동일한 순수 확인용 모달 패턴).
export default function FilingCheckModal({ companyName, hasFilingData, onCancel, onConfirm }: FilingCheckModalProps) {
  const { language } = useLanguage();
  const t = getUiStrings(language).filingCheckModal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t.closeAria}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>

        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${hasFilingData ? 'bg-navy-50' : 'bg-risk-bg'}`}>
          {hasFilingData
            ? <CheckCircle2 size={20} className="text-navy-600" />
            : <AlertTriangle size={20} className="text-risk" />}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2 pr-6">
          {hasFilingData ? t.foundTitle : t.notFoundTitle}
        </h2>
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          {hasFilingData ? t.foundBody(companyName) : t.notFoundBody(companyName)}
        </p>
        {/* 크레딧 시스템은 아직 미구현 — 결제 시스템 도입 시 실제 차감 로직과 연동 예정인
            자리표시자 카피(CLAUDE.md Handoff 참고). */}
        <p className="text-xs text-gray-400 mb-5">{t.creditNote}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${
              hasFilingData ? 'bg-navy-600 hover:bg-navy-700' : 'bg-risk hover:opacity-90'
            }`}
          >
            {hasFilingData ? t.proceed : t.proceedAnyway}
          </button>
        </div>
      </div>
    </div>
  );
}

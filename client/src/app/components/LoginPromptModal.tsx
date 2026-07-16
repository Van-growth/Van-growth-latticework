'use client';

import { X } from 'lucide-react';
import { GoogleIcon } from './Header';

interface LoginPromptModalProps {
  companyName: string;
  onClose: () => void;
  onContinue: () => void;
}

// typeahead에서 회사를 골랐지만 비로그인 상태일 때 뜨는 모달 — signInWithGoogle()
// 직접 리다이렉트 대신 맥락(어떤 회사를 보려던 건지)을 먼저 보여준다.
// signInWithGoogle 호출 자체는 부모(onContinue)가 맡는다 — 로그인 전에 선택했던
// 회사를 sessionStorage에 저장해뒀다가 로그인 후 자동으로 이어가야 해서다.
export default function LoginPromptModal({ companyName, onClose, onContinue }: LoginPromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-2 pr-6">시작하고 무료로 분석해보세요</h2>
        <p className="text-sm text-gray-500 mb-1">
          {companyName ? `${companyName} 분석을 시작하려면 로그인이 필요해요.` : '기업 분석을 시작하려면 로그인이 필요해요.'}
        </p>
        <p className="text-sm text-gray-500 mb-6">
          로그인하면 무료로 2회 기업 분석을 이용할 수 있어요.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-4 py-2.5 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          구글로 계속하기
        </button>
      </div>
    </div>
  );
}

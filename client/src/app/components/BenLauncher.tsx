'use client';

import { useState, useEffect } from 'react';
import BenPanel, { BenWidthPreset } from './BenPanel';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

// Ben 전역 노출 3차 재설계(2026-08-18) — 상단 네비게이션 상시 버튼 → 오버레이. 컨텍스트는
// AnalysisContext.analysisData(루트 레이아웃에서 한 번만 provide, 라우트 전환에도 언마운트
// 안 됨 — 이미 "가장 최근에 조회한 분석" 저장소 역할을 하고 있었음, 새 store 불필요)를
// 그대로 읽는다. 폭 프리셋은 이 컴포넌트가 직접 소유(예전 HomeContent.tsx에 있던 것과
// 동일 localStorage 키 재사용).
const WIDTH_PRESETS: Record<BenWidthPreset, number> = { default: 420, wide: 640 };
const WIDTH_LS_KEY = 'ben_panel_width';

function loadSavedWidthPreset(): BenWidthPreset {
  if (typeof window === 'undefined') return 'default';
  return window.localStorage.getItem(WIDTH_LS_KEY) === 'wide' ? 'wide' : 'default';
}

export default function BenLauncher() {
  const { analysisData } = useAnalysis();
  const { language } = useLanguage();
  const t = getUiStrings(language).ben;
  const [isOpen, setIsOpen] = useState(false);
  const [widthPreset, setWidthPresetState] = useState<BenWidthPreset>('default');

  useEffect(() => { setWidthPresetState(loadSavedWidthPreset()); }, []);

  function setWidthPreset(preset: BenWidthPreset) {
    setWidthPresetState(preset);
    try { window.localStorage.setItem(WIDTH_LS_KEY, preset); } catch { /* ignore */ }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-label={t.openAria}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm hover:bg-gray-50 transition-colors shrink-0"
      >
        <span aria-hidden="true">🧑‍💼</span>
        {t.panelTitle}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setIsOpen(false)} />
          <div className="relative h-full" style={{ width: WIDTH_PRESETS[widthPreset], maxWidth: '100%' }}>
            <BenPanel analysisData={analysisData} widthPreset={widthPreset} setWidthPreset={setWidthPreset} />
          </div>
        </div>
      )}
    </>
  );
}

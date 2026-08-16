'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, X } from 'lucide-react';
import OnboardingModal from './profile/OnboardingModal';
import BenPanel, { BenWidthPreset } from './BenPanel';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

// Ben 채팅 패널 폭 — 예전 드래그 리사이즈(AI 비서 패널 시절, MIN/MAX/DEFAULT_WIDTH)
// 대신 Harry 스타일 2단 프리셋("기본"/"넓게") 버튼으로 전환. localStorage 키도
// 새 이름(ben_panel_width)으로 — 프리셋 이름을 저장하고, px 값 자체는 저장 안 함
// (2개뿐인 이산 상태라 min/max 검증이 필요한 px 저장보다 단순).
const WIDTH_PRESETS: Record<BenWidthPreset, number> = { default: 420, wide: 640 };
const LS_KEY = 'ben_panel_width';

function loadSavedWidthPreset(): BenWidthPreset {
  if (typeof window === 'undefined') return 'default';
  return window.localStorage.getItem(LS_KEY) === 'wide' ? 'wide' : 'default';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { analysisData } = useAnalysis();
  const { language } = useLanguage();
  const uiT = getUiStrings(language).ben;
  const [showPanel, setShowPanel] = useState(false);
  const [widthPreset, setWidthPresetState] = useState<BenWidthPreset>('default');

  useEffect(() => {
    setWidthPresetState(loadSavedWidthPreset());
  }, []);

  const setWidthPreset = useCallback((preset: BenWidthPreset) => {
    setWidthPresetState(preset);
    try { window.localStorage.setItem(LS_KEY, preset); } catch { /* ignore */ }
  }, []);

  if (pathname?.startsWith('/share/')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-navy-50">
        <OnboardingModal />
        {children}
      </div>
    );
  }

  return (
    <div className="lg:flex lg:items-start min-h-screen bg-gradient-to-br from-slate-50 to-navy-50">
      <OnboardingModal />
      <div className="flex-1 min-w-0">{children}</div>

      {/* Desktop: sticky right rail — 분석이 없어도 항상 렌더, 빈 상태는 BenPanel 내부가 처리 */}
      <div className="hidden lg:flex shrink-0 sticky top-0 h-screen" style={{ width: WIDTH_PRESETS[widthPreset] }}>
        <div className="flex-1 min-w-0 h-full py-3 pr-3 pl-2 overflow-hidden">
          <BenPanel analysisData={analysisData} widthPreset={widthPreset} setWidthPreset={setWidthPreset} />
        </div>
      </div>

      {/* Mobile: floating action button + full-screen slide-over */}
      <button
        className="lg:hidden fixed bottom-6 right-4 z-30 w-12 h-12 bg-navy-600 text-white rounded-full shadow-lg flex items-center justify-center"
        onClick={() => setShowPanel(v => !v)}
        aria-label={uiT.openAria}
      >
        {showPanel ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
      {showPanel && (
        <div className="lg:hidden fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-sm h-full">
            <BenPanel analysisData={analysisData} />
          </div>
        </div>
      )}
    </div>
  );
}

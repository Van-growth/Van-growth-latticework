'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';
import BenPanel, { BenWidthPreset } from './BenPanel';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';
import { useBenChat } from '@/app/hooks/useBenChat';
import { useAdminInsightsChat } from '@/app/hooks/useAdminInsightsChat';
import { AnalysisDetail } from '@/types';

// BenPanel은 순수 프레젠테이션 셸이라 useBenChat(analysis 컨텍스트 전용 데이터 소스)을
// 여기서 대신 호출해 넘겨준다 — 이 컴포넌트는 BenLauncher에서 {isOpen && ...}로만
// 마운트되므로, 대화 이력 복원 GET 요청도 기존과 동일하게 패널을 실제로 열 때만 나간다
// (useBenChat을 BenLauncher 최상단에서 무조건 호출하면 리포트를 열자마자 패널을 안 열어도
// 매번 GET이 나가는 회귀가 생김).
function AnalysisBenPanel({ analysisData, widthPreset, setWidthPreset }: {
  analysisData: AnalysisDetail | null;
  widthPreset: BenWidthPreset;
  setWidthPreset: (preset: BenWidthPreset) => void;
}) {
  const { language: globalLanguage } = useLanguage();
  // 리포트 자체의 저장된 언어를 우선(AnalysisCard.tsx의 reportLanguage와 동일 패턴) — 안 그러면
  // EN 리포트를 보면서도 인사말만 전역 토글(기본 KR)을 따라가는 불일치가 생긴다(2026-08-21,
  // NVIDIA CORP(language=en) 리포트에서 한글 인사말이 뜨는 걸 실측으로 발견).
  const reportLanguage = analysisData?.language === 'ko' || analysisData?.language === 'en'
    ? analysisData.language : globalLanguage;
  const uiT = getUiStrings(reportLanguage).ben;
  const chat = useBenChat(analysisData?.id ?? null);

  return (
    <BenPanel
      chat={chat}
      language={reportLanguage}
      hasContext={!!analysisData}
      contextLabel={analysisData ? uiT.contextLabel(analysisData.companyName) : null}
      greetingText={analysisData ? uiT.greeting(analysisData.companyName) : null}
      resetKey={analysisData?.id ?? null}
      extraAction={null}
      widthPreset={widthPreset}
      setWidthPreset={setWidthPreset}
    />
  );
}

// 관리자 대시보드(/admin) 전용 컨텍스트 — 개별 유저 채팅(2026-08-22 폐기)이 있던 자리를
// 대체한다. Ben 아이콘/패널의 위치·디자인·열고닫는 방식은 AnalysisBenPanel과 완전히
// 동일(같은 BenPanel 셸) — 바뀌는 건 useBenChat 대신 useAdminInsightsChat을 쓰고,
// 리포트 대신 전체 유저 집계를 그라운딩 데이터로 삼는다는 것뿐.
function AdminInsightsBenPanel({ widthPreset, setWidthPreset }: {
  widthPreset: BenWidthPreset;
  setWidthPreset: (preset: BenWidthPreset) => void;
}) {
  const chat = useAdminInsightsChat();

  return (
    <BenPanel
      chat={chat}
      language="ko"
      hasContext
      contextLabel="전체 유저 통계"
      greetingText="유저 데이터에 대해 무엇이 궁금하신가요?"
      resetKey="admin-insights"
      quickQuestions={[
        '요즘 가입자 중 어떤 목적이 많아?',
        '분석 0회인 유저 몇 명이야?',
        '가장 많이 검색된 기업은?',
      ]}
      extraAction={null}
      widthPreset={widthPreset}
      setWidthPreset={setWidthPreset}
    />
  );
}

// Ben 전역 노출 — 상단 네비게이션 상시 버튼 → 우측 세로 슬라이드 패널. 컨텍스트는
// AnalysisContext.analysisData(루트 레이아웃에서 한 번만 provide, 라우트 전환에도 언마운트
// 안 됨 — 이미 "가장 최근에 조회한 분석" 저장소 역할을 하고 있었음, 새 store 불필요)를
// 그대로 읽는다. 폭 프리셋은 이 컴포넌트가 직접 소유(패널이 열렸을 때만 BenPanel 내부
// 헤더에 노출 — 상단 nav 바에는 상시 노출 안 함).
//
// 오버레이/패널을 document.body로 portal 렌더하는 이유(2026-08-18 버그 수정) — Header의
// <nav>가 backdrop-blur-sm(=backdrop-filter)를 쓰는데, backdrop-filter가 걸린 조상은
// position:fixed 자손의 containing block이 되어버려 "뷰포트 기준 전체화면"이 아니라
// "그 nav 엘리먼트 박스 기준"으로 fixed가 계산된다 — 그 결과 오버레이가 뷰포트 전체가
// 아니라 nav 높이만큼의 가로 막대(화면 상단 회색 바)로 찌그러져 보이던 버그의 원인이었다.
// portal로 document.body에 직접 렌더하면 이 containing block 문제를 완전히 피해간다.
const WIDTH_PRESETS: Record<BenWidthPreset, number> = { default: 420, wide: 640 };
const WIDTH_LS_KEY = 'ben_panel_width';
// 신규 유저 인디케이터(2026-08-20) — 패널을 한 번이라도 열면 사라지고 다시 안 뜬다.
const SEEN_LS_KEY = 'ben_panel_seen';

function loadSavedWidthPreset(): BenWidthPreset {
  if (typeof window === 'undefined') return 'default';
  return window.localStorage.getItem(WIDTH_LS_KEY) === 'wide' ? 'wide' : 'default';
}

export default function BenLauncher() {
  // isOpen은 이제 로컬 state가 아니라 AnalysisContext에서 온다 — 리포트 탭 하단 넛지
  // 배너(AnalysisCard.tsx, 이 컴포넌트와 형제 관계)가 같은 상태를 읽고 써서 패널을
  // 열 수 있어야 하기 때문(2026-08-20).
  const { analysisData, benOpen: isOpen, setBenOpen: setIsOpen } = useAnalysis();
  const { language } = useLanguage();
  const t = getUiStrings(language).ben;
  // 관리자 대시보드 경로에 있으면 컨텍스트만 전체 유저 집계로 바뀐다 — 그 외엔 기존
  // analysis 컨텍스트 그대로(2026-08-22, 개별 유저 채팅 대신 경로 기반 컨텍스트 분기로 재설계).
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  const [widthPreset, setWidthPresetState] = useState<BenWidthPreset>('default');
  const [mounted, setMounted] = useState(false);
  // 기본 true로 시작(SSR/hydration 시 깜빡임 방지) — mount 후 실제 localStorage 값으로 교체.
  const [hasSeenBen, setHasSeenBen] = useState(true);

  useEffect(() => {
    setWidthPresetState(loadSavedWidthPreset());
    setHasSeenBen(window.localStorage.getItem(SEEN_LS_KEY) === '1');
    setMounted(true);
  }, []);

  // isOpen이 true가 되는 순간(아이콘 클릭이든 탭 넛지 배너 클릭이든 트리거 경로 무관)
  // "본 적 있음" 처리 — 인디케이터가 즉시 사라지고 새로고침해도 다시 안 뜬다.
  useEffect(() => {
    if (!isOpen) return;
    setHasSeenBen(true);
    try { window.localStorage.setItem(SEEN_LS_KEY, '1'); } catch { /* ignore */ }
  }, [isOpen]);

  function setWidthPreset(preset: BenWidthPreset) {
    setWidthPresetState(preset);
    try { window.localStorage.setItem(WIDTH_LS_KEY, preset); } catch { /* ignore */ }
  }

  const overlay = (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />
      {/* 화면 우측에 붙어 위아래 꽉 차는 세로 슬라이드 패널 — 닫혀있을 때는
          translate-x-full로 뷰포트 밖에 두고, 페이지 레이아웃엔 전혀 영향 없음
          (position:fixed라 문서 흐름을 아예 안 탐). */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-40 shadow-2xl transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        style={{ width: WIDTH_PRESETS[widthPreset], maxWidth: '100%' }}
        role="dialog"
        aria-modal="true"
        aria-label={t.panelTitle}
      >
        {isOpen && (
          isAdminRoute
            ? <AdminInsightsBenPanel widthPreset={widthPreset} setWidthPreset={setWidthPreset} />
            : <AnalysisBenPanel analysisData={analysisData} widthPreset={widthPreset} setWidthPreset={setWidthPreset} />
        )}
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t.openAria}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1.5 shadow-sm hover:bg-gray-50 transition-colors shrink-0"
      >
        <span aria-hidden="true">🧑‍💼</span>
        {t.panelTitle}
        {mounted && !hasSeenBen && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 bg-risk rounded-full ring-2 ring-white"
            aria-hidden="true"
          />
        )}
      </button>

      {mounted && createPortal(overlay, document.body)}
    </>
  );
}

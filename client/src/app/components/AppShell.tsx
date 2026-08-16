'use client';

import { usePathname } from 'next/navigation';
import OnboardingModal from './profile/OnboardingModal';

// Ben 채팅 패널은 여기서 전역으로 렌더하지 않는다(2026-08-18, 버그 수정) — 히스토리/
// 산업별 보기/설정 등 리포트가 없는 화면에도 떠 있던 문제. 기업분석 결과 화면
// (HomeContent.tsx, AnalysisCard가 렌더되는 지점)에서만 좌/우 분할로 렌더한다.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith('/share/')) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-navy-50">
      <OnboardingModal />
      {children}
    </div>
  );
}

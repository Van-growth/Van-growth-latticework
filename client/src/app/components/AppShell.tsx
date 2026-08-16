'use client';

import { usePathname } from 'next/navigation';
import OnboardingModal from './profile/OnboardingModal';

// AI 비서 패널 임시 제거 — 온보딩(직무/목적) 완성 후 맥락 기반으로 재설계 예정
// import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { MessageCircle, X } from 'lucide-react';
// import AiAssistantPanel from './AiAssistantPanel';
// import { useAnalysis } from '@/app/context/AnalysisContext';
//
// const MIN_WIDTH = 280;
// const MAX_WIDTH = 600;
// const DEFAULT_WIDTH = 340;
// const LS_KEY = 'ai_panel_width';

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

// ── 아래 코드는 AI 비서 패널 복원 시 사용 ──────────────────────────────
//
// export default function AppShell({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname();
//   const { analysisData } = useAnalysis();
//   const [showPanel, setShowPanel] = useState(false);
//   const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH);
//   const [isDragging, setIsDragging] = useState(false);
//
//   const dragStartXRef = useRef(0);
//   const dragStartWidthRef = useRef(DEFAULT_WIDTH);
//   const panelWidthRef = useRef(DEFAULT_WIDTH);
//
//   useEffect(() => {
//     const stored = localStorage.getItem(LS_KEY);
//     if (stored) {
//       const w = parseInt(stored, 10);
//       if (!isNaN(w) && w >= MIN_WIDTH && w <= MAX_WIDTH) {
//         setPanelWidth(w);
//         panelWidthRef.current = w;
//         dragStartWidthRef.current = w;
//       }
//     }
//   }, []);
//
//   const startDrag = useCallback((clientX: number) => {
//     dragStartXRef.current = clientX;
//     dragStartWidthRef.current = panelWidthRef.current;
//     setIsDragging(true);
//     document.body.style.userSelect = 'none';
//     document.body.style.cursor = 'col-resize';
//   }, []);
//
//   const onDragMove = useCallback((clientX: number) => {
//     const delta = dragStartXRef.current - clientX;
//     const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidthRef.current + delta));
//     panelWidthRef.current = next;
//     setPanelWidth(next);
//   }, []);
//
//   const endDrag = useCallback(() => {
//     setIsDragging(false);
//     document.body.style.userSelect = '';
//     document.body.style.cursor = '';
//     localStorage.setItem(LS_KEY, String(panelWidthRef.current));
//   }, []);
//
//   useEffect(() => {
//     if (!isDragging) return;
//     function onMouseMove(e: MouseEvent) { onDragMove(e.clientX); }
//     function onMouseUp() { endDrag(); }
//     function onTouchMove(e: TouchEvent) { onDragMove(e.touches[0].clientX); }
//     function onTouchEnd() { endDrag(); }
//     document.addEventListener('mousemove', onMouseMove);
//     document.addEventListener('mouseup', onMouseUp);
//     document.addEventListener('touchmove', onTouchMove);
//     document.addEventListener('touchend', onTouchEnd);
//     return () => {
//       document.removeEventListener('mousemove', onMouseMove);
//       document.removeEventListener('mouseup', onMouseUp);
//       document.removeEventListener('touchmove', onTouchMove);
//       document.removeEventListener('touchend', onTouchEnd);
//     };
//   }, [isDragging, onDragMove, endDrag]);
//
//   const leftContent = useMemo(() => (
//     <div className="flex-1 min-w-0">{children}</div>
//   ), [children]);
//
//   if (pathname?.startsWith('/share/')) return <>{children}</>;
//
//   function handleMouseDown(e: React.MouseEvent) {
//     e.preventDefault();
//     startDrag(e.clientX);
//   }
//   function handleTouchStart(e: React.TouchEvent) {
//     startDrag(e.touches[0].clientX);
//   }
//
//   return (
//     <div className="lg:flex lg:items-start min-h-screen bg-gradient-to-br from-slate-50 to-navy-50">
//       {leftContent}
//       <div className="hidden lg:flex shrink-0 sticky top-0 h-screen" style={{ width: panelWidth }}>
//         <div onMouseDown={handleMouseDown} onTouchStart={handleTouchStart}
//           className="relative w-2 shrink-0 h-full cursor-col-resize group">
//           <div className={`absolute left-0.5 top-0 h-full w-1 rounded-full transition-colors ${
//             isDragging ? 'bg-navy-400' : 'bg-gray-200 group-hover:bg-navy-400'
//           }`} />
//         </div>
//         <div className="flex-1 min-w-0 h-full py-3 pr-3 overflow-hidden">
//           <AiAssistantPanel analysisData={analysisData} />
//         </div>
//       </div>
//       <button className="lg:hidden fixed bottom-6 right-4 z-30 w-12 h-12 bg-navy-600 text-white rounded-full shadow-lg flex items-center justify-center"
//         onClick={() => setShowPanel(v => !v)} aria-label="AI 비서 열기">
//         {showPanel ? <X size={20} /> : <MessageCircle size={20} />}
//       </button>
//       {showPanel && (
//         <div className="lg:hidden fixed inset-0 z-20 flex justify-end">
//           <div className="absolute inset-0 bg-black/20" onClick={() => setShowPanel(false)} />
//           <div className="relative w-full max-w-sm h-full">
//             <AiAssistantPanel analysisData={analysisData} />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

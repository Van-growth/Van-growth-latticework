'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import AiAssistantPanel from './AiAssistantPanel';
import { useAnalysis } from '@/app/context/AnalysisContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { analysisData } = useAnalysis();
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="lg:flex lg:items-start min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Left: page content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Right: desktop sticky panel */}
      <div className="hidden lg:block w-[340px] shrink-0 sticky top-0 h-screen overflow-hidden p-3">
        <AiAssistantPanel analysisData={analysisData} />
      </div>

      {/* Mobile: floating toggle button */}
      <button
        className="lg:hidden fixed bottom-6 right-4 z-30 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center"
        onClick={() => setShowPanel(v => !v)}
        aria-label="AI 비서 열기"
      >
        {showPanel ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {/* Mobile: full-screen overlay */}
      {showPanel && (
        <div className="lg:hidden fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-sm h-full">
            <AiAssistantPanel analysisData={analysisData} />
          </div>
        </div>
      )}
    </div>
  );
}

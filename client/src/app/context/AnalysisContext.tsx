'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AnalysisDetail } from '@/types';

interface AnalysisContextType {
  analysisData: AnalysisDetail | null;
  setAnalysisData: (data: AnalysisDetail | null) => void;
  completedBatches: Set<number>;
  setCompletedBatches: (fn: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
  // Ben 패널 열림 상태(2026-08-20) — BenLauncher(Header)와 리포트 탭 하단 넛지 배너
  // (AnalysisCard)가 형제 컴포넌트라 로컬 state로는 서로 트리거를 못 해 여기로 끌어올림.
  benOpen: boolean;
  setBenOpen: (open: boolean) => void;
}

const AnalysisContext = createContext<AnalysisContextType>({
  analysisData: null,
  setAnalysisData: () => {},
  completedBatches: new Set(),
  setCompletedBatches: () => {},
  benOpen: false,
  setBenOpen: () => {},
});

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisDetail | null>(null);
  const [completedBatches, setCompletedBatches] = useState<Set<number>>(new Set());
  const [benOpen, setBenOpen] = useState(false);
  return (
    <AnalysisContext.Provider value={{ analysisData, setAnalysisData, completedBatches, setCompletedBatches, benOpen, setBenOpen }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}

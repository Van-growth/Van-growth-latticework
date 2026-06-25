'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AnalysisDetail } from '@/types';

interface AnalysisContextType {
  analysisData: AnalysisDetail | null;
  setAnalysisData: (data: AnalysisDetail | null) => void;
  completedBatches: Set<number>;
  setCompletedBatches: (fn: Set<number> | ((prev: Set<number>) => Set<number>)) => void;
}

const AnalysisContext = createContext<AnalysisContextType>({
  analysisData: null,
  setAnalysisData: () => {},
  completedBatches: new Set(),
  setCompletedBatches: () => {},
});

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisDetail | null>(null);
  const [completedBatches, setCompletedBatches] = useState<Set<number>>(new Set());
  return (
    <AnalysisContext.Provider value={{ analysisData, setAnalysisData, completedBatches, setCompletedBatches }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}

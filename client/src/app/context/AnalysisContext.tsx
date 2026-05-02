'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AnalysisDetail } from '@/types';

interface AnalysisContextType {
  analysisData: AnalysisDetail | null;
  setAnalysisData: (data: AnalysisDetail | null) => void;
}

const AnalysisContext = createContext<AnalysisContextType>({
  analysisData: null,
  setAnalysisData: () => {},
});

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analysisData, setAnalysisData] = useState<AnalysisDetail | null>(null);
  return (
    <AnalysisContext.Provider value={{ analysisData, setAnalysisData }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  return useContext(AnalysisContext);
}

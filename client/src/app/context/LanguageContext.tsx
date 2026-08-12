'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Language = 'ko' | 'en';

const STORAGE_KEY = '1min_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// 기본값 EN, 자동감지 없음(VPN/여행 시 오작동 경험 때문에 의도적으로 뺌) — 언어 정책 SSOT.
const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ko' || stored === 'en') setLanguageState(stored);
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

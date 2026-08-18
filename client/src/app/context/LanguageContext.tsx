'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Language = 'ko' | 'en';

const STORAGE_KEY = '1min_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// 2026-08-18: GTM 타겟이 미국 우선→한국 우선으로 전환되며 브라우저 언어 자동감지 재도입
// (2026-08-12 "자동감지 없음" 정책 대체) — 저장된 수동 선택값이 없을 때만 감지값을 기본값으로 쓰고,
// 한 번 수동 변경하면 그 값이 이후 계속 우선한다. 서버 렌더 시점엔 navigator가 없어 SSR 기본값은 EN.
const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'ko' || stored === 'en') {
      setLanguageState(stored);
    } else {
      const detected = window.navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
      setLanguageState(detected);
    }
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

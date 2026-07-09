'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { initAnalytics } from '@/lib/analytics';

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

// Posthog 이벤트 트래킹 초기화 + Microsoft Clarity 스크립트 삽입(세션 리플레이/히트맵,
// 설정은 스크립트 삽입뿐 — Clarity 대시보드 쪽에서 더 손댈 것 없음). 둘 다 키 없으면 no-op.
// layout.tsx에 전역으로 마운트 — 공유 링크 페이지도 트래킹 대상이라 AppShell 밖(제외 없음)에 둠.
export default function Analytics() {
  useEffect(() => {
    initAnalytics();
  }, []);

  if (!CLARITY_ID) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_ID}");`}
    </Script>
  );
}

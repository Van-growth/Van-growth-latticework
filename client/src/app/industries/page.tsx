'use client';

import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import IndustryView from '@/app/components/IndustryView';

// 최상단 내비게이션 1단 구조 재편(2026-08-17)으로 "산업별 보기"가 HomeContent 내부
// 탭(topTab)에서 독립 라우트로 승격됨 — IndustryView 자체는 onSelectCompany 콜백만
// 받는 자기완결 컴포넌트라 그대로 재사용. 클릭한 회사를 "/"(기업분석 홈)로 넘기는 건
// PENDING_SELECTION_KEY(로그인 후 검색 재개용 sessionStorage 브릿지, HomeContent.tsx)와
// 동일한 패턴 — 페이지 이동으로 React state가 끊기므로 sessionStorage로 전달한다.
const PENDING_INDUSTRY_SELECTION_KEY = 'pending_industry_company_selection';

export default function IndustriesPage() {
  const router = useRouter();

  function handleSelectCompany(company: { cik: string; name: string; ticker: string | null }) {
    sessionStorage.setItem(
      PENDING_INDUSTRY_SELECTION_KEY,
      JSON.stringify({
        name: company.name,
        listings: [{ source: 'EDGAR', identifier: company.cik, ticker: company.ticker }],
      }),
    );
    router.push('/');
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <IndustryView onSelectCompany={handleSelectCompany} />
      </div>
    </div>
  );
}

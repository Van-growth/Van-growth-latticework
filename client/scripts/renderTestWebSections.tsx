// TEMP — 웹 UI(AnalysisCard.tsx) 섹션 렌더 순서 검증 전용 스크립트. 브라우저 자동화
// 도구가 이 세션에 없어(claude-in-chrome 확장 미설치) 실제 브라우저 스크롤 테스트를
// 대체할 수 없지만, react-dom/server로 실제 컴포넌트를 실제 데이터로 직접 렌더해
// 최종 DOM 순서를 검증한다(소스 코드 diff보다 한 단계 더 실측에 가까운 검증) —
// AnalysisCardInner의 useAuth/useLanguage/useAnalysis는 Provider 없이도 각 Context의
// createContext(default) 기본값으로 동작하므로 별도 Provider wrapping 불필요.
// 실행: cd client && npx tsx scripts/renderTestWebSections.tsx
// 사전 조건: server dev(4000)가 떠 있어야 함(GET /api/analyses/:id 호출).
// AuthContext.tsx가 모듈 로드 시점에 supabaseClient.ts를 통해 이 값들을 요구한다 —
// tsx는 Next.js와 달리 .env.local을 자동 로드하지 않으므로 직접 주입(client/.env.local과
// 동일한 값, 공개 anon key라 노출 안전 — 서버 경유 없이 클라이언트에서 직접 쓰도록
// 설계된 키). import보다 먼저 실행되도록 파일 최상단에 위치.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://rtpcmbxijcxhzvortwxf.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_JATljVEkBPswOTnGDgY7Uw_Yos_VgKd';

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { AnalysisDetail } from '../src/types';

async function main() {
  const { default: AnalysisCard } = await import('../src/app/components/AnalysisCard');

  const id = 'aa601e3a-3c36-4a8c-8e87-0c0aeff3490e'; // 에이피알
  const res = await fetch(`http://localhost:4000/api/analyses/${id}`);
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const data = (await res.json()) as AnalysisDetail;
  console.log('fetched analysis for', data.companyName, 'growth_scenario_v2 present:', !!data.growth_scenario_v2);

  // isPremium=true로 강제해 growth_scenario 섹션도 렌더 트리에 포함시킨다(순서 검증 목적 —
  // 실제 프리미엄 여부와 무관하게 이 스크립트에서만 강제).
  const html = renderToStaticMarkup(
    createElement(AnalysisCard, { data, isPremium: true, isShareView: false } as any)
  );

  // id="section-XXX" 앵커(ReportSection이 각 섹션에 다는 실제 DOM id)의 등장 순서를 그대로 추출.
  const ids = [...html.matchAll(/id="section-([a-z_]+)"/g)].map(m => m[1]);
  console.log('섹션 DOM 등장 순서:', ids.join(' -> '));

  const sourcesIdx = ids.indexOf('sources');
  const growthIdx = ids.indexOf('growth_scenario');
  const painIdx = ids.indexOf('pain_diagnosis');
  console.log(`pain_diagnosis=${painIdx}, growth_scenario=${growthIdx}, sources=${sourcesIdx}`);
  console.log('sources가 진짜 마지막인가:', sourcesIdx === ids.length - 1 ? 'YES' : 'NO');
  console.log('순서가 pain_diagnosis < growth_scenario < sources 인가:', (painIdx < growthIdx && growthIdx < sourcesIdx) ? 'YES' : 'NO');
}

main().catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});

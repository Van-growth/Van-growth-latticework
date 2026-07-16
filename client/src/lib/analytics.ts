// Posthog 이벤트 트래킹 — 키 없으면(NEXT_PUBLIC_POSTHOG_KEY 미설정) 전부 조용히 no-op이라
// 로컬 개발 중엔 아무 설정 없이도 안전. dev/prod는 반드시 별도 Posthog 프로젝트 키를 써야
// 함(CLAUDE.md 참고) — 안 그러면 dev 테스트 이벤트가 prod 세그먼트 분석에 섞임.
import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined' || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // 비로그인 방문자는 프로필을 만들지 않음 — 무료 티어 MTU(월간 트래킹 유저) 한도 절약.
    // 로그인 유저는 identifyUser() 호출 시점에 자동으로 식별 프로필 생성됨.
    person_profiles: 'identified_only',
    capture_pageview: true,
  });
  initialized = true;
}

export function identifyUser(userId: string, email?: string | null) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, email ? { email } : undefined);
}

export function resetAnalytics() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

// 온보딩 설문 데이터를 Posthog 유저 속성으로 동기화 — 직무/직급/조직규모별 세그먼트 분석용.
export function syncProfileProperties(profile: {
  job_role?: string | null;
  job_level?: string | null;
  org_size?: string | null;
  industry?: string | null;
  company_name?: string | null;
  region?: string | null;
}) {
  if (!POSTHOG_KEY) return;
  const props: Record<string, string> = {};
  if (profile.job_role) props.job_role = profile.job_role;
  if (profile.job_level) props.job_level = profile.job_level;
  if (profile.org_size) props.org_size = profile.org_size;
  if (profile.industry) props.industry = profile.industry;
  if (profile.company_name) props.company_name = profile.company_name;
  if (profile.region) props.region = profile.region;
  if (Object.keys(props).length === 0) return;
  posthog.setPersonProperties(props);
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(name, props);
}

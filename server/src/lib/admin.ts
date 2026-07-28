// 관리자 계정 판별 — ADMIN_USER_IDS 환경변수(콤마 구분 auth.users.id 목록)에 포함된
// 로그인 유저만 true. premium.ts의 PREMIUM_OVERRIDE_CLIENT_IDS와 같은 패턴이지만,
// 프리미엄 플래그(profiles.is_premium_override)와는 별도 축 — 프리미엄이 나중에
// 다른 계정에도 켜지더라도 이 목록에 없으면 관리자 전용 기능은 그대로 막힌다.
const adminIds = new Set(
  (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isAdminUser(authUserId: string | null | undefined): boolean {
  return !!authUserId && adminIds.has(authUserId);
}

// 프리미엄 유저 판별 — Stripe 결제(v3.0.0) 연동 전까지는 항상 false.
// PREMIUM_OVERRIDE_CLIENT_IDS 환경변수(콤마 구분 클라이언트ID)로 내부 테스트/베타테스터만 우회 가능.
const overrideIds = new Set(
  (process.env.PREMIUM_OVERRIDE_CLIENT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export function isPremiumUser(clientId: string | null): boolean {
  if (!clientId) return false;
  return overrideIds.has(clientId);
}

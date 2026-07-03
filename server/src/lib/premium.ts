// 프리미엄 유저 판별 — Stripe 결제(v3.0.0) 연동 전까지는 두 임시 우회 경로로만 true가 됨.
// 1) PREMIUM_OVERRIDE_CLIENT_IDS 환경변수(콤마 구분 클라이언트ID) — 비로그인 내부 테스트용.
// 2) profiles.is_premium_override — 구글 로그인한 유저 개별 플래그(DB에서 수동 설정).
import { supabase } from './supabase';

const overrideIds = new Set(
  (process.env.PREMIUM_OVERRIDE_CLIENT_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

export async function isPremiumUser(params: { clientId: string | null; authUserId?: string | null }): Promise<boolean> {
  const { clientId, authUserId } = params;
  if (clientId && overrideIds.has(clientId)) return true;

  if (authUserId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_premium_override')
      .eq('id', authUserId)
      .maybeSingle();
    if (!error && data?.is_premium_override) return true;
  }

  return false;
}

// 무료 분석 횟수 제한 — 가입일 기준이 아직 없으므로(로그인 미구현) rolling 7일 윈도우로 대체.
// user_id: 클라이언트 임시 식별자(localStorage UUID). 로그인 도입 후 실제 auth user_id로 전환 예정.
import { supabase } from './supabase';

const FREE_LIMIT   = 2;
const WINDOW_DAYS   = 7;
const WINDOW_MS     = WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface UsageCheckResult {
  allowed: boolean;
  usedCount: number;
  nextAvailableAt?: string; // ISO — 가장 오래된 기록 + 7일
}

export async function checkAnalysisUsage(clientId: string | null): Promise<UsageCheckResult> {
  if (!clientId) {
    // 클라이언트 식별자 누락(구버전 캐시, localStorage 차단 등) — fail-open, 차단하지 않음
    console.warn('[analysisUsage] missing clientId — skipping rate limit check (fail-open)');
    return { allowed: true, usedCount: 0 };
  }

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('analysis_usage')
    .select('created_at')
    .eq('user_id', clientId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[analysisUsage] check failed, fail-open:', error.message);
    return { allowed: true, usedCount: 0 };
  }

  const usedCount = data?.length ?? 0;
  if (usedCount < FREE_LIMIT) return { allowed: true, usedCount };

  const oldest = data![0].created_at as string;
  const nextAvailableAt = new Date(new Date(oldest).getTime() + WINDOW_MS).toISOString();
  return { allowed: false, usedCount, nextAvailableAt };
}

export async function recordAnalysisUsage(clientId: string | null, analysisTarget: string): Promise<void> {
  if (!clientId) return;
  const { error } = await supabase
    .from('analysis_usage')
    .insert({ user_id: clientId, analysis_target: analysisTarget });
  if (error) console.warn('[analysisUsage] record failed:', error.message);
}

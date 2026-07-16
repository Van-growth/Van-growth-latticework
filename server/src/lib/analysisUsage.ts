// 무료 분석 횟수 제한 — 가입일 기준이 아직 없으므로 rolling 7일 윈도우로 대체.
// userId: 로그인한 유저의 auth.users.id만 사용 (비로그인 요청은 라우트 진입 단계에서 이미 401로
// 차단되므로 여기 도달하는 시점엔 항상 존재함).
import { supabase } from './supabase';

const FREE_LIMIT   = 2;
const WINDOW_DAYS   = 7;
const WINDOW_MS     = WINDOW_DAYS * 24 * 60 * 60 * 1000;

export interface UsageCheckResult {
  allowed: boolean;
  usedCount: number;
  nextAvailableAt?: string; // ISO — 가장 오래된 기록 + 7일
}

export async function checkAnalysisUsage(userId: string): Promise<UsageCheckResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('analysis_usage')
    .select('created_at')
    .eq('user_id', userId)
    .eq('is_cache_view', false) // 캐시 단순 조회는 무료 횟수에서 제외 — 실제 신규/재분석만 카운트
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

// isCacheView: true면 "조회만 함"(히스토리엔 남기되 checkAnalysisUsage 카운트에서는 제외).
// 기본값 false — 신규 분석/강제 재분석 등 실제 분석 실행 시 그대로 카운트됨.
export async function recordAnalysisUsage(userId: string, analysisTarget: string, isCacheView = false): Promise<void> {
  const { error } = await supabase
    .from('analysis_usage')
    .insert({ user_id: userId, analysis_target: analysisTarget, is_cache_view: isCacheView });
  if (error) console.warn('[analysisUsage] record failed:', error.message);
}

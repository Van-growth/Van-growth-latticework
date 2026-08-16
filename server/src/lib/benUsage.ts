// Ben 채팅 메시지 레이트리밋 — analysis_usage(무료 분석 횟수 제한 + History 페이지 데이터
// 소스를 겸함)와는 완전히 별개 카운터. 채팅 메시지가 거기 섞이면 History 목록 쿼리와
// 충돌하고, 제한 규모(주 2회 vs 일 40회)도 성격이 달라 별도 소형 로그 테이블로 분리했다.
// analysisUsage.ts와 동일한 롤링 윈도우 패턴, DB 에러 시 fail-open.
import { supabase } from './supabase';

const DAILY_LIMIT = 40;
const WINDOW_MS = 24 * 60 * 60 * 1000;

export interface BenUsageCheckResult {
  allowed: boolean;
  usedCount: number;
  nextAvailableAt?: string; // ISO — 가장 오래된 기록 + 24시간
}

export async function checkBenUsage(userId: string): Promise<BenUsageCheckResult> {
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data, error } = await supabase
    .from('ben_message_usage')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[benUsage] check failed, fail-open:', error.message);
    return { allowed: true, usedCount: 0 };
  }

  const usedCount = data?.length ?? 0;
  if (usedCount < DAILY_LIMIT) return { allowed: true, usedCount };

  const oldest = data![0].created_at as string;
  const nextAvailableAt = new Date(new Date(oldest).getTime() + WINDOW_MS).toISOString();
  return { allowed: false, usedCount, nextAvailableAt };
}

export async function recordBenUsage(userId: string, analysisId: string): Promise<void> {
  const { error } = await supabase
    .from('ben_message_usage')
    .insert({ user_id: userId, analysis_id: analysisId });
  if (error) console.warn('[benUsage] record failed:', error.message);
}

export const BEN_DAILY_LIMIT = DAILY_LIMIT;

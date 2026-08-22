// 관리자 계정 판별 — profiles.role='admin' 단일 소스(2026-08-22, 관리자 대시보드 도입과
// 함께 DB 기반으로 전환). 이전엔 ADMIN_USER_IDS 환경변수(콤마 구분 auth.users.id 목록)와
// 클라이언트의 하드코딩 이메일 화이트리스트(AnalysisCard.tsx의 ADMIN_EMAILS) 두 갈래가
// 서로 무관하게 존재했음 — 둘 다 이 role 컬럼으로 대체·폐기됐다(ADMIN_USER_IDS는 실제
// 프로덕션에 값이 설정된 적이 없어 마이그레이션 대상 계정이 없었음).
import { Request } from 'express';
import { supabase } from './supabase';
import { resolveAuthUser, AuthUser } from './authUser';

export async function isAdminUser(authUserId: string | null | undefined): Promise<boolean> {
  if (!authUserId) return false;
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUserId)
    .maybeSingle();
  if (error) {
    console.error('[admin] role 조회 실패', error.message);
    return false;
  }
  return data?.role === 'admin';
}

export type AdminAuthResult = { ok: true; authUser: AuthUser } | { ok: false; status: number; error: string };

// 관리자 전용 라우트 공용 게이트 — 로그인 여부(401)와 관리자 권한(403)을 구분해서 반환한다
// (analyses.ts의 assertShareOwner()와 동일한 관례: 호출부가 status/error를 그대로
// res.status().json()에 실어 보낸다).
export async function resolveAdminUser(req: Request): Promise<AdminAuthResult> {
  const authUser = await resolveAuthUser(req);
  if (!authUser) return { ok: false, status: 401, error: '로그인이 필요합니다.' };
  if (!(await isAdminUser(authUser.id))) return { ok: false, status: 403, error: '관리자 권한이 필요합니다.' };
  return { ok: true, authUser };
}

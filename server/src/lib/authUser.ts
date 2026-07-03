// 구글 로그인(Supabase Auth) 세션 검증 — 클라이언트가 Authorization: Bearer <access_token>으로
// 보낸 JWT를 service_role 클라이언트로 검증해 실제 auth.users.id/email을 얻는다.
// 비로그인 유저는 이 헤더 자체가 없으므로 항상 null → 기존 X-Client-Id 플로우로 폴백.
import { Request } from 'express';
import { supabase } from './supabase';

export interface AuthUser {
  id: string;
  email: string | null;
}

export async function resolveAuthUser(req: Request): Promise<AuthUser | null> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

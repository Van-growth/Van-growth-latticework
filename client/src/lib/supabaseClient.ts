// Auth 전용 브라우저 클라이언트 — 구글 로그인 세션 관리에만 사용.
// 데이터 조회/쓰기는 여전히 서버(Express API) 경유만 허용 (전 테이블 RLS 활성화 + 정책 0개라
// 이 anon 키로는 어차피 어떤 테이블도 못 읽는다). anon/publishable 키는 공개돼도 안전하다 —
// service_role 키만 시크릿, 서버(.env)에만 존재.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

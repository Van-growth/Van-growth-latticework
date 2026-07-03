import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
// service_role — RLS를 우회한다. anon key와 달리 절대 클라이언트에 노출하면 안 됨.
// RLS를 테이블 전체에 켜기 위한 전제조건 (anon key로는 RLS 활성화 시 백엔드 자신의 쿼리도 막힘).
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

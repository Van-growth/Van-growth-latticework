-- 관리자 유저 대시보드 — profiles.role로 admin 판별 단일화(구 ADMIN_USER_IDS env var/
-- 클라이언트 ADMIN_EMAILS 하드코딩은 이번 작업의 Phase 2/3에서 대체·삭제) +
-- allow_private_search(관리자가 개별 유저에게 typeahead 없는 자유입력 회사 검색을
-- 허용하는 토글, PATCH /api/admin/users/:id 대상).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS allow_private_search boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

-- ADMIN_USER_IDS env var는 프로덕션에 실제 설정된 적이 없어(2026-08-22 확인, Render
-- 대시보드 접근 수단 부재로 직접 조회는 못 했으나 로컬 .env/render.yaml 어디에도 값이
-- 없고 사용자가 "설정된 적 없음"으로 확인) 마이그레이션 대상 계정이 없음 — 계정 소유자
-- 본인만 admin으로 승격(사용자 확인 완료).
UPDATE public.profiles SET role = 'admin' WHERE email = 'sg.van.p@gmail.com';

-- 관리자 대시보드 "최근 로그인" 조회용 읽기전용 뷰 — auth.users를 그대로 노출하지 않고
-- id/last_sign_in_at만 select. public 스키마의 default privileges 규칙
-- (20260710_public_schema_grants.sql, ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES
-- TO ..., anon, authenticated, ...)이 신규 오브젝트에 anon/authenticated/service_role
-- 전부에게 GRANT ALL(INSERT/UPDATE/DELETE 포함)을 자동으로 붙이는데, 이 뷰는 단일
-- 테이블 SELECT라 Postgres가 "자동으로 업데이트 가능한 뷰"로 취급해 그 DML이 그대로
-- auth.users에 반영된다 — 뷰 생성 직후 전부 REVOKE하고 service_role에만 SELECT를
-- 다시 부여해야 실제로 "service_role 전용, 읽기 전용"이 된다.
CREATE OR REPLACE VIEW public.admin_user_login_stats AS
SELECT id, last_sign_in_at FROM auth.users;

REVOKE ALL ON public.admin_user_login_stats FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.admin_user_login_stats TO service_role;

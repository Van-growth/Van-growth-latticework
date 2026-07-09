-- 20260710_profile_onboarding.sql이 prod/dev에 이미 적용된 뒤, CHECK 제약조건을 한글 텍스트
-- ('세일즈','BD','전략','기타' 등)에서 언어중립 소문자 코드로 바꾸기로 결정 — 두 프로젝트
-- 모두 실유저 데이터 없는 상태(기능 미배포)라 이 수정으로 안전하게 맞출 수 있음.
-- role_type/seniority 컬럼을 드롭하고 job_role/job_level로 재생성, industry에 CHECK 추가.
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS role_type,
  DROP COLUMN IF EXISTS seniority;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_industry_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_industry_check CHECK (industry IN (
        'saas', 'manufacturing', 'biotech_healthcare', 'retail_commerce', 'finance',
        'media_content', 'hardware_semiconductor', 'energy', 'logistics_transport',
        'consumer_goods', 'real_estate_construction', 'other'
      ));
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_role TEXT CHECK (job_role IN ('sales', 'bd', 'strategy', 'other')),
  ADD COLUMN IF NOT EXISTS job_level TEXT CHECK (job_level IN ('junior', 'mid', 'senior', 'lead'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_purpose_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_purpose_check CHECK (
        purpose IS NULL OR purpose <@ ARRAY['meeting_prep', 'partner_research', 'competitor_analysis', 'other']::text[]
      );
  END IF;
END $$;

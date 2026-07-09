-- 구글 가입 온보딩 설문 — profiles 테이블에 컬럼 추가(별도 테이블 대신 기존 1:1 프로필
-- 테이블 재사용). onboarding_completed_at이 null이면 아직 설문 모달을 안 봤다는 뜻 —
-- 제출이든 스킵이든 모달이 닫히는 시점에 채워짐. 스킵해도 이 컬럼들은 나중에 설정 페이지에서
-- 언제든 다시 채울 수 있음(모두 nullable).
--
-- 선택형 컬럼은 전부 언어중립 소문자 코드로 저장(다국어 UI 대비) — 화면 표시 라벨은
-- client/src/lib/i18n/profileLabels.ts 사전에서 코드→표시문자열로 변환해서 씀.
-- industry는 sector_mapping의 12개 sector_tag 분류를 그대로 재사용(소문자화) — 이 앱이 기업을
-- 분류할 때 이미 쓰는 체계와 유저 자신의 산업을 같은 축으로 맞춰 세그먼트 분석 시 바로 비교 가능.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS org_size TEXT CHECK (org_size IN ('1-10', '11-50', '51-200', '200+')),
  ADD COLUMN IF NOT EXISTS industry TEXT CHECK (industry IN (
    'saas', 'manufacturing', 'biotech_healthcare', 'retail_commerce', 'finance',
    'media_content', 'hardware_semiconductor', 'energy', 'logistics_transport',
    'consumer_goods', 'real_estate_construction', 'other'
  )),
  ADD COLUMN IF NOT EXISTS job_role TEXT CHECK (job_role IN ('sales', 'bd', 'strategy', 'other')),
  ADD COLUMN IF NOT EXISTS job_level TEXT CHECK (job_level IN ('junior', 'mid', 'senior', 'lead')),
  ADD COLUMN IF NOT EXISTS purpose TEXT[],
  ADD COLUMN IF NOT EXISTS purpose_other TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

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

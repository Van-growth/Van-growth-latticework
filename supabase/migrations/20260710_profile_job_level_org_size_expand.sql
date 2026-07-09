-- job_level 4단계 → 5단계(팀 리드/대표·임원 분리), org_size 4단계 → 6단계(200+ 구간 세분화).
-- 두 프로젝트 모두 profiles에 실제로 채워진 org_size/job_level 값이 없는 상태(전부 NULL)라
-- 백필 없이 CHECK 제약만 교체하면 안전함(직접 확인: pg_constraint + 실데이터 조회).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_job_level_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_job_level_check CHECK (
    job_level IN ('junior', 'mid', 'senior', 'team_lead', 'executive')
  );

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_org_size_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_org_size_check CHECK (
    org_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')
  );

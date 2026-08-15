-- concept_miss_log: EDGAR XBRL concept 후보를 전부 시도해도 못 찾은 필드를 기록.
-- "진짜 구조적 부재"인지 "새 concept 후보를 추가해야 하는 케이스"인지는 사람이 나중에
-- 로그를 보고 판단 — resolved_at은 그 판단이 끝난 행을 표시(NULL이면 미검토).
create table if not exists concept_miss_log (
  id uuid primary key default gen_random_uuid(),
  cik text not null,
  company_name text not null,
  field_name text not null,
  candidates_tried text[] not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- 미검토(resolved_at is null) 행을 field_name별로 훑어볼 때 쓰는 부분 인덱스
create index if not exists concept_miss_log_unresolved_idx
  on concept_miss_log (field_name, created_at)
  where resolved_at is null;

alter table concept_miss_log enable row level security;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on concept_miss_log to postgres, anon, authenticated, service_role;

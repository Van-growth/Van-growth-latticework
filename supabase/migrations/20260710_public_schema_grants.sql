-- 표준 Supabase public 스키마 권한 재확인/보증용 — 멱등(이미 있으면 no-op).
--
-- 배경: dev 프로젝트(1min-dev)를 Supabase MCP가 연결 안 된 상태에서 direct pooler 접속으로
-- 만들었을 때, service_role/anon/authenticated에 이 GRANT들이 자동으로 안 붙는 문제가 있었음
-- (Supabase 대시보드/CLI/MCP apply_migration이 내부적으로 붙여주는 걸 direct 접속은 안 해줌).
-- 그때는 이 마이그레이션 워크플로우 밖에서 pooler로 직접 GRANT를 실행해 임시로 고쳤는데,
-- 파일로 기록되지 않아 이력이 없었음 — 이제 정식으로 기록.
--
-- RLS가 전 테이블에 활성화(정책 0개)돼있어서 anon/authenticated에 테이블 권한을 줘도
-- row 단위로는 여전히 완전 차단됨 — prod와 동일한 보안 구조.
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;

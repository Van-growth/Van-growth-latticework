-- share/unshare 라우트의 소유권(403) 체크용 — 기존 111건은 NULL(생성자 미기록, 예외적으로
-- 로그인 유저 전원 허용), 이 마이그레이션 이후 신규 생성되는 analyses 행만 created_by가 채워짐.
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS analyses_created_by_idx ON analyses(created_by);

-- icp_insights에는 소유자(누가 이 ICP 조합으로 생성했는지)를 특정할 컬럼이 없었다 —
-- 캐시 키가 (analysis_id, icp_fingerprint)뿐이라, 한 analysis에 여러 로그인 유저가 각자
-- 자기 ICP로 생성한 행이 여러 개 있을 수 있다. 공유 링크/PDF에 "분석 소유자의 ICP 기준"
-- 결과만 노출하려면(2026-08-15 결정 — ICP 원문은 비공개, discovery_questions만 공개),
-- 어느 행이 analyses.created_by 본인이 생성한 것인지 구분할 방법이 필요해 추가.
ALTER TABLE icp_insights ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 공유 링크/PDF 조회 시 "analysis_id + 이 analysis의 created_by" 조합으로 찾는 게 주 패턴.
CREATE INDEX IF NOT EXISTS idx_icp_insights_owner
  ON icp_insights (analysis_id, created_by);

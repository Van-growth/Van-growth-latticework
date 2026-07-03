-- growth_scenario_v2: 몬테카를로 매출 시뮬레이션 결과 (3차, revenue_history 확보 시에만 생성)
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS growth_scenario_v2 JSONB;

-- analysis_usage: 무료 분석 횟수 제한 (가입일 기준 rolling 7일 2회)
-- user_id: 구글 로그인(v2.1.0) 미구현 상태라 우선 클라이언트 임시 식별자(localStorage UUID) 저장.
--          로그인 도입 후 실제 auth user_id 기준으로 전환 예정.
CREATE TABLE IF NOT EXISTS analysis_usage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  analysis_target TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_usage_user_created_idx ON analysis_usage (user_id, created_at);

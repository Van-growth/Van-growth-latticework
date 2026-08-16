-- "Ben" 채팅 어시스턴트 — 분석당 대화 1개만 저장한다(Harry의 context_type/context_id
-- 멀티컨텍스트 불필요 — Ben의 컨텍스트는 항상 "이 분석 하나"라 icp_insights와 동일한
-- (analysis_id + owner) 캐시 키 형태). ICP Insights 제거로 비게 된 자리를 대체한다.
CREATE TABLE IF NOT EXISTS ben_conversations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, user_id)
);
-- 별도 인덱스 불필요 — 조회는 항상 (analysis_id, user_id) 정확히 일치하는 단건 조회뿐이고
-- 이건 위 UNIQUE 제약의 btree가 이미 커버한다("내 모든 Ben 대화 목록" 같은 엔드포인트 없음).
ALTER TABLE public.ben_conversations ENABLE ROW LEVEL SECURITY;

-- Ben 채팅 전용 레이트리밋 카운터 — analysis_usage(무료 분석 횟수 제한 + History 페이지
-- 데이터 소스를 겸함, server/src/lib/analysisUsage.ts)는 재사용하지 않는다. 채팅 메시지가
-- 거기 섞이면 History 목록 쿼리와 충돌하고, 두 기능의 제한 규모(주 2회 vs 일 40회)도
-- 성격이 달라 별도 소형 로그 테이블로 분리하는 게 안전하다.
CREATE TABLE IF NOT EXISTS ben_message_usage (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id  uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ben_message_usage_user_created_idx ON ben_message_usage (user_id, created_at);
ALTER TABLE public.ben_message_usage ENABLE ROW LEVEL SECURITY;

-- icp_insights: ICP(Ideal Customer Profile) 맞춤형 인사이트 탭 — 이미 생성된 analyses
-- 행의 신호(재무 SEC 벤치마크 편차/트리거 이벤트/기술변화/경쟁사/크로스인더스트리 넛지)를
-- 그대로 재사용해 "사실이 아니라 결과(consequence)"를 합성한다(신규 web_search 없음).
-- 카테고리별 함의 템플릿을 수동으로 미리 만들어두는 대신 프롬프트 지시로 대체하기로 확정
-- (ponytail 원칙 — CLAUDE.md 백로그 "ICP 맞춤형 인사이트 탭" 최신 설계 결정, 2026-08-13).
CREATE TABLE IF NOT EXISTS icp_insights (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id          uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  icp_product          text,
  icp_target_industry  text,
  icp_target_role      text,
  icp_fingerprint      text NOT NULL, -- 위 3개 필드 정규화 후 해시(md5) — 동일 ICP 재요청 시 캐시 히트 판정 키
  content              jsonb NOT NULL, -- 카테고리별 인사이트, 신호 없는 카테고리는 키 자체 생략
  signals_used         jsonb NOT NULL, -- 생성 시점에 실제 참조한 신호 원본 요약(재현성 확인용)
  rating               smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_comment       text,          -- nullable, rating 없어도 단독 저장 가능
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_insights_lookup
  ON icp_insights (analysis_id, icp_fingerprint);

-- 다른 애플리케이션 테이블과 동일 기준 — RLS만 켜고 정책은 0개(anon/authenticated 완전 차단,
-- 백엔드는 service_role 키로 접속해 우회). Security Principles 원칙 2 참고.
ALTER TABLE public.icp_insights ENABLE ROW LEVEL SECURITY;

-- 설정 페이지 ICP 필드 — profiles.region 등과 동일하게 전부 선택사항(NULL 허용)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS icp_product text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS icp_target_industry text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS icp_target_role text;

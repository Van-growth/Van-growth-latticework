-- analysis_favorites: 히스토리 페이지 "★ 즐겨찾기" 섹션(2026-08-17, 최상단 내비게이션
-- 1단 구조 재편의 일부 — 최근조회/즐겨찾기가 히스토리로 통합됨) 전용 유저-분석 관계
-- 테이블. analysis_usage(유저-분석 활동 로그)와 성격이 다른 별도 테이블 —
-- analysis_usage는 "언제 조회/분석했는가"를 기록하는 append-only 로그이고, 이건 유저가
-- 명시적으로 켜고 끄는 토글 상태라 UNIQUE 제약으로 유저당 분석 1건에 최대 1행만 허용한다.
CREATE TABLE IF NOT EXISTS analysis_favorites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id  uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_favorites_user
  ON analysis_favorites (user_id);

-- 다른 애플리케이션 테이블과 동일 기준 — RLS만 켜고 정책은 0개(anon/authenticated 완전 차단,
-- 백엔드는 service_role 키로 접속해 우회). Security Principles 원칙 2 참고.
ALTER TABLE public.analysis_favorites ENABLE ROW LEVEL SECURITY;

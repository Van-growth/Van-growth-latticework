-- analysis_sources: 탭별 출처를 누적 저장하는 테이블
-- 같은 회사를 재분석해도 덮어쓰지 않고 analysis_id별로 버전 누적
CREATE TABLE IF NOT EXISTS analysis_sources (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id   uuid NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  company_name  text NOT NULL,
  tab_name      text NOT NULL CHECK (tab_name IN ('summary','industry_history','tech_evolution','value_chain','business_model','competitors','strategy','financials')),
  source_index  integer NOT NULL,
  level         text NOT NULL CHECK (level IN ('L1','L2','L3')),
  organization  text NOT NULL,
  date          text NOT NULL,
  content       text NOT NULL,
  is_estimate   boolean NOT NULL DEFAULT false,
  url           text,
  created_at    timestamptz DEFAULT now()
);

-- 빠른 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_analysis_sources_analysis_id ON analysis_sources(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sources_company_name ON analysis_sources(company_name);
CREATE INDEX IF NOT EXISTS idx_analysis_sources_level        ON analysis_sources(level);
CREATE INDEX IF NOT EXISTS idx_analysis_sources_tab_name     ON analysis_sources(tab_name);
CREATE INDEX IF NOT EXISTS idx_analysis_sources_is_estimate  ON analysis_sources(is_estimate);

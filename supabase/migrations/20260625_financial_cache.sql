-- financials_v2_cache: 분석된 재무 데이터 3개월 캐시
-- (financial_cache 테이블은 이미 DART/EDGAR raw context 캐시로 사용 중)
CREATE TABLE IF NOT EXISTS financials_v2_cache (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text        NOT NULL UNIQUE,
  financials_v2 jsonb      NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  updated_at   timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS financials_v2_cache_company_idx    ON financials_v2_cache (company_name);
CREATE INDEX IF NOT EXISTS financials_v2_cache_updated_at_idx ON financials_v2_cache (updated_at);

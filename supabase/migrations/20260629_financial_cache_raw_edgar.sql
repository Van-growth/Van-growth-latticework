-- financial_cache에 raw_edgar JSONB 컬럼 추가
-- edgarBatchPrecompute.ts가 구조화된 EDGAR 데이터를 저장하는 데 사용
ALTER TABLE financial_cache
  ADD COLUMN IF NOT EXISTS raw_edgar JSONB;

CREATE INDEX IF NOT EXISTS financial_cache_raw_edgar_idx
  ON financial_cache USING GIN (raw_edgar)
  WHERE raw_edgar IS NOT NULL;

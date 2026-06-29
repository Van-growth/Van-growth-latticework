-- financial_cache에 raw_dart JSONB 컬럼 추가
ALTER TABLE financial_cache
  ADD COLUMN IF NOT EXISTS raw_dart JSONB;

-- corp_master에 market 컬럼 추가 (Y=코스피, K=코스닥, N=코넥스, null=미분류)
ALTER TABLE corp_master
  ADD COLUMN IF NOT EXISTS market TEXT;

CREATE INDEX IF NOT EXISTS corp_master_market_idx
  ON corp_master (market)
  WHERE market IS NOT NULL;

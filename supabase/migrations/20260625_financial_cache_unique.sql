-- financial_cache.company_name unique 제약 추가
-- sync-edgar-sp500.mjs upsert 및 financial_cache 선체크를 위해 필요

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'financial_cache_company_name_unique'
  ) THEN
    ALTER TABLE financial_cache
      ADD CONSTRAINT financial_cache_company_name_unique UNIQUE (company_name);
  END IF;
END $$;

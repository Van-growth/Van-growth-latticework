-- financial_cache: stores DART/EDGAR financial context per company (3-month TTL)
CREATE TABLE IF NOT EXISTS financial_cache (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT        NOT NULL,
  source       TEXT        NOT NULL,
  context_text TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '3 months')
);
CREATE UNIQUE INDEX IF NOT EXISTS financial_cache_company_name_idx
  ON financial_cache (lower(company_name));

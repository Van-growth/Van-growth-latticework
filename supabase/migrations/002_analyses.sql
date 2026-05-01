-- 002_analyses.sql
-- Drop old scaffold table (from 001_initial.sql) and recreate with full schema
DROP TABLE IF EXISTS analyses CASCADE;

CREATE TABLE analyses (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  summary              TEXT        NOT NULL DEFAULT '',
  industry_history     TEXT        NOT NULL DEFAULT '',
  tech_evolution       TEXT        NOT NULL DEFAULT '',
  value_chain_overview TEXT        NOT NULL DEFAULT '',
  business_model       TEXT        NOT NULL DEFAULT '',
  financials           TEXT        NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX analyses_company_id_idx  ON analyses(company_id);
CREATE INDEX analyses_created_at_idx  ON analyses(created_at DESC);

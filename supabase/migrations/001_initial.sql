-- 001_initial.sql
-- Companies and analyses tables for Latticework

CREATE TABLE IF NOT EXISTS companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analyses_company_id_idx ON analyses(company_id);
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON analyses(created_at DESC);

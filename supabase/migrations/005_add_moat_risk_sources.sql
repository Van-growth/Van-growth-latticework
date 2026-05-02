-- 005_add_moat_risk_sources.sql
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS moat_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sources       JSONB NOT NULL DEFAULT '{}'::jsonb;

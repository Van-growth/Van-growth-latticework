ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS cross_industry_nudge_v1 JSONB;

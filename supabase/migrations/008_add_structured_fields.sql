ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS metrics               JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS strengths             JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risks                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS financials_structured JSONB NOT NULL DEFAULT '{}'::jsonb;

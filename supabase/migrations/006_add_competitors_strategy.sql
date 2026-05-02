-- Add competitors and strategy JSONB columns to analyses
ALTER TABLE analyses
  ADD COLUMN competitors JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN strategy    JSONB NOT NULL DEFAULT '{}'::jsonb;

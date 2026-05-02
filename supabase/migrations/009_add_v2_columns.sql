ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS summary_v2          JSONB,
  ADD COLUMN IF NOT EXISTS industry_history_v2 JSONB,
  ADD COLUMN IF NOT EXISTS tech_evolution_v2   JSONB,
  ADD COLUMN IF NOT EXISTS value_chain_v2      JSONB,
  ADD COLUMN IF NOT EXISTS business_model_v2   JSONB,
  ADD COLUMN IF NOT EXISTS competitors_v2      JSONB,
  ADD COLUMN IF NOT EXISTS strategy_v2         JSONB,
  ADD COLUMN IF NOT EXISTS financials_v2       JSONB;

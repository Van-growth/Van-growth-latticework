-- 003_value_chain_players.sql
CREATE TABLE IF NOT EXISTS value_chain_players (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL,
  player_name TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vcp_analysis_id_idx ON value_chain_players(analysis_id);

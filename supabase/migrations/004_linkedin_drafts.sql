-- 004_linkedin_drafts.sql
CREATE TABLE IF NOT EXISTS linkedin_drafts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID        NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  draft_number SMALLINT    NOT NULL CHECK (draft_number BETWEEN 1 AND 3),
  content      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (analysis_id, draft_number)
);

CREATE INDEX ld_analysis_id_idx ON linkedin_drafts(analysis_id);

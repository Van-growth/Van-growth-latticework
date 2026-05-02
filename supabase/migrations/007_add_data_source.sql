-- Track which API was used to enrich the analysis (dart / edgar / web_search)
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'web_search';

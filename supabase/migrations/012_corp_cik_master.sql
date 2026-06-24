-- DART 전체 기업목록 캐시
CREATE TABLE IF NOT EXISTS corp_master (
  corp_code   TEXT PRIMARY KEY,
  corp_name   TEXT NOT NULL,
  stock_code  TEXT,
  modify_date TEXT,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS corp_master_name_lower_idx ON corp_master (lower(corp_name));
CREATE INDEX IF NOT EXISTS corp_master_stock_idx      ON corp_master (stock_code) WHERE stock_code IS NOT NULL;

-- SEC EDGAR 전체 기업/CIK 캐시
CREATE TABLE IF NOT EXISTS cik_master (
  cik       TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  ticker    TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cik_master_name_lower_idx   ON cik_master (lower(name));
CREATE INDEX IF NOT EXISTS cik_master_ticker_lower_idx ON cik_master (lower(ticker)) WHERE ticker IS NOT NULL;

-- 분석 요청 시 입력받는 목적(purpose) — 매 요청 단위 입력값, financial_cache와 무관한
-- 해석 레이어 컨텍스트로만 쓰인다. 과거 행은 값이 없는 게 정상이라 nullable.
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS purpose_category TEXT;
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS purpose_detail   TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analyses_purpose_category_check'
  ) THEN
    ALTER TABLE analyses ADD CONSTRAINT analyses_purpose_category_check
      CHECK (purpose_category IS NULL OR purpose_category IN
        ('ma', 'investment', 'partnership', 'customer', 'other'));
  END IF;
END $$;

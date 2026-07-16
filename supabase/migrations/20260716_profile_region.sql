-- 온보딩 설문에 "지역" 질문 추가 (한국/미국/기타) — 기존 6문항 폼에 이어붙이는 7번째 필드.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS region text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_region_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_region_check CHECK (region IS NULL OR region IN ('kr', 'us', 'other'));
  END IF;
END $$;

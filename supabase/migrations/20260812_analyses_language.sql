-- 언어 정책 재도입 (v2.2.0 영어 단일화 번복) — analyses에 language 컬럼 추가해 KR/EN 캐시 분리.
-- 기본값 'en': 2026-08 영문 단일화 이후 생성된 기존 레코드는 실제로도 전부 영어라 대체로 정확함.
-- 그 이전 극소수 한국어 레거시 레코드만 라벨 불일치 가능 — 백필 없이 자연 캐시 교체에 맡김
-- (2026-08 영문 단일화 때 과거 한국어 캐시를 변환하지 않았던 선례와 동일).
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analyses_language_check'
  ) THEN
    ALTER TABLE analyses
      ADD CONSTRAINT analyses_language_check CHECK (language IN ('ko', 'en'));
  END IF;
END $$;

-- 캐시 조회(company_id + language, 최신순)가 항상 함께 쓰이므로 복합 인덱스로 커버
CREATE INDEX IF NOT EXISTS analyses_company_id_language_created_at_idx
  ON analyses (company_id, language, created_at DESC);

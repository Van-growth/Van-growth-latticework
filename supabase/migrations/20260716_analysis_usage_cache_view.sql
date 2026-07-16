-- analysis_usage에 캐시 조회(조회만 하고 새로 분석하지 않은 경우) 구분 컬럼 추가.
-- analysis_usage는 "7일 2회 무료 제한 카운터"와 "내 히스토리 목록 소스" 두 역할을
-- 겸하고 있어서(GET /api/analyses가 이 테이블을 읽음), 캐시 조회도 히스토리엔
-- 남기되 무료 횟수(checkAnalysisUsage)에서는 제외해야 함 —
-- "단순 재조회는 카운트 제외" 원칙(CLAUDE.md) 유지.
ALTER TABLE analysis_usage
  ADD COLUMN IF NOT EXISTS is_cache_view boolean NOT NULL DEFAULT false;

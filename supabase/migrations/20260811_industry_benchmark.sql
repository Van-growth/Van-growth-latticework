-- industry_benchmark: SEC Financial Statement Data Sets(DERA 벌크 데이터, 분기별
-- sub.txt/num.txt 전수 파싱) 기반 SIC 코드별 산업 벤치마크. 기존 industry_benchmark_cache와는
-- 별개 테이블 — industry_benchmark_cache는 이 앱에서 실제로 검색된 EDGAR 기업(financial_cache)만
-- 대상으로 하는 라이브 캐시라 표본이 좁고, 이 테이블은 SEC 전체 제출 기업을 대상으로 하는
-- 훨씬 큰 표본의 정적 스냅샷이다(server/scripts/secBenchmarkPrecompute.ts로 생성, 4개 분기
-- 합산 + 회사(CIK) 단위 중복 제거). 지표별로 표본 수가 다를 수 있어 평균/표본수를 지표별로
-- 독립 저장 — 한 지표의 표본 부족(<5)이 다른 지표까지 폐기하지 않도록 함(Quality Gate 원칙).
CREATE TABLE IF NOT EXISTS industry_benchmark (
  sic_code               TEXT PRIMARY KEY,
  debt_equity_ratio_avg  DOUBLE PRECISION,
  debt_equity_ratio_n    INTEGER,
  cfo_revenue_ratio_avg  DOUBLE PRECISION,
  cfo_revenue_ratio_n    INTEGER,
  source_quarters        TEXT[],
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.industry_benchmark ENABLE ROW LEVEL SECURITY;

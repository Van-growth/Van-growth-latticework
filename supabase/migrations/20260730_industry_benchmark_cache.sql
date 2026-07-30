-- industry_benchmark_cache: SIC 코드별 EDGAR 업종 평균 재무비율 하루 1회 캐시.
-- 재무 탭의 "업종 평균 대비" 한 줄 해석(industryBenchmarkService)에 사용.
-- 지표별로 표본 수가 다를 수 있어 평균/표본수를 지표별로 독립 저장 —
-- 한 지표의 표본 부족(<5)이 다른 지표까지 폐기하지 않도록 함(Quality Gate 원칙).
CREATE TABLE IF NOT EXISTS industry_benchmark_cache (
  sic_code             TEXT PRIMARY KEY,
  equity_ratio_avg     DOUBLE PRECISION,
  equity_ratio_n       INTEGER,
  debt_ratio_avg       DOUBLE PRECISION,
  debt_ratio_n         INTEGER,
  operating_margin_avg DOUBLE PRECISION,
  operating_margin_n   INTEGER,
  revenue_growth_avg   DOUBLE PRECISION,
  revenue_growth_n     INTEGER,
  computed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.industry_benchmark_cache ENABLE ROW LEVEL SECURITY;

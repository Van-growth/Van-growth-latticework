-- sector_benchmark_cache: 섹터별 매출 성장률 벤치마크(mean/stdDev) 하루 1회 캐시.
-- 미상장/데이터 부족 기업의 몬테카를로 시뮬레이션 폴백(confidenceLevel='low')에 사용.
CREATE TABLE IF NOT EXISTS sector_benchmark_cache (
  sector_tag  TEXT PRIMARY KEY,
  mean        DOUBLE PRECISION NOT NULL,
  std_dev     DOUBLE PRECISION NOT NULL,
  sample_size INTEGER NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sector_benchmark_cache ENABLE ROW LEVEL SECURITY;

-- industry_benchmark 확장 — 영업이익률/자산회전율/매출성장률 3개 지표 추가.
-- asset_turnover_avg는 다른 지표와 달리 %(x100)가 아니라 배수(예: 1.2 = 1.2x) — 자산회전율은
-- 관례상 배수로 표현. revenue_growth_avg/n은 이번 실행에서 feasibility가 낮으면(비교연도
-- 데이터 있는 표본이 너무 적으면) null로 남을 수 있음(server/scripts/secBenchmarkPrecompute.ts
-- 주석 참고) — 컬럼 자체는 미리 만들어두고 향후 재계산 시 채워질 수 있게 한다.
ALTER TABLE industry_benchmark
  ADD COLUMN IF NOT EXISTS operating_margin_avg DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS operating_margin_n   INTEGER,
  ADD COLUMN IF NOT EXISTS asset_turnover_avg   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS asset_turnover_n     INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_growth_avg   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS revenue_growth_n     INTEGER;

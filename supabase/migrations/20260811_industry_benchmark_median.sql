-- industry_benchmark: 평균(_avg) 대신 중앙값(_median)을 저장하도록 컬럼명 변경.
-- 이유: 표본이 작은 SIC는 상하위 1% 윈저라이징이 사실상 무의미하고, 매출이 작은
-- 소형/적자 기업 하나가 평균 전체를 극단치로 끌고 가는 사례(예: SIC 6411 보험중개업
-- 부채/자본 비율이 자본이 작은 회사 1곳 때문에 평균 10,749%로 왜곡)가 반복 확인됨.
-- 이 테이블은 이번 세션에서 신설됐고 아직 소비 코드가 없어(server/src 전수 grep 확인)
-- 하위호환 없이 그대로 리네임한다. RENAME COLUMN은 IF EXISTS를 지원하지 않아
-- information_schema로 존재 여부를 확인해 멱등성을 보장한다.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_benchmark' AND column_name = 'debt_equity_ratio_avg') THEN
    ALTER TABLE industry_benchmark RENAME COLUMN debt_equity_ratio_avg TO debt_equity_ratio_median;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_benchmark' AND column_name = 'cfo_revenue_ratio_avg') THEN
    ALTER TABLE industry_benchmark RENAME COLUMN cfo_revenue_ratio_avg TO cfo_revenue_ratio_median;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_benchmark' AND column_name = 'operating_margin_avg') THEN
    ALTER TABLE industry_benchmark RENAME COLUMN operating_margin_avg TO operating_margin_median;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_benchmark' AND column_name = 'asset_turnover_avg') THEN
    ALTER TABLE industry_benchmark RENAME COLUMN asset_turnover_avg TO asset_turnover_median;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'industry_benchmark' AND column_name = 'revenue_growth_avg') THEN
    ALTER TABLE industry_benchmark RENAME COLUMN revenue_growth_avg TO revenue_growth_median;
  END IF;
END $$;

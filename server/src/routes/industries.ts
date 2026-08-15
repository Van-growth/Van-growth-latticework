import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// EDGAR 전용(DART 미참조) — cik_master.sic_code/sic_description(20260703_sector_mapping.sql로
// 이미 채워짐)과 edgarBatchPrecompute.ts(Russell 1000 전체, render.yaml의 edgar-batch-monthly
// cron)가 채운 financial_cache.raw_edgar를 그대로 읽는다. 신규 매핑 테이블/배치 스크립트 없음.
const COVERAGE_NOTE = '일부 기업은 아직 분석 데이터가 준비되지 않았습니다.';

type FinancialCacheRow = { company_name: string; raw_edgar: any };

// financial_cache는 company_name에 티커를 저장한다(edgarBatchPrecompute.ts) — 기본
// Supabase 페이지 크기(1000)를 넘을 수 있어 넉넉히 잡는다.
async function fetchEdgarFinancialCache(tickers?: string[]): Promise<FinancialCacheRow[]> {
  let q = supabase
    .from('financial_cache')
    .select('company_name, raw_edgar')
    .eq('source', 'EDGAR')
    .gt('expires_at', new Date().toISOString())
    .limit(2000);
  if (tickers?.length) q = q.in('company_name', tickers);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).filter(r => r.raw_edgar);
}

// raw_edgar.revenue는 fiscalYears와 정렬된 배열 — 가장 최신(마지막)의 비-null 값을 채택.
function latestRevenue(rawEdgar: any): { value: number; fiscalYear: string | null } | null {
  const revenue: (number | null)[] = rawEdgar?.revenue ?? [];
  const fiscalYears: string[] = rawEdgar?.fiscalYears ?? [];
  for (let i = revenue.length - 1; i >= 0; i--) {
    if (revenue[i] != null) return { value: revenue[i] as number, fiscalYear: fiscalYears[i] ?? null };
  }
  return null;
}

// GET /api/industries — financial_cache(EDGAR)에 데이터가 있는 티커들을 cik_master의
// sic_code/sic_description으로 그룹핑해 산업 목록 + 커버리지 카운트를 반환.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cacheRows = await fetchEdgarFinancialCache();
    const tickers = [...new Set(cacheRows.map(r => r.company_name))];
    if (tickers.length === 0) {
      res.json({ industries: [], coverageNote: COVERAGE_NOTE });
      return;
    }

    const { data: cikRows, error } = await supabase
      .from('cik_master')
      .select('ticker, sic_code, sic_description')
      .in('ticker', tickers)
      .not('sic_code', 'is', null);
    if (error) throw error;

    const grouped = new Map<string, { sicCode: string; sicDescription: string; companyCount: number }>();
    for (const row of cikRows ?? []) {
      if (!row.sic_code) continue;
      const key = row.sic_code;
      const entry = grouped.get(key);
      if (entry) entry.companyCount++;
      else grouped.set(key, { sicCode: row.sic_code, sicDescription: row.sic_description ?? row.sic_code, companyCount: 1 });
    }

    const industries = [...grouped.values()].sort((a, b) => b.companyCount - a.companyCount);
    res.json({ industries, coverageNote: COVERAGE_NOTE });
  } catch (err) {
    console.error('[GET /api/industries]', err);
    res.status(500).json({ error: '산업 목록을 불러오지 못했습니다.' });
  }
});

// GET /api/industries/:sicCode/companies?limit=10 — 해당 SIC의 회사들을 financial_cache의
// 최신 공시 매출 기준 내림차순 정렬. limit은 서버가 1~100 전부 지원(구현 비용 없음) — 이번
// 스코프에서 프론트는 10만 노출하고 나머지는 "준비 중"으로 막아둔다(요청사항).
router.get('/:sicCode/companies', async (req: Request, res: Response) => {
  const sicCode = String(req.params.sicCode ?? '').trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  if (!sicCode) {
    res.status(400).json({ error: 'sicCode가 필요합니다.' });
    return;
  }

  try {
    const { data: cikRows, error } = await supabase
      .from('cik_master')
      .select('cik, name, ticker, sic_description')
      .eq('sic_code', sicCode)
      .not('ticker', 'is', null);
    if (error) throw error;
    if (!cikRows?.length) {
      res.json({ sicCode, sicDescription: null, companies: [], coverageNote: COVERAGE_NOTE });
      return;
    }

    const tickers = cikRows.map(r => r.ticker).filter(Boolean) as string[];
    const cacheRows = await fetchEdgarFinancialCache(tickers);
    const cacheByTicker = new Map(cacheRows.map(r => [r.company_name, r.raw_edgar]));

    const companies = cikRows
      .map(r => {
        const rawEdgar = r.ticker ? cacheByTicker.get(r.ticker) : undefined;
        if (!rawEdgar) return null;
        const rev = latestRevenue(rawEdgar);
        if (!rev) return null;
        return {
          cik: r.cik, name: r.name, ticker: r.ticker,
          revenue: rev.value, fiscalYear: rev.fiscalYear,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    res.json({
      sicCode,
      sicDescription: cikRows[0]?.sic_description ?? null,
      companies,
      coverageNote: COVERAGE_NOTE,
    });
  } catch (err) {
    console.error('[GET /api/industries/:sicCode/companies]', err);
    res.status(500).json({ error: '산업별 기업 목록을 불러오지 못했습니다.' });
  }
});

export default router;

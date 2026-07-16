import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import {
  analyzeCompany, AnalysisData, AnalysisSources, FinancialsV2, reanalyzeSingleSection,
  generateGrowthScenarioNarrative,
} from '../lib/claude';
import { fetchFinancialContext, CompanyListingRef } from '../lib/financialContext';
import {
  extractRevenueTimeSeries, calculateGrowthStats, runRevenueSimulation, getSectorBenchmarkStats,
} from '../services/monteCarloService';
import { isPremiumUser } from '../lib/premium';
import { checkAnalysisUsage, recordAnalysisUsage } from '../lib/analysisUsage';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

// company_id로 상장 정보 조회 — 다중상장 회사(EDGAR+DART 둘 다 있음)면
// fetchFinancialContext가 이름 휴리스틱 대신 이 identifier로 직접 조회한다.
async function fetchCompanyListings(companyId: string | undefined): Promise<CompanyListingRef[] | undefined> {
  if (!companyId) return undefined;
  const { data } = await supabase
    .from('company_listings')
    .select('source, identifier, ticker')
    .eq('company_id', companyId);
  return data?.length ? (data as CompanyListingRef[]) : undefined;
}

// ── 3차: 몬테카를로 성장 시나리오 (revenue_history 확보 시에만) ─────────────────

// 1순위: 상장사(EDGAR/DART) 자체 매출 시계열 — 신뢰도 high
function computeOwnGrowthScenario(rawEdgar: any, rawDart: any): Record<string, any> | null {
  const source: 'EDGAR' | 'DART' | null = rawDart ? 'DART' : rawEdgar ? 'EDGAR' : null;
  if (!source) return null;

  const series = extractRevenueTimeSeries(rawDart ?? rawEdgar, source);
  if (!series) return null;
  const stats = calculateGrowthStats(series);
  if (!stats) return null;

  const baseRevenue = series[series.length - 1].revenue;
  const simulation  = runRevenueSimulation({ baseRevenue, mean: stats.mean, stdDev: stats.stdDev });

  return { series, stats, simulation, currency: source === 'DART' ? 'KRW' : 'USD', source, confidenceLevel: 'high' as const };
}

// 2순위: 상장 정보/자체 시계열이 없는 기업 — sectorTag + baseRevenue(둘 다 필요) 기반
// 섹터 벤치마크 성장률로 시뮬레이션. 신뢰도 low. UI에서 업종 선택을 아직 안 붙였으므로
// 현재는 요청 body의 sectorTag/baseRevenue 파라미터로만 트리거된다.
async function computeSectorBenchmarkScenario(
  sectorTag: string | undefined,
  manualBaseRevenue: number | undefined,
): Promise<Record<string, any> | null> {
  if (!sectorTag || !manualBaseRevenue || manualBaseRevenue <= 0) return null;

  const benchmark = await getSectorBenchmarkStats(sectorTag);
  if (!benchmark) return null;

  const simulation = runRevenueSimulation({ baseRevenue: manualBaseRevenue, mean: benchmark.mean, stdDev: benchmark.stdDev });

  return {
    series: null,
    stats: benchmark,
    simulation,
    currency: 'USD',
    source: 'SECTOR_BENCHMARK' as const,
    sectorTag,
    confidenceLevel: 'low' as const,
  };
}

// 라우트 분기: 자체 시계열 우선, 없으면 섹터 벤치마크로 폴백. 둘 다 없으면 null(탭 데이터 없음).
// 시뮬레이션 결과가 나오면 Claude로 한줄 해석(narrative)을 붙인다 — 실패해도 시뮬레이션 자체는 반환.
async function computeGrowthScenario(
  companyName: string,
  rawEdgar: any,
  rawDart: any,
  sectorTag?: string,
  manualBaseRevenue?: number,
): Promise<Record<string, any> | null> {
  const own = computeOwnGrowthScenario(rawEdgar, rawDart);
  const scenario = own ?? await computeSectorBenchmarkScenario(sectorTag, manualBaseRevenue);
  if (!scenario) return null;

  const narrative = await generateGrowthScenarioNarrative(companyName, scenario as any);
  return { ...scenario, narrative };
}

// ── financial_cache → FinancialsV2 변환 (배치 프리컴퓨트 raw 데이터 → 표시용 구조체) ──

function buildFinancialsV2FromRaw(rawEdgar: any, rawDart: any, source: 'EDGAR' | 'DART'): FinancialsV2 | null {
  const fmtUsd = (v: number | null): string => {
    if (v == null) return '—';
    const sign = v < 0 ? '-' : '';
    const abs  = Math.abs(v);
    return abs >= 1_000_000_000
      ? `${sign}${(abs / 1_000_000_000).toFixed(1)}B USD`
      : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
  };
  const fmtKrw = (v: number | null): string => {
    if (v == null) return '—';
    const sign = v < 0 ? '-' : '';
    const abs  = Math.abs(v);
    if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
    if (abs >= 100_000_000)       return `${sign}${(abs / 100_000_000).toFixed(0)}억원`;
    return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  };

  const series = rawEdgar ?? rawDart?.cfs ?? rawDart?.ofs;
  if (!series) return null;
  const fmt: (v: number | null) => string = rawEdgar ? fmtUsd : fmtKrw;
  const fyrs: string[] = (series.fiscalYears ?? []).filter(
    (y: string) => ['2021','2022','2023','2024','2025'].includes(y),
  );
  if (fyrs.length === 0) return null;

  const IS_COLS = ['2021','2022','2023','2024','2025'];
  const BS_COLS = ['2023','2024','2025'];

  const toIsRow = (label: string, vals: (number | null)[] = []) => {
    const row: any = { item: label };
    IS_COLS.forEach(yr => {
      const idx = fyrs.indexOf(yr);
      row[`fy${yr}`] = idx >= 0 ? fmt(vals[idx] ?? null) : undefined;
    });
    const idx0 = 0, idx1 = 1;
    if (vals[idx0] != null && vals[idx1] != null && vals[idx1] !== 0) {
      const pct = ((vals[idx0]! - vals[idx1]!) / Math.abs(vals[idx1]!)) * 100;
      row.yoy = pct >= 0 ? `▲${pct.toFixed(0)}%` : `▼${Math.abs(pct).toFixed(0)}%`;
    } else {
      row.yoy = '—';
    }
    return row;
  };

  const toBsRow = (label: string, vals: (number | null)[] = []) => {
    const row: any = { item: label };
    BS_COLS.forEach(yr => {
      const idx = fyrs.indexOf(yr);
      row[`fy${yr}`] = idx >= 0 ? fmt(vals[idx] ?? null) : undefined;
    });
    return row;
  };

  const isKr   = source === 'DART';
  const name   = rawDart?.corp_name ?? rawEdgar?.ticker ?? '';
  const yr     = fyrs[0];
  const srcLbl = isKr ? 'DART 공시' : 'SEC EDGAR';

  const hasVal = (row: any) => Object.keys(row).some(k => k.startsWith('fy') && row[k] && row[k] !== '—');

  return {
    key_bullets: ([
      `${srcLbl} 공식 데이터 (${yr}년 기준)`,
      series.revenue?.[0]        != null ? `${yr}년 ${isKr ? '매출액' : 'Revenue'}: ${fmt(series.revenue[0])}` : null,
      series.operatingIncome?.[0] != null ? `${yr}년 ${isKr ? '영업이익' : 'Operating Income'}: ${fmt(series.operatingIncome[0])}` : null,
    ] as (string | null)[]).filter((x): x is string => x !== null),
    narrative: `[${srcLbl}] ${name} ${yr}년 재무 수치 (${isKr ? '연결재무제표' : '10-K 기준'})`,
    income_statement: [
      toIsRow(isKr ? '매출액'     : 'Revenue',           series.revenue),
      toIsRow(isKr ? '영업이익'   : 'Operating Income',  series.operatingIncome),
      toIsRow(isKr ? '당기순이익' : 'Net Income',        series.netIncome),
    ].filter(hasVal),
    balance_sheet: [
      toBsRow(isKr ? '총자산'   : 'Total Assets',          series.assets),
      toBsRow(isKr ? '총부채'   : 'Total Liabilities',     series.liabilities),
      toBsRow(isKr ? '자본총계' : "Shareholders' Equity",  series.equity),
    ].filter(hasVal),
    cash_flow: { operating: '—', investing: '—', financing: '—', fcf: '—', notes: `${srcLbl} 배치 데이터 — 현금흐름 미포함` },
    munger_buffett_metrics: { roe: '—', roic: '—', owner_earnings: '—', debt_to_equity: '—', interest_coverage: '—', reinvestment_rate: '—' },
    key_risks: [],
    outlook: { shortTerm: '', midLongTerm: '', keyRisks: [] },
    sources: [{
      index: 1, level: 'L1' as const, organization: srcLbl, date: yr,
      content: `${name} 연간 재무제표 (공식 공시)`, isEstimate: false,
      url: source === 'EDGAR' && rawEdgar?.cik
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${rawEdgar.cik}&type=10-K`
        : undefined,
    }],
  } as unknown as FinancialsV2;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBatchDbFields(batchNum: number, data: Partial<AnalysisData>): Record<string, any> {
  switch (batchNum) {
    case 1: return {
      summary_v2: data.summary_v2 ?? null,
      summary:    data.summary_v2?.key_bullets?.join(' | ') ?? '',
    };
    // industry_history_v2/tech_evolution_v2는 배치2/3이 더 이상 생성하지 않음(온디맨드 전환) —
    // 여기서 필드를 포함하면 이미 온디맨드로 생성돼 있던 값을 배치 재실행 시 null로 덮어쓰게 되므로
    // 아예 건드리지 않는다(별도 소유자: /api/analyze/reanalyze의 getReanalyzeSectionDbFields).
    case 2: return {
      business_model_v2:   data.business_model_v2   ?? null,
      competitors_v2:      data.competitors_v2       ?? null,
    };
    case 3: return {
      value_chain_v2:    data.value_chain_v2    ?? null,
      strategy_v2:       data.strategy_v2       ?? null,
    };
    case 4: return {
      financials_v2: data.financials_v2 ?? null,
      sources:       data.sources       ?? {},
      financials:    data.financials_v2?.narrative ?? '',
    };
    case 5: return {
      founder_v2: data.founder_v2 ?? null,
    };
    default: return {};
  }
}

function buildDonePayload(
  data: any,
  companyName: string,
  meta: { cached: boolean; analysisId: string | null; createdAt: string; dataSource: string; growthScenario?: Record<string, any> | null; isPremium: boolean },
) {
  // 성장 시나리오는 계산/저장은 항상 수행하되, 응답 페이로드는 프리미엄 유저에게만 포함
  const growthScenarioOut = meta.isPremium ? (meta.growthScenario ?? data.growth_scenario_v2 ?? null) : null;
  return {
    analysisId:   meta.analysisId,
    companyName,
    createdAt:    meta.createdAt,
    cached:       meta.cached,
    summary:              data.summary_v2?.key_bullets?.join(' | ') ?? '',
    industry_history:     '',
    tech_evolution:       '',
    value_chain_overview: '',
    business_model:       '',
    financials:           '',
    metrics: [], strengths: [], risks: [],
    moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
    financials_structured: {},
    sources:          data.sources ?? {},
    valuechainPlayers: [],
    summary_v2:          data.summary_v2          ?? null,
    industry_history_v2: data.industry_history_v2 ?? null,
    tech_evolution_v2:   data.tech_evolution_v2   ?? null,
    value_chain_v2:      data.value_chain_v2      ?? null,
    business_model_v2:   data.business_model_v2   ?? null,
    competitors_v2:      data.competitors_v2       ?? null,
    strategy_v2:         data.strategy_v2          ?? null,
    financials_v2:       data.financials_v2        ?? null,
    founder_v2:          data.founder_v2           ?? null,
    growth_scenario_v2:  growthScenarioOut,
    dataSource:          meta.dataSource,
  };
}

async function saveSources(analysisId: string, companyName: string, sources: AnalysisSources) {
  const rows = (Object.entries(sources) as [string, any[]][])
    .flatMap(([tab, srcs]) =>
      (srcs ?? []).map((s: any) => ({
        analysis_id:  analysisId,
        company_name: companyName,
        tab_name:     tab,
        source_index: s.index,
        level:        s.level,
        organization: s.organization,
        date:         s.date,
        content:      s.content,
        is_estimate:  s.isEstimate ?? (s.level === 'L3'),
        url:          s.url ?? null,
      })),
    );
  if (rows.length > 0) {
    await supabase.from('analysis_sources').insert(rows);
  }
}

// ── Non-streaming POST /api/analyze ──────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { companyName, companyId } = req.body as { companyName?: string; companyId?: string };

  if (!companyName?.trim()) {
    res.status(400).json({ error: '기업명을 입력해주세요.' });
    return;
  }

  const name = companyName.trim();

  try {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

    const listings = await fetchCompanyListings(companyId ?? company.id);
    const { source: dataSource, contextText } = await fetchFinancialContext(name, listings);
    const analysis = await analyzeCompany(name, contextText || undefined);

    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id:           company.id,
        summary:              analysis.summary_v2?.key_bullets?.join(' | ') ?? '',
        industry_history:     analysis.industry_history_v2?.industry_name ?? '',
        tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
        value_chain_overview: analysis.value_chain_v2?.industry ?? '',
        business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
        financials:           analysis.financials_v2?.narrative ?? '',
        metrics: [], strengths: [], risks: [],
        moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
        financials_structured: {},
        sources:     analysis.sources ?? {},
        data_source: dataSource,
        summary_v2:          analysis.summary_v2,
        industry_history_v2: analysis.industry_history_v2,
        tech_evolution_v2:   analysis.tech_evolution_v2,
        value_chain_v2:      analysis.value_chain_v2,
        business_model_v2:   analysis.business_model_v2,
        competitors_v2:      analysis.competitors_v2,
        strategy_v2:         analysis.strategy_v2,
        financials_v2:       analysis.financials_v2,
        founder_v2:          analysis.founder_v2,
      })
      .select('id, created_at')
      .single();
    if (analysisErr) throw analysisErr;

    await saveSources(savedAnalysis.id, name, analysis.sources ?? {});

    res.json({
      analysisId: savedAnalysis.id,
      companyName: name,
      createdAt:   savedAnalysis.created_at,
      summary:              analysis.summary_v2?.key_bullets?.join(' | ') ?? '',
      industry_history:     analysis.industry_history_v2?.industry_name ?? '',
      tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
      value_chain_overview: analysis.value_chain_v2?.industry ?? '',
      business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
      financials:           analysis.financials_v2?.narrative ?? '',
      metrics: [], strengths: [], risks: [],
      moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
      financials_structured: {},
      sources:          analysis.sources ?? {},
      valuechainPlayers: [],
      summary_v2:          analysis.summary_v2,
      industry_history_v2: analysis.industry_history_v2,
      tech_evolution_v2:   analysis.tech_evolution_v2,
      value_chain_v2:      analysis.value_chain_v2,
      business_model_v2:   analysis.business_model_v2,
      competitors_v2:      analysis.competitors_v2,
      strategy_v2:         analysis.strategy_v2,
      financials_v2:       analysis.financials_v2,
      founder_v2:          analysis.founder_v2,
      dataSource,
    });
  } catch (err) {
    console.error('[POST /api/analyze]', err);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.' });
  }
});

// ── GET /api/analyze/usage — 무료 분석 횟수 조회 (분석 실행 없이 카운터 표시용) ──

router.get('/usage', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }
  if (await isPremiumUser({ clientId: null, authUserId: authUser.id })) {
    res.json({ isPremium: true, usedCount: 0, limit: null, nextAvailableAt: null });
    return;
  }
  const usage = await checkAnalysisUsage(authUser.id);
  res.json({ isPremium: false, usedCount: usage.usedCount, limit: 2, nextAvailableAt: usage.nextAvailableAt ?? null });
});

// ── Streaming POST /api/analyze/stream ───────────────────────────────────────

router.post('/stream', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { companyName, companyId, forceRefresh, sectorTag, baseRevenue } = req.body as {
    companyName?: string;
    companyId?: string;
    forceRefresh?: boolean;
    // 상장 정보/자체 매출 시계열이 없는 기업의 몬테카를로 폴백용 (섹터 벤치마크).
    // 업종 선택 UI가 아직 없어 우선 요청 파라미터로 받는다 — 둘 다 있어야 사용됨.
    sectorTag?: string;
    baseRevenue?: number;
  };
  const isPremium = await isPremiumUser({ clientId: null, authUserId: authUser.id });
  const usageUserId = authUser.id;

  if (!companyName?.trim()) {
    res.status(400).json({ error: '기업명을 입력해주세요.' });
    return;
  }

  const name = companyName.trim();

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  // 신규 분석/강제 재분석 시에만 카운트 (캐시 그대로 보여주는 경우는 카운트 제외).
  // 프리미엄 유저도 기록은 남긴다(추후 사용량 분석/과금 근거용) — 제한 체크만 스킵.
  // 차단되면 'rate_limited' 이벤트를 보내고 스트림을 종료한다.
  const checkAndRecordUsage = async (): Promise<boolean> => {
    if (!isPremium) {
      const usage = await checkAnalysisUsage(usageUserId);
      if (!usage.allowed) {
        const nextDate = usage.nextAvailableAt ? usage.nextAvailableAt.slice(0, 10) : '';
        send('rate_limited', {
          message: `최근 7일간 무료 분석 2회를 모두 사용했어요. 다음 사용 가능 시점: ${nextDate}. 프리미엄으로 무제한 이용하기`,
          usedCount: usage.usedCount,
          nextAvailableAt: usage.nextAvailableAt,
        });
        res.end();
        return false;
      }
    }
    await recordAnalysisUsage(usageUserId, name);
    return true;
  };

  try {
    // 1. Upsert company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

    // 다중상장 회사(EDGAR+DART 둘 다 company_listings에 있음)면 fetchFinancialContext가
    // 이름 휴리스틱 대신 이 identifier로 직접 조회한다 — 없으면 기존 경로 그대로.
    const listings = await fetchCompanyListings(companyId ?? company.id);

    // 2. Check financials_v2_cache (3-month validity, company_name exact match)
    const finCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: finCache } = await supabase
      .from('financials_v2_cache')
      .select('financials_v2, company_name')
      .eq('company_name', name)           // 정확히 일치하는 company_name만
      .gte('updated_at', finCutoff)
      .maybeSingle();

    let cachedFinancials: FinancialsV2 | undefined = finCache?.financials_v2 ?? undefined;

    // 캐시 데이터 회사명 일치 검증 — 서사에 회사명 키워드가 없으면 오염된 캐시로 판단하고 무시
    if (cachedFinancials && finCache?.company_name === name) {
      const narrative = (cachedFinancials.narrative ?? '').toLowerCase();
      const nameTokens = name.toLowerCase().split(/[\s,.\-]+/).filter(t => t.length >= 3);
      const hasMatch = nameTokens.some(token => narrative.includes(token));
      if (!hasMatch) {
        console.warn(`[financials_cache] company name mismatch in narrative — discarding cache for "${name}"`);
        cachedFinancials = undefined;
        // 오염된 캐시 즉시 삭제
        await supabase.from('financials_v2_cache').delete().eq('company_name', name);
      } else {
        console.log(`[financials_cache] HIT "${name}"`);
      }
    }

    // 3. Check analysis cache (무기한 — forceRefresh: true 시에만 재분석)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('analyses')
        .select('id, created_at, summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, strategy_v2, financials_v2, founder_v2, growth_scenario_v2, sources, data_source')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const b1 = !!cached.summary_v2;
        // industry_history_v2/tech_evolution_v2는 온디맨드 전환(2026-07)으로 배치2/3에 더 이상
        // 포함되지 않음 — "배치 완료" 판정에서 제외해야 아직 온디맨드 생성 전인 정상 캐시 행이
        // 매번 배치 전체 재생성으로 이어지지 않는다. 캐시에 있으면 sendCached에서 별도로 실어보냄.
        const b2 = !!(cached.business_model_v2 && cached.competitors_v2);
        const b3 = !!(cached.value_chain_v2 && cached.strategy_v2);
        const b4 = !!cached.financials_v2;
        const b5 = !!cached.founder_v2;

        if (b1 && b2 && b3 && b4 && b5) {
          // Full cache hit — financial_cache 조회 (web_search 기반 캐시만 업그레이드)
          let effectiveFinancials = cached.financials_v2;
          let effectiveSource: string = cached.data_source ?? 'web_search';

          if (cached.data_source === 'web_search') {
            try {
              const isKorean = /[가-힯]/.test(name);
              const now = new Date().toISOString();
              if (isKorean) {
                const { data: corpRow } = await supabase
                  .from('corp_master').select('stock_code')
                  .ilike('corp_name', name).not('stock_code', 'is', null).maybeSingle();
                if (corpRow?.stock_code) {
                  const { data: fc } = await supabase
                    .from('financial_cache').select('source, raw_edgar, raw_dart')
                    .eq('company_name', corpRow.stock_code).gt('expires_at', now).maybeSingle();
                  if (fc) {
                    const built = buildFinancialsV2FromRaw(fc.raw_edgar, fc.raw_dart, fc.source as 'EDGAR' | 'DART');
                    if (built) { effectiveFinancials = built; effectiveSource = fc.source.toLowerCase(); }
                  }
                }
              } else {
                // 티커 직접 입력 케이스 (AAPL, MSFT 등 1~6자 대문자)
                const nameTicker = name.toUpperCase().replace(/\s+/g, '');
                if (/^[A-Z]{1,6}$/.test(nameTicker)) {
                  const { data: fc } = await supabase
                    .from('financial_cache').select('source, raw_edgar, raw_dart')
                    .eq('company_name', nameTicker).gt('expires_at', now).maybeSingle();
                  if (fc) {
                    const built = buildFinancialsV2FromRaw(fc.raw_edgar, fc.raw_dart, fc.source as 'EDGAR' | 'DART');
                    if (built) { effectiveFinancials = built; effectiveSource = fc.source.toLowerCase(); }
                  }
                }
              }
            } catch (e) {
              console.warn('[financial_cache full-hit check]', (e as Error).message);
            }
          }

          send('done', buildDonePayload(
            { ...cached, financials_v2: effectiveFinancials },
            name,
            { cached: true, analysisId: cached.id, createdAt: cached.created_at, dataSource: effectiveSource, isPremium },
          ));
          return res.end();
        }

        // Partial cache — send completed batches immediately, run missing ones
        const skipBatches = new Set<number>();
        const initialData: Partial<AnalysisData> = {};
        let completedCount = 0;

        const sendCached = (batchNum: number, data: Record<string, any>) => {
          completedCount++;
          skipBatches.add(batchNum);
          Object.assign(initialData, data);
          send('batch', { batch: batchNum, data, completed: completedCount, total: 5, analysisId: cached.id });
        };

        if (b1) sendCached(1, { summary_v2: cached.summary_v2 });
        // industry_history_v2/tech_evolution_v2는 온디맨드라 캐시에 있을 때만 실어보냄 —
        // 없으면 프론트에서 undefined로 남아 해당 탭 클릭 시 온디맨드 생성이 트리거됨.
        if (b2) sendCached(2, {
          business_model_v2: cached.business_model_v2,
          competitors_v2:    cached.competitors_v2,
          ...(cached.industry_history_v2 ? { industry_history_v2: cached.industry_history_v2 } : {}),
        });
        if (b3) sendCached(3, {
          value_chain_v2: cached.value_chain_v2,
          strategy_v2:    cached.strategy_v2,
          ...(cached.tech_evolution_v2 ? { tech_evolution_v2: cached.tech_evolution_v2 } : {}),
        });
        if (b4) sendCached(4, { financials_v2: cached.financials_v2, sources: cached.sources ?? {} });
        if (b5) sendCached(5, { founder_v2: cached.founder_v2 });

        if (!(await checkAndRecordUsage())) return;

        const { source: dataSource, contextText, rawEdgar, rawDart, isCacheHit } = await fetchFinancialContext(name, listings);
        send('meta', { isFirstLookup: !isCacheHit });
        const useCachedFin = !skipBatches.has(4) ? cachedFinancials : undefined;

        // fin_preview: send financials immediately from raw cache if batch 4 hasn't loaded yet
        if (!skipBatches.has(4)) {
          const quickFin = (rawEdgar || rawDart)
            ? buildFinancialsV2FromRaw(rawEdgar ?? null, rawDart ?? null, rawDart ? 'DART' : 'EDGAR')
            : (useCachedFin ?? null);
          if (quickFin) {
            const previewSource = rawDart ? 'dart' : (rawEdgar ? 'edgar' : dataSource);
            send('fin_preview', { financials_v2: quickFin, dataSource: previewSource });
          }
        }

        const analysis = await analyzeCompany(
          name,
          contextText || undefined,
          async (batchNum, data) => {
            completedCount++;
            send('batch', { batch: batchNum, data, completed: completedCount, total: 5, analysisId: cached.id });
            const fields = getBatchDbFields(batchNum, data);
            if (Object.keys(fields).length > 0) {
              await supabase.from('analyses').update(fields).eq('id', cached.id);
            }
            if (batchNum === 4 && !cachedFinancials && data.financials_v2) {
              await supabase.from('financials_v2_cache').upsert(
                { company_name: name, financials_v2: data.financials_v2, updated_at: new Date().toISOString() },
                { onConflict: 'company_name' },
              );
            }
          },
          { skipBatches, initialData, cachedFinancials: useCachedFin },
        );

        if (analysis.sources) await saveSources(cached.id, name, analysis.sources);

        // 3차: 2차(batch2-5) 완료 후 revenue_history 확보 시에만 몬테카를로 트리거
        // 계산/DB 저장은 항상 수행 — 프리미엄 여부와 무관하게 데이터는 준비해둔다.
        const growthScenario = cached.growth_scenario_v2 ?? await computeGrowthScenario(name, rawEdgar, rawDart, sectorTag, baseRevenue);
        if (growthScenario && !cached.growth_scenario_v2) {
          await supabase.from('analyses').update({ growth_scenario_v2: growthScenario }).eq('id', cached.id);
        }
        // SSE 전송은 프리미엄 유저에게만 — 무료 유저는 이 이벤트 자체를 받지 않는다.
        if (growthScenario && isPremium) {
          send('batch', { batch: 6, data: { growth_scenario_v2: growthScenario }, completed: completedCount, total: 5, analysisId: cached.id });
        }

        send('done', buildDonePayload(analysis, name, {
          cached: false,
          analysisId: cached.id,
          createdAt:  cached.created_at,
          dataSource: dataSource ?? cached.data_source ?? 'web_search',
          growthScenario,
          isPremium,
        }));
        return res.end();
      }
    }

    // 4. No cache — full analysis with per-batch DB saves
    if (!(await checkAndRecordUsage())) return;

    const { source: dataSource, contextText, rawEdgar, rawDart, isCacheHit } = await fetchFinancialContext(name, listings);
    send('meta', { isFirstLookup: !isCacheHit });

    // fin_preview: show financials immediately from raw/cached data if available
    {
      const quickFin = (rawEdgar || rawDart)
        ? buildFinancialsV2FromRaw(rawEdgar ?? null, rawDart ?? null, rawDart ? 'DART' : 'EDGAR')
        : (cachedFinancials ?? null);
      if (quickFin) {
        const previewSource = rawDart ? 'dart' : (rawEdgar ? 'edgar' : dataSource);
        send('fin_preview', { financials_v2: quickFin, dataSource: previewSource });
      }
    }

    let savedId: string | null = null;
    let savedAt: string | null = null;
    let batchCount = 0;

    const analysis = await analyzeCompany(
      name,
      contextText || undefined,
      async (batchNum, data) => {
        batchCount++;

        if (batchNum === 1) {
          const { data: saved, error } = await supabase
            .from('analyses')
            .insert({
              company_id: company.id,
              summary:    data.summary_v2?.key_bullets?.join(' | ') ?? '',
              industry_history: '', tech_evolution: '', value_chain_overview: '',
              business_model: '', financials: '',
              metrics: [], strengths: [], risks: [],
              moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
              financials_structured: {},
              sources:     {},
              data_source: dataSource,
              summary_v2:          data.summary_v2 ?? null,
              industry_history_v2: null,
              tech_evolution_v2:   null,
              value_chain_v2:      null,
              business_model_v2:   null,
              competitors_v2:      null,
              strategy_v2:         null,
              financials_v2:       null,
              founder_v2:          null,
            })
            .select('id, created_at')
            .single();
          if (!error && saved) { savedId = saved.id; savedAt = saved.created_at; }
          send('batch', { batch: batchNum, data, completed: batchCount, total: 5, analysisId: savedId });

        } else if (savedId) {
          const fields = getBatchDbFields(batchNum, data);
          if (Object.keys(fields).length > 0) {
            await supabase.from('analyses').update(fields).eq('id', savedId);
          }
          send('batch', { batch: batchNum, data, completed: batchCount, total: 5, analysisId: savedId });

          if (batchNum === 4 && !cachedFinancials && data.financials_v2) {
            await supabase.from('financials_v2_cache').upsert(
              { company_name: name, financials_v2: data.financials_v2, updated_at: new Date().toISOString() },
              { onConflict: 'company_name' },
            );
          }
        }
      },
      { cachedFinancials },
    );

    if (savedId && analysis.sources) await saveSources(savedId, name, analysis.sources);

    // 3차: 2차(batch2-5) 완료 후 revenue_history 확보 시에만 몬테카를로 트리거
    // 계산/DB 저장은 항상 수행 — 프리미엄 여부와 무관하게 데이터는 준비해둔다.
    const growthScenario = await computeGrowthScenario(name, rawEdgar, rawDart, sectorTag, baseRevenue);
    if (growthScenario && savedId) {
      await supabase.from('analyses').update({ growth_scenario_v2: growthScenario }).eq('id', savedId);
    }
    // SSE 전송은 프리미엄 유저에게만 — 무료 유저는 이 이벤트 자체를 받지 않는다.
    if (growthScenario && savedId && isPremium) {
      send('batch', { batch: 6, data: { growth_scenario_v2: growthScenario }, completed: batchCount, total: 5, analysisId: savedId });
    }

    send('done', buildDonePayload(analysis, name, {
      cached:     false,
      analysisId: savedId,
      createdAt:  savedAt ?? new Date().toISOString(),
      dataSource,
      growthScenario,
      isPremium,
    }));
    res.end();

  } catch (err) {
    console.error('[POST /api/analyze/stream]', err);
    send('error', { message: '분석 중 오류가 발생했습니다.' });
    res.end();
  }
});

// ── POST /api/analyze/reanalyze — 단일 섹션 재분석 ──────────────────────────────

const REANALYZE_SECTION_MAP: Record<string, string> = {
  summary:        'summary_v2',
  industry:       'industry_history_v2',
  business_model: 'business_model_v2',
  competitors:    'competitors_v2',
  tech:           'tech_evolution_v2',
  value_chain:    'value_chain_v2',
  strategy:       'strategy_v2',
  financials:     'financials_v2',
  founder:        'founder_v2',
};

function getReanalyzeSectionDbFields(sectionKey: string, data: any): Record<string, any> {
  switch (sectionKey) {
    case 'summary_v2':          return { summary_v2: data, summary: data?.key_bullets?.join(' | ') ?? '' };
    case 'financials_v2':       return { financials_v2: data, financials: data?.narrative ?? '' };
    case 'business_model_v2':   return { business_model_v2: data, business_model: data?.growth_motion_detail ?? '' };
    default:                    return { [sectionKey]: data };
  }
}

router.post('/reanalyze', async (req: Request, res: Response) => {
  const { analysisId, companyName, section } = req.body as {
    analysisId?: string;
    companyName?: string;
    section?: string;
  };

  if (!analysisId?.trim() || !companyName?.trim() || !section?.trim()) {
    res.status(400).json({ error: 'analysisId, companyName, section 모두 필요합니다.' });
    return;
  }

  const sectionKey = REANALYZE_SECTION_MAP[section];
  if (!sectionKey) {
    res.status(400).json({ error: `알 수 없는 섹션: ${section}` });
    return;
  }

  const name = companyName.trim();
  console.log(`[reanalyze] START ${section} (${sectionKey}) for "${name}"`);

  try {
    let financialCtx: string | undefined;
    if (sectionKey === 'financials_v2') {
      const { contextText } = await fetchFinancialContext(name);
      financialCtx = contextText || undefined;
    }

    const data = await reanalyzeSingleSection(name, sectionKey, financialCtx);

    if (!data) {
      res.status(422).json({ error: '재분석 결과를 얻지 못했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }

    const dbFields = getReanalyzeSectionDbFields(sectionKey, data);
    const { error: updateErr } = await supabase
      .from('analyses')
      .update(dbFields)
      .eq('id', analysisId.trim());

    if (updateErr) throw updateErr;

    console.log(`[reanalyze] OK ${section} for "${name}"`);
    res.json({ section, data });
  } catch (err) {
    console.error(`[reanalyze] ${section} FAIL`, err);
    res.status(500).json({ error: '재분석 중 오류가 발생했습니다.' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { analyzeCompany, AnalysisData, AnalysisSources, FinancialsV2 } from '../lib/claude';
import { fetchFinancialContext } from '../lib/financialContext';

const router = Router();

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
    case 2: return {
      industry_history_v2: data.industry_history_v2 ?? null,
      business_model_v2:   data.business_model_v2   ?? null,
      competitors_v2:      data.competitors_v2       ?? null,
    };
    case 3: return {
      tech_evolution_v2: data.tech_evolution_v2 ?? null,
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
  meta: { cached: boolean; analysisId: string | null; createdAt: string; dataSource: string },
) {
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
  const { companyName } = req.body as { companyName?: string };

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

    const { source: dataSource, contextText } = await fetchFinancialContext(name);
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

// ── Streaming POST /api/analyze/stream ───────────────────────────────────────

router.post('/stream', async (req: Request, res: Response) => {
  const { companyName, forceRefresh } = req.body as { companyName?: string; forceRefresh?: boolean };

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

  try {
    // 1. Upsert company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

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
        .select('id, created_at, summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, strategy_v2, financials_v2, founder_v2, sources, data_source')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const b1 = !!cached.summary_v2;
        const b2 = !!(cached.industry_history_v2 && cached.business_model_v2 && cached.competitors_v2);
        const b3 = !!(cached.tech_evolution_v2 && cached.value_chain_v2 && cached.strategy_v2);
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
            { cached: true, analysisId: cached.id, createdAt: cached.created_at, dataSource: effectiveSource },
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
        if (b2) sendCached(2, { industry_history_v2: cached.industry_history_v2, business_model_v2: cached.business_model_v2, competitors_v2: cached.competitors_v2 });
        if (b3) sendCached(3, { tech_evolution_v2: cached.tech_evolution_v2, value_chain_v2: cached.value_chain_v2, strategy_v2: cached.strategy_v2 });
        if (b4) sendCached(4, { financials_v2: cached.financials_v2, sources: cached.sources ?? {} });
        if (b5) sendCached(5, { founder_v2: cached.founder_v2 });

        const { source: dataSource, contextText, rawEdgar, rawDart } = await fetchFinancialContext(name);
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

        send('done', buildDonePayload(analysis, name, {
          cached: false,
          analysisId: cached.id,
          createdAt:  cached.created_at,
          dataSource: dataSource ?? cached.data_source ?? 'web_search',
        }));
        return res.end();
      }
    }

    // 4. No cache — full analysis with per-batch DB saves
    const { source: dataSource, contextText, rawEdgar, rawDart } = await fetchFinancialContext(name);

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

    send('done', buildDonePayload(analysis, name, {
      cached:     false,
      analysisId: savedId,
      createdAt:  savedAt ?? new Date().toISOString(),
      dataSource,
    }));
    res.end();

  } catch (err) {
    console.error('[POST /api/analyze/stream]', err);
    send('error', { message: '분석 중 오류가 발생했습니다.' });
    res.end();
  }
});

export default router;

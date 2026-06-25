import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { analyzeCompany, AnalysisData, AnalysisSources, FinancialsV2 } from '../lib/claude';
import { fetchFinancialContext } from '../lib/financialContext';

const router = Router();

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
      financials_v2: data.financials_v2  ?? null,
      founder_v2:    data.founder_v2     ?? null,
      sources:       data.sources        ?? {},
      financials:    data.financials_v2?.narrative ?? '',
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

    // 2. Check financials_v2_cache (3-month validity)
    const finCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: finCache } = await supabase
      .from('financials_v2_cache')
      .select('financials_v2')
      .eq('company_name', name)
      .gte('updated_at', finCutoff)
      .maybeSingle();
    const cachedFinancials: FinancialsV2 | undefined = finCache?.financials_v2 ?? undefined;

    // 3. Check analysis cache (24h) — full or partial
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cached } = await supabase
        .from('analyses')
        .select('id, created_at, summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, strategy_v2, financials_v2, founder_v2, sources, data_source')
        .eq('company_id', company.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const b1 = !!cached.summary_v2;
        const b2 = !!(cached.industry_history_v2 && cached.business_model_v2 && cached.competitors_v2);
        const b3 = !!(cached.tech_evolution_v2 && cached.value_chain_v2 && cached.strategy_v2);
        const b4 = !!(cached.financials_v2 && cached.founder_v2);

        if (b1 && b2 && b3 && b4) {
          // Full cache hit
          send('done', buildDonePayload(cached, name, {
            cached: true,
            analysisId: cached.id,
            createdAt:  cached.created_at,
            dataSource: cached.data_source ?? 'web_search',
          }));
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
          send('batch', { batch: batchNum, data, completed: completedCount, total: 4, analysisId: cached.id });
        };

        if (b1) sendCached(1, { summary_v2: cached.summary_v2 });
        if (b2) sendCached(2, { industry_history_v2: cached.industry_history_v2, business_model_v2: cached.business_model_v2, competitors_v2: cached.competitors_v2 });
        if (b3) sendCached(3, { tech_evolution_v2: cached.tech_evolution_v2, value_chain_v2: cached.value_chain_v2, strategy_v2: cached.strategy_v2 });
        if (b4) sendCached(4, { financials_v2: cached.financials_v2, founder_v2: cached.founder_v2, sources: cached.sources ?? {} });

        const { source: dataSource, contextText } = await fetchFinancialContext(name);
        const useCachedFin = !skipBatches.has(4) ? cachedFinancials : undefined;

        const analysis = await analyzeCompany(
          name,
          contextText || undefined,
          async (batchNum, data) => {
            completedCount++;
            send('batch', { batch: batchNum, data, completed: completedCount, total: 4, analysisId: cached.id });
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
    const { source: dataSource, contextText } = await fetchFinancialContext(name);
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
          send('batch', { batch: batchNum, data, completed: batchCount, total: 4, analysisId: savedId });

        } else if (savedId) {
          const fields = getBatchDbFields(batchNum, data);
          if (Object.keys(fields).length > 0) {
            await supabase.from('analyses').update(fields).eq('id', savedId);
          }
          send('batch', { batch: batchNum, data, completed: batchCount, total: 4, analysisId: savedId });

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

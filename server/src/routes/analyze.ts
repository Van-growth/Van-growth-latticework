import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { analyzeCompany } from '../lib/claude';
import { fetchFinancialContext } from '../lib/financialContext';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { companyName } = req.body as { companyName?: string };

  if (!companyName?.trim()) {
    res.status(400).json({ error: '기업명을 입력해주세요.' });
    return;
  }

  const name = companyName.trim();

  try {
    // 1. Upsert company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();

    if (companyErr) throw companyErr;

    // 2. Fetch financial context (DART / EDGAR) — graceful fallback to web_search
    const { source: dataSource, contextText } = await fetchFinancialContext(name);

    // 3. Run AI analysis
    const analysis = await analyzeCompany(name, contextText || undefined);

    // 4. Save analysis — new _v2 columns + minimal legacy text columns
    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id: company.id,
        // Legacy columns (minimal values for backward compat)
        summary:              analysis.summary_v2?.one_line ?? '',
        industry_history:     analysis.industry_history_v2?.industry_name ?? '',
        tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
        value_chain_overview: analysis.value_chain_v2?.industry ?? '',
        business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
        financials:           analysis.financials_v2?.narrative ?? '',
        metrics:              [],
        strengths:            [],
        risks:                [],
        moat_analysis:        {},
        risk_analysis:        {},
        competitors:          {},
        strategy:             {},
        financials_structured: {},
        sources:              analysis.sources ?? {},
        data_source:          dataSource,
        // V2 columns
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

    // 5. Save sources to analysis_sources table (versioned accumulation)
    const sourceRows = (Object.entries(analysis.sources ?? {}) as [string, any[]][])
      .flatMap(([tab, srcs]) =>
        (srcs ?? []).map(s => ({
          analysis_id:  savedAnalysis.id,
          company_name: name,
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
    if (sourceRows.length > 0) {
      await supabase.from('analysis_sources').insert(sourceRows);
    }

    res.json({
      analysisId: savedAnalysis.id,
      companyName: name,
      createdAt: savedAnalysis.created_at,
      // Legacy fields
      summary:              analysis.summary_v2?.one_line ?? '',
      industry_history:     analysis.industry_history_v2?.industry_name ?? '',
      tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
      value_chain_overview: analysis.value_chain_v2?.industry ?? '',
      business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
      financials:           analysis.financials_v2?.narrative ?? '',
      metrics:              [],
      strengths:            [],
      risks:                [],
      moat_analysis:        {},
      risk_analysis:        {},
      competitors:          {},
      strategy:             {},
      financials_structured: {},
      sources:              analysis.sources ?? {},
      valuechainPlayers:    [],
      // V2 fields
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

// POST /api/analyze/stream — SSE streaming with progressive section delivery
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

    // 2. Cache check — return existing analysis within 24h
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
        send('done', {
          analysisId: cached.id,
          companyName: name,
          createdAt: cached.created_at,
          cached: true,
          summary: cached.summary_v2?.one_line ?? '',
          industry_history: '', tech_evolution: '', value_chain_overview: '',
          business_model: '', financials: '',
          metrics: [], strengths: [], risks: [],
          moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
          financials_structured: {},
          sources: cached.sources ?? {},
          valuechainPlayers: [],
          summary_v2:          cached.summary_v2,
          industry_history_v2: cached.industry_history_v2,
          tech_evolution_v2:   cached.tech_evolution_v2,
          value_chain_v2:      cached.value_chain_v2,
          business_model_v2:   cached.business_model_v2,
          competitors_v2:      cached.competitors_v2,
          strategy_v2:         cached.strategy_v2,
          financials_v2:       cached.financials_v2,
          founder_v2:          cached.founder_v2,
          dataSource: cached.data_source ?? 'web_search',
        });
        return res.end();
      }
    }

    // 3. Fetch financial context
    const { source: dataSource, contextText } = await fetchFinancialContext(name);

    // 4. Stream analysis — emit each section as it completes
    const analysis = await analyzeCompany(
      name,
      contextText || undefined,
      (key, data, completed, total) => {
        send('section', { section: key, data, completed, total });
      },
    );

    // 5. Persist
    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id:           company.id,
        summary:              analysis.summary_v2?.one_line ?? '',
        industry_history:     analysis.industry_history_v2?.industry_name ?? '',
        tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
        value_chain_overview: analysis.value_chain_v2?.industry ?? '',
        business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
        financials:           analysis.financials_v2?.narrative ?? '',
        metrics: [], strengths: [], risks: [],
        moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
        financials_structured: {},
        sources:              analysis.sources ?? {},
        data_source:          dataSource,
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

    // 6. Save sources
    const sourceRows = (Object.entries(analysis.sources ?? {}) as [string, any[]][])
      .flatMap(([tab, srcs]) =>
        (srcs ?? []).map(s => ({
          analysis_id:  savedAnalysis.id,
          company_name: name,
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
    if (sourceRows.length > 0) await supabase.from('analysis_sources').insert(sourceRows);

    // 7. Final done event with full result
    send('done', {
      analysisId: savedAnalysis.id,
      companyName: name,
      createdAt: savedAnalysis.created_at,
      cached: false,
      summary:              analysis.summary_v2?.one_line ?? '',
      industry_history:     analysis.industry_history_v2?.industry_name ?? '',
      tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
      value_chain_overview: analysis.value_chain_v2?.industry ?? '',
      business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
      financials:           analysis.financials_v2?.narrative ?? '',
      metrics: [], strengths: [], risks: [],
      moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
      financials_structured: {},
      sources:     analysis.sources ?? {},
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

    res.end();
  } catch (err) {
    console.error('[POST /api/analyze/stream]', err);
    send('error', { message: '분석 중 오류가 발생했습니다.' });
    res.end();
  }
});

export default router;

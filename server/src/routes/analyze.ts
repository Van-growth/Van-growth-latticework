import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { analyzeCompany, generateLinkedInDrafts } from '../lib/claude';
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
        moat_analysis:        null,
        risk_analysis:        null,
        competitors:          null,
        strategy:             null,
        financials_structured: null,
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
      })
      .select('id, created_at')
      .single();

    if (analysisErr) throw analysisErr;

    // 5. Generate & save LinkedIn drafts
    const drafts = await generateLinkedInDrafts(analysis, name);
    if (drafts.length > 0) {
      await supabase.from('linkedin_drafts').insert(
        drafts.map(d => ({
          analysis_id: savedAnalysis.id,
          draft_number: d.draft_number,
          content: d.content,
        })),
      );
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
      moat_analysis:        null,
      risk_analysis:        null,
      competitors:          null,
      strategy:             null,
      financials_structured: null,
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
      dataSource,
      linkedinDrafts: drafts,
    });
  } catch (err) {
    console.error('[POST /api/analyze]', err);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.' });
  }
});

export default router;

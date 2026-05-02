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

    // 3. Run AI analysis (inject financial context when available)
    const analysis = await analyzeCompany(name, contextText || undefined);

    // 4. Save analysis
    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id: company.id,
        summary: analysis.summary,
        metrics: analysis.metrics,
        strengths: analysis.strengths,
        risks: analysis.risks,
        industry_history: analysis.industry_history,
        tech_evolution: analysis.tech_evolution,
        value_chain_overview: analysis.value_chain_overview,
        business_model: analysis.business_model,
        moat_analysis: analysis.moat_analysis,
        risk_analysis: analysis.risk_analysis,
        competitors: analysis.competitors,
        strategy: analysis.strategy,
        financials: analysis.financials,
        financials_structured: analysis.financials_structured,
        sources: analysis.sources,
        data_source: dataSource,
      })
      .select('id, created_at')
      .single();

    if (analysisErr) throw analysisErr;

    // 5. Save value chain players
    if (analysis.value_chain_players.length > 0) {
      await supabase.from('value_chain_players').insert(
        analysis.value_chain_players.map(p => ({
          analysis_id: savedAnalysis.id,
          role: p.role,
          player_name: p.player_name,
          description: p.description,
        })),
      );
    }

    // 6. Generate & save LinkedIn drafts
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
      ...analysis,
      dataSource,
      linkedinDrafts: drafts,
    });
  } catch (err) {
    console.error('[POST /api/analyze]', err);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.' });
  }
});

export default router;

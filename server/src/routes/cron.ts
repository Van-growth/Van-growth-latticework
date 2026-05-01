import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { selectDailyCompany, analyzeCompany, generateLinkedInDrafts } from '../lib/claude';

const router = Router();

// POST /api/cron/daily  — auto-select a company and run analysis
router.post('/daily', async (_req: Request, res: Response) => {
  try {
    // 1. Select today's company
    const companyName = await selectDailyCompany();
    console.log(`[cron] Daily company: ${companyName}`);

    // 2. Check if analyzed in the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('analyses')
      .select('id, companies!inner(name)')
      .eq('companies.name', companyName)
      .gte('created_at', since)
      .maybeSingle();

    if (existing) {
      res.json({ skipped: true, reason: 'Already analyzed today', companyName });
      return;
    }

    // 3. Upsert company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name: companyName }, { onConflict: 'name' })
      .select('id')
      .single();

    if (companyErr) throw companyErr;

    // 4. Run analysis
    const analysis = await analyzeCompany(companyName);

    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id: company.id,
        summary: analysis.summary,
        industry_history: analysis.industry_history,
        tech_evolution: analysis.tech_evolution,
        value_chain_overview: analysis.value_chain_overview,
        business_model: analysis.business_model,
        financials: analysis.financials,
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
    const drafts = await generateLinkedInDrafts(analysis, companyName);
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
      success: true,
      companyName,
      analysisId: savedAnalysis.id,
      createdAt: savedAnalysis.created_at,
    });
  } catch (err) {
    console.error('[POST /api/cron/daily]', err);
    res.status(500).json({ error: '일일 분석 실행 중 오류가 발생했습니다.' });
  }
});

export default router;

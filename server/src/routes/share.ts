import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

type CompanyRef = { name: string } | null;

// GET /api/share/:token — public, no auth required
router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const { data: row, error } = await supabase
      .from('analyses')
      .select('*, companies(name)')
      .eq('share_token', token)
      .eq('is_shared', true)
      .single();

    if (error || !row) {
      res.status(404).json({ error: '공유된 분석을 찾을 수 없습니다.' });
      return;
    }

    const [playersRes, draftsRes] = await Promise.all([
      supabase
        .from('value_chain_players')
        .select('id, role, player_name, description')
        .eq('analysis_id', row.id)
        .order('created_at'),
      supabase
        .from('linkedin_drafts')
        .select('id, draft_number, content')
        .eq('analysis_id', row.id)
        .order('draft_number'),
    ]);

    res.json({
      id: row.id,
      companyName: (row.companies as unknown as CompanyRef)?.name ?? '',
      summary: row.summary,
      metrics: row.metrics ?? [],
      strengths: row.strengths ?? [],
      risks: row.risks ?? [],
      industry_history: row.industry_history,
      tech_evolution: row.tech_evolution,
      value_chain_overview: row.value_chain_overview,
      business_model: row.business_model,
      moat_analysis: row.moat_analysis ?? null,
      risk_analysis: row.risk_analysis ?? null,
      competitors: row.competitors ?? null,
      strategy: row.strategy ?? null,
      financials: row.financials,
      financials_structured: row.financials_structured ?? null,
      sources: row.sources ?? {},
      dataSource: (row.data_source ?? 'web_search') as 'dart' | 'edgar' | 'web_search',
      createdAt: row.created_at,
      is_shared: true,
      share_token: row.share_token,
      valuechainPlayers: playersRes.data ?? [],
      linkedinDrafts: draftsRes.data ?? [],
      summary_v2:          row.summary_v2          ?? null,
      industry_history_v2: row.industry_history_v2 ?? null,
      tech_evolution_v2:   row.tech_evolution_v2   ?? null,
      value_chain_v2:      row.value_chain_v2      ?? null,
      business_model_v2:   row.business_model_v2   ?? null,
      competitors_v2:      row.competitors_v2      ?? null,
      strategy_v2:         row.strategy_v2         ?? null,
      financials_v2:       row.financials_v2        ?? null,
    });
  } catch (err) {
    console.error('[GET /api/share/:token]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

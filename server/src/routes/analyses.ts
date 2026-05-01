import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

type CompanyRef = { name: string } | null;

// GET /api/analyses  — list all analyses (newest first)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('id, summary, created_at, companies(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const items = (data ?? []).map(row => ({
      id: row.id,
      companyName: (row.companies as unknown as CompanyRef)?.name ?? '',
      summary: row.summary,
      createdAt: row.created_at,
    }));

    res.json(items);
  } catch (err) {
    console.error('[GET /api/analyses]', err);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

// GET /api/analyses/:id  — full detail
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const [analysisRes, playersRes, draftsRes] = await Promise.all([
      supabase
        .from('analyses')
        .select('*, companies(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('value_chain_players')
        .select('id, role, player_name, description')
        .eq('analysis_id', id)
        .order('created_at'),
      supabase
        .from('linkedin_drafts')
        .select('id, draft_number, content')
        .eq('analysis_id', id)
        .order('draft_number'),
    ]);

    if (analysisRes.error) throw analysisRes.error;
    if (!analysisRes.data) {
      res.status(404).json({ error: '분석 결과를 찾을 수 없습니다.' });
      return;
    }

    const row = analysisRes.data;
    res.json({
      id: row.id,
      companyName: (row.companies as unknown as CompanyRef)?.name ?? '',
      summary: row.summary,
      industry_history: row.industry_history,
      tech_evolution: row.tech_evolution,
      value_chain_overview: row.value_chain_overview,
      business_model: row.business_model,
      financials: row.financials,
      createdAt: row.created_at,
      valuechainPlayers: playersRes.data ?? [],
      linkedinDrafts: draftsRes.data ?? [],
    });
  } catch (err) {
    console.error('[GET /api/analyses/:id]', err);
    res.status(500).json({ error: '상세 정보를 불러오지 못했습니다.' });
  }
});

export default router;

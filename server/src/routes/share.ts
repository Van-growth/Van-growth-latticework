import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { isPremiumUser } from '../lib/premium';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

type CompanyRef = { name: string } | null;

// GET /api/share/:token — public, no auth required
router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;
  // 공유 페이지는 익명 방문자용 — 원 작성자의 프리미엄 여부와 무관하게 방문자 본인 상태로 판단.
  // X-Client-Id/Authorization 미전송 시(대부분) isPremiumUser → 항상 false, 성장 시나리오는 잠금 유지.
  const clientId = (req.headers['x-client-id'] as string | undefined)?.trim() || null;
  const authUser = await resolveAuthUser(req);
  const isPremium = await isPremiumUser({ clientId, authUserId: authUser?.id ?? null });

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

    const playersRes = await supabase
      .from('value_chain_players')
      .select('id, role, player_name, description')
      .eq('analysis_id', row.id)
      .order('created_at');

    res.json({
      id: row.id,
      companyName: (row.companies as unknown as CompanyRef)?.name ?? '',
      language: row.language ?? 'en',
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
      summary_v2:          row.summary_v2          ?? null,
      industry_history_v2: row.industry_history_v2 ?? null,
      tech_evolution_v2:   row.tech_evolution_v2   ?? null,
      value_chain_v2:      row.value_chain_v2      ?? null,
      business_model_v2:   row.business_model_v2   ?? null,
      competitors_v2:      row.competitors_v2      ?? null,
      cross_industry_nudge_v1: row.cross_industry_nudge_v1 ?? null,
      strategy_v2:         row.strategy_v2         ?? null,
      financials_v2:       row.financials_v2        ?? null,
      founder_v2:          row.founder_v2           ?? null,
      growth_scenario_v2:  isPremium ? (row.growth_scenario_v2 ?? null) : null,
    });
  } catch (err) {
    console.error('[GET /api/share/:token]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

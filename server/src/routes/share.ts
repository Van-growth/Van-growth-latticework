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

    // ICP 인사이트(discovery_questions) — 공유 뷰엔 "소유자 본인이 생성한" 결과만, 그것도
    // 질문 리스트만 노출한다. ICP 원문(icp_product 등)은 절대 포함하지 않음(2026-08-15 결정,
    // 8/13 "ICP 원문까지 그대로 노출" 방침 번복 — 소유자 영업 정보 보호 목적). icp_insights엔
    // analysis_id당 여러 유저가 각자 자기 ICP로 생성한 행이 있을 수 있어(캐시 키가
    // analysis_id+icp_fingerprint일 뿐 유저 단위가 아님), created_by가 analyses.created_by와
    // 일치하는 행만 "소유자의 것"으로 취급 — 그 외엔 다른 로그인 유저의 결과를 소유자 이름으로
    // 잘못 노출하게 되므로 아예 스킵한다. created_by가 없는 옛 analysis(2026-07-16 이전
    // 생성분)는 소유자를 특정할 수 없어 이 섹션 자체를 노출하지 않는다.
    let icpDiscoveryQuestions: Array<{ question: string; section: string; sources: unknown }> | null = null;
    let icpOwnerLabel: string | null = null;
    if (row.created_by) {
      const [{ data: ownerInsight }, { data: ownerProfile }] = await Promise.all([
        supabase
          .from('icp_insights')
          .select('content, created_at')
          .eq('analysis_id', row.id)
          .eq('created_by', row.created_by)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('nickname')
          .eq('id', row.created_by)
          .maybeSingle(),
      ]);
      if (ownerInsight?.content?.questions?.length) {
        icpDiscoveryQuestions = ownerInsight.content.questions;
        icpOwnerLabel = ownerProfile?.nickname?.trim() || null;
      }
    }

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
      icpDiscoveryQuestions,
      icpOwnerLabel,
    });
  } catch (err) {
    console.error('[GET /api/share/:token]', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

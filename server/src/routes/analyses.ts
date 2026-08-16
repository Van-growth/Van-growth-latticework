import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { supabase } from '../lib/supabase';
import { refreshFinancials, Language } from '../lib/claude';
import { isPremiumUser } from '../lib/premium';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

type CompanyRef = { name: string } | null;

// GET /api/analyses — 로그인한 유저가 실제로 분석 요청한 기업만 반환.
// analyses/companies에는 소유자 컬럼이 없어(원래 전 유저 공용 캐시 설계)
// analysis_usage를 "내 히스토리" 소스로 사용한다.
// 검색/분석 실행 자체가 로그인 필수로 전환된 뒤에도 이 목록 라우트만 client_id
// 폴백으로 열려있어 비로그인 상태에서 과거(로그인 필수화 이전) 기록이 그대로
// 노출되던 문제가 있었음(2026-07-16 발견) — 다른 라우트와 동일하게 하드 401로 통일.
router.get('/', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }
  const userId = authUser.id;

  try {
    const { data: usageRows, error: usageErr } = await supabase
      .from('analysis_usage')
      .select('analysis_target, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (usageErr) throw usageErr;

    // 회사명 중복 제거 — 이미 내림차순이라 첫 등장이 이 유저의 가장 최근 요청.
    const seen = new Set<string>();
    const orderedNames: string[] = [];
    for (const row of usageRows ?? []) {
      if (seen.has(row.analysis_target)) continue;
      seen.add(row.analysis_target);
      orderedNames.push(row.analysis_target);
    }
    if (orderedNames.length === 0) {
      res.json([]);
      return;
    }

    const { data, error } = await supabase
      .from('analyses')
      .select('id, summary, created_at, companies!inner(name)')
      .in('companies.name', orderedNames)
      .order('created_at', { ascending: false });
    if (error) throw error;

    // 같은 회사가 여러 번 재분석됐을 수 있음 — 회사당 최신 analyses 행만 사용
    // (data는 이미 created_at desc이므로 첫 등장이 최신).
    const byCompany = new Map<string, { id: string; summary: string; created_at: string }>();
    for (const row of data ?? []) {
      const name = (row.companies as unknown as CompanyRef)?.name;
      if (!name || byCompany.has(name)) continue;
      byCompany.set(name, { id: row.id, summary: row.summary, created_at: row.created_at });
    }

    const items = orderedNames
      .map(name => {
        const match = byCompany.get(name);
        return match ? { id: match.id, companyName: name, summary: match.summary, createdAt: match.created_at } : null;
      })
      .filter((x): x is { id: string; companyName: string; summary: string; createdAt: string } => x !== null)
      .slice(0, 50);

    // 즐겨찾기 여부 — 히스토리 페이지가 이 하나의 응답을 즐겨찾기/최근조회 두 섹션으로
    // 클라이언트에서 나눠 렌더링한다(별도 엔드포인트 없음, analysis_favorites 참고).
    const { data: favRows, error: favErr } = await supabase
      .from('analysis_favorites')
      .select('analysis_id')
      .eq('user_id', userId);
    if (favErr) throw favErr;
    const favoriteIds = new Set((favRows ?? []).map(r => r.analysis_id));

    res.json(items.map(item => ({ ...item, isFavorited: favoriteIds.has(item.id) })));
  } catch (err) {
    console.error('[GET /api/analyses]', err);
    res.status(500).json({ error: '목록을 불러오지 못했습니다.' });
  }
});

// GET /api/analyses/:id  — full detail
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const clientId = (req.headers['x-client-id'] as string | undefined)?.trim() || null;
  const authUser = await resolveAuthUser(req);
  const isPremium = await isPremiumUser({ clientId, authUserId: authUser?.id ?? null });

  try {
    const [analysisRes, playersRes] = await Promise.all([
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
    ]);

    if (analysisRes.error) throw analysisRes.error;
    if (!analysisRes.data) {
      res.status(404).json({ error: '분석 결과를 찾을 수 없습니다.' });
      return;
    }

    // 즐겨찾기 여부 — 비로그인이면 항상 false(개인화 상태라 authUser 없이는 판정 불가)
    let isFavorited = false;
    if (authUser) {
      const { data: favRow } = await supabase
        .from('analysis_favorites')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('analysis_id', id)
        .maybeSingle();
      isFavorited = !!favRow;
    }

    const row = analysisRes.data;
    res.json({
      id: row.id,
      companyName: (row.companies as unknown as CompanyRef)?.name ?? '',
      language: row.language ?? 'en',
      isFavorited,
      // Legacy fields
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
      is_shared: row.is_shared ?? false,
      share_token: row.share_token ?? null,
      valuechainPlayers: playersRes.data ?? [],
      // V2 fields
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
    console.error('[GET /api/analyses/:id]', err);
    res.status(500).json({ error: '상세 정보를 불러오지 못했습니다.' });
  }
});

// 공개 링크 on/off는 생성자 본인만 — analyses.created_by가 채워진 행(2026-07-16 이후
// 생성분)에서만 소유권을 강제한다. created_by가 NULL인 기존 행(생성자 미기록, 공용 캐시
// 시절 유산)은 예외적으로 로그인 유저 누구나 허용 — 소급 차단은 하지 않는다.
async function assertShareOwner(id: string, authUserId: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase.from('analyses').select('created_by').eq('id', id).maybeSingle();
  if (error) return { ok: false, status: 500, error: '분석 조회 중 오류가 발생했습니다.' };
  if (!data) return { ok: false, status: 404, error: '분석을 찾을 수 없습니다.' };
  if (data.created_by && data.created_by !== authUserId) {
    return { ok: false, status: 403, error: '본인이 생성한 분석만 공유 설정을 변경할 수 있습니다.' };
  }
  return { ok: true };
}

// POST /api/analyses/:id/share  — create / refresh share link
router.post('/:id/share', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const ownerCheck = await assertShareOwner(String(id), authUser.id);
    if (!ownerCheck.ok) {
      res.status(ownerCheck.status).json({ error: ownerCheck.error });
      return;
    }

    const token = randomBytes(6).toString('base64url');
    const { data, error } = await supabase
      .from('analyses')
      .update({ share_token: token, is_shared: true, shared_at: new Date().toISOString() })
      .eq('id', id)
      .select('share_token')
      .single();

    if (error) throw error;
    res.json({ share_token: data.share_token });
  } catch (err) {
    console.error('[POST /api/analyses/:id/share]', err);
    res.status(500).json({ error: '공유 링크 생성에 실패했습니다.' });
  }
});

// DELETE /api/analyses/:id/share  — revoke share
router.delete('/:id/share', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const ownerCheck = await assertShareOwner(String(id), authUser.id);
    if (!ownerCheck.ok) {
      res.status(ownerCheck.status).json({ error: ownerCheck.error });
      return;
    }

    const { error } = await supabase
      .from('analyses')
      .update({ share_token: null, is_shared: false, shared_at: null })
      .eq('id', id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/analyses/:id/share]', err);
    res.status(500).json({ error: '공유 해제에 실패했습니다.' });
  }
});

// POST /api/analyses/:id/refresh-financials
// 하드 401만 적용, 소유권(403) 체크는 없음 — reanalyze와 동일하게 공용 캐시된 재무
// 데이터를 로그인 유저 누구나 새로고침할 수 있는 협업성 기능으로 유지(실전 발견 이력
// 16번 참고, 사용자가 명시적으로 이 동작 선택).
router.post('/:id/refresh-financials', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const { data: analysis, error } = await supabase
      .from('analyses')
      .select('companies(name), language')
      .eq('id', id)
      .single();

    if (error || !analysis) {
      res.status(404).json({ error: '분석을 찾을 수 없습니다.' });
      return;
    }

    const companyName = (analysis.companies as unknown as CompanyRef)?.name;
    if (!companyName) {
      res.status(400).json({ error: '기업명을 찾을 수 없습니다.' });
      return;
    }
    // 이 행이 어느 언어로 생성됐는지는 DB에서 직접 읽는다(언어 정책 SSOT 참고).
    const language: Language = (analysis as any).language === 'ko' ? 'ko' : 'en';

    const financials_v2 = await refreshFinancials(companyName, language);

    await supabase
      .from('analyses')
      .update({ financials_v2 })
      .eq('id', id);

    res.json({ financials_v2 });
  } catch (err) {
    console.error('[POST /api/analyses/:id/refresh-financials]', err);
    res.status(500).json({ error: '재무 데이터 새로고침에 실패했습니다.' });
  }
});

// POST /api/analyses/:id/favorite — 즐겨찾기 추가. share/refresh-financials와 달리
// 이 액션은 공용 캐시 갱신이 아니라 유저 개인화 상태라 소유권(created_by) 체크 없이도
// 하드 401만으로 충분 — 로그인한 유저라면 본인이 조회한 어떤 분석이든 즐겨찾기할 수 있다.
router.post('/:id/favorite', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const { error } = await supabase
      .from('analysis_favorites')
      .upsert({ user_id: authUser.id, analysis_id: id }, { onConflict: 'user_id,analysis_id' });
    if (error) throw error;
    res.json({ isFavorited: true });
  } catch (err) {
    console.error('[POST /api/analyses/:id/favorite]', err);
    res.status(500).json({ error: '즐겨찾기 추가에 실패했습니다.' });
  }
});

// DELETE /api/analyses/:id/favorite — 즐겨찾기 해제
router.delete('/:id/favorite', async (req: Request, res: Response) => {
  const { id } = req.params;
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const { error } = await supabase
      .from('analysis_favorites')
      .delete()
      .eq('user_id', authUser.id)
      .eq('analysis_id', id);
    if (error) throw error;
    res.json({ isFavorited: false });
  } catch (err) {
    console.error('[DELETE /api/analyses/:id/favorite]', err);
    res.status(500).json({ error: '즐겨찾기 해제에 실패했습니다.' });
  }
});

export default router;

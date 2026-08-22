// 관리자 유저 대시보드 — profiles.role='admin'만 통과(resolveAdminUser, 401/403 구분).
// GET /users·/users/stats는 조회 전용, PATCH /users/:id는 allow_private_search 토글
// 하나만 다룬다(다른 프로필 필드는 이 대시보드의 편집 대상이 아님).
//
// POST /insights/ask(2026-08-22 재설계) — 개별 유저별 Ben 채팅(구 POST /users/:id/ask +
// AdminBenPanel)은 폐기하고, 기존에 이미 떠 있는 Ben 런처(BenLauncher/BenPanel/
// useBenChat)가 /admin 경로에 있을 때 컨텍스트만 "전체 유저 집계"로 바꿔 쓰도록 전환 —
// 새 채팅 UI를 만들지 않는다는 원칙 유지. routes/ben.ts의 streamBenReply()를 그대로
// 재사용, 대화는 저장하지 않는다(휘발성, 기존 결정 유지).
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase';
import { resolveAdminUser } from '../lib/admin';
import { streamBenReply, BenMessage } from './ben';
import { benAdminAggregateSystem, buildBenAdminAggregateContext } from '../lib/benContext';

const router = Router();

const USER_LIST_FIELDS =
  'id, email, created_at, company_name, org_size, industry, job_role, job_level, region, purpose, purpose_other, is_premium_override, allow_private_search';

type PeriodKey = 'week' | 'month' | 'quarter' | 'half' | 'year';
const PERIOD_KEYS: PeriodKey[] = ['week', 'month', 'quarter', 'half', 'year'];

function bucketKey(date: Date, period: PeriodKey): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-indexed
  switch (period) {
    case 'week': {
      const weekStart = new Date(Date.UTC(y, m, date.getUTCDate() - date.getUTCDay()));
      return weekStart.toISOString().slice(0, 10);
    }
    case 'quarter':
      return `${y}-Q${Math.floor(m / 3) + 1}`;
    case 'half':
      return `${y}-H${m < 6 ? 1 : 2}`;
    case 'year':
      return `${y}`;
    case 'month':
    default:
      return `${y}-${String(m + 1).padStart(2, '0')}`;
  }
}

// GET /api/admin/users — 필터 가능한 유저 목록(플랜/목적/가입월/비상장검색허용/이메일검색).
router.get('/users', async (req: Request, res: Response) => {
  const gate = await resolveAdminUser(req);
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  const plan = typeof req.query.plan === 'string' ? req.query.plan : undefined;
  const purpose = typeof req.query.purpose === 'string' ? req.query.purpose : undefined;
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  const privateSearch = typeof req.query.privateSearch === 'string' ? req.query.privateSearch : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;

  try {
    let query = supabase.from('profiles').select(USER_LIST_FIELDS).order('created_at', { ascending: false });

    if (plan === 'premium') query = query.eq('is_premium_override', true);
    else if (plan === 'free') query = query.eq('is_premium_override', false);

    if (purpose) query = query.contains('purpose', [purpose]);

    if (privateSearch === 'on') query = query.eq('allow_private_search', true);
    else if (privateSearch === 'off') query = query.eq('allow_private_search', false);

    if (search) query = query.ilike('email', `%${search}%`);

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
      const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString();
      query = query.gte('created_at', start).lt('created_at', end);
    }

    const { data: profiles, error } = await query;
    if (error) throw error;

    const ids = (profiles ?? []).map(p => p.id);
    if (!ids.length) {
      res.json({ users: [] });
      return;
    }

    const [loginStatsRes, usageRes] = await Promise.all([
      supabase.from('admin_user_login_stats').select('id, last_sign_in_at').in('id', ids),
      // is_cache_view=false만 — analysisCount와 정의를 통일한다(둘 다 "실제 신규/재분석
      // 시도" 기준, 단순 캐시 재조회는 제외). MAX(created_at)을 뽑을 별도 집계 쿼리가
      // 없어 행을 그대로 가져와 아래에서 유저별로 reduce — analysis_usage는 요청 단위
      // append-only 로그라 다른 방법이 없어도 이 정도 규모에선 문제 없음(analysisCount
      // 계산도 이미 동일한 방식).
      supabase.from('analysis_usage').select('user_id, created_at').eq('is_cache_view', false).in('user_id', ids),
    ]);
    if (loginStatsRes.error) throw loginStatsRes.error;
    if (usageRes.error) throw usageRes.error;

    const lastLoginById = new Map<string, string | null>(
      (loginStatsRes.data ?? []).map(r => [r.id as string, r.last_sign_in_at as string | null]),
    );
    const countById = new Map<string, number>();
    const lastAnalysisById = new Map<string, string>();
    for (const row of usageRes.data ?? []) {
      const uid = row.user_id as string;
      const createdAt = row.created_at as string;
      countById.set(uid, (countById.get(uid) ?? 0) + 1);
      const prevMax = lastAnalysisById.get(uid);
      if (!prevMax || createdAt > prevMax) lastAnalysisById.set(uid, createdAt);
    }

    const users = (profiles ?? []).map(p => ({
      id: p.id,
      email: p.email,
      createdAt: p.created_at,
      lastSignInAt: lastLoginById.get(p.id) ?? null,
      lastAnalysisAt: lastAnalysisById.get(p.id) ?? null,
      companyName: p.company_name,
      orgSize: p.org_size,
      industry: p.industry,
      jobRole: p.job_role,
      jobLevel: p.job_level,
      region: p.region,
      purpose: p.purpose ?? [],
      purposeOther: p.purpose_other,
      isPremium: !!p.is_premium_override,
      allowPrivateSearch: !!p.allow_private_search,
      analysisCount: countById.get(p.id) ?? 0,
    }));

    res.json({ users });
  } catch (err) {
    console.error('[admin] GET /users FAIL', err);
    res.status(500).json({ error: '유저 목록 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/users/stats — 상단 통계 카드 + 도넛(플랜/목적) + 가입 추세.
router.get('/users/stats', async (req: Request, res: Response) => {
  const gate = await resolveAdminUser(req);
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'month';
  const period: PeriodKey = PERIOD_KEYS.includes(rawPeriod as PeriodKey) ? (rawPeriod as PeriodKey) : 'month';

  try {
    const [profilesRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('id, created_at, is_premium_override, allow_private_search, purpose'),
      // 분석 0회 판정용 — GET /users의 analysisCount/lastAnalysisAt과 동일 기준
      // (is_cache_view=false 행이 하나도 없으면 "0회"). 존재 여부만 필요하므로 user_id만.
      supabase.from('analysis_usage').select('user_id').eq('is_cache_view', false),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (usageRes.error) throw usageRes.error;

    const rows = profilesRes.data ?? [];
    const total = rows.length;
    const premiumCount = rows.filter(r => r.is_premium_override).length;
    const privateSearchCount = rows.filter(r => r.allow_private_search).length;

    const usersWithAnalysis = new Set((usageRes.data ?? []).map(r => r.user_id as string));
    const zeroAnalysisCount = rows.filter(r => !usersWithAnalysis.has(r.id)).length;
    const zeroAnalysisRate = total > 0 ? zeroAnalysisCount / total : 0;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const newThisMonth = rows.filter(r => r.created_at && new Date(r.created_at) >= monthStart).length;

    const purposeCounts = new Map<string, number>();
    for (const r of rows) {
      for (const p of (r.purpose as string[] | null) ?? []) {
        purposeCounts.set(p, (purposeCounts.get(p) ?? 0) + 1);
      }
    }

    const trendMap = new Map<string, number>();
    for (const r of rows) {
      if (!r.created_at) continue;
      const key = bucketKey(new Date(r.created_at), period);
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, count]) => ({ bucket, count }));

    res.json({
      total,
      premiumCount,
      freeCount: total - premiumCount,
      privateSearchCount,
      newThisMonth,
      zeroAnalysisCount,
      zeroAnalysisRate,
      purposeCounts: Object.fromEntries(purposeCounts),
      trend,
      period,
    });
  } catch (err) {
    console.error('[admin] GET /users/stats FAIL', err);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/admin/users/:id — allow_private_search 토글만 다룬다.
router.patch('/users/:id', async (req: Request, res: Response) => {
  const gate = await resolveAdminUser(req);
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  const targetId = String(req.params.id ?? '').trim();
  const { allow_private_search } = req.body as { allow_private_search?: unknown };
  if (typeof allow_private_search !== 'boolean') {
    res.status(400).json({ error: 'allow_private_search(boolean)가 필요합니다.' });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ allow_private_search })
      .eq('id', targetId)
      .select('id, allow_private_search')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
      return;
    }
    res.json({ id: data.id, allowPrivateSearch: data.allow_private_search });
  } catch (err) {
    console.error('[admin] PATCH /users/:id FAIL', err);
    res.status(500).json({ error: '업데이트 중 오류가 발생했습니다.' });
  }
});

// POST /api/admin/insights/ask — /admin 경로에 있을 때 Ben 런처가 붙는 엔드포인트.
// 개인정보(이메일 등) 없이 전체 유저 집계만 컨텍스트로 스트리밍 응답. ben_conversations에
// 저장하지 않음(휘발성) — 클라이언트가 지금까지의 턴을 매 요청마다 priorMessages로
// 그대로 실어보낸다(analysis Ben과의 유일한 프로토콜 차이 — 그쪽은 서버가 DB에서
// 히스토리를 복원한다).
router.post('/insights/ask', async (req: Request, res: Response) => {
  const gate = await resolveAdminUser(req);
  if (!gate.ok) {
    res.status(gate.status).json({ error: gate.error });
    return;
  }

  const { message, priorMessages: rawPriorMessages } = req.body as { message?: string; priorMessages?: BenMessage[] };
  if (!message?.trim()) {
    res.status(400).json({ error: 'message가 필요합니다.' });
    return;
  }
  const userMessage = message.trim();
  const priorMessages: BenMessage[] = Array.isArray(rawPriorMessages) ? rawPriorMessages : [];

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
    // GET /users/stats처럼 전 행을 가져와 JS에서 reduce — 이 규모(초기 단계 유저 수)에선
    // 문제없고, 이미 이 파일의 다른 라우트가 쓰는 것과 동일한 패턴이라 별도 집계 쿼리/뷰를
    // 새로 만들지 않는다.
    const [profilesRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('id, created_at, is_premium_override, purpose, industry, org_size'),
      supabase.from('analysis_usage').select('user_id, analysis_target, is_cache_view'),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (usageRes.error) throw usageRes.error;

    const contextText = buildBenAdminAggregateContext(profilesRes.data ?? [], usageRes.data ?? []);

    await streamBenReply({
      res,
      staticSystemText: benAdminAggregateSystem(),
      contextText,
      priorMessages,
      userMessage,
      cacheLogLabel: 'ben-admin-insights',
    });

    send('done', {});
    res.end();
  } catch (err) {
    console.error('[admin] POST /insights/ask FAIL', err);
    const reason = err instanceof Anthropic.APIError ? 'upstream' : 'server';
    send('error', { reason });
    res.end();
  }
});

export default router;

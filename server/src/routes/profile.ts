// 구글 가입 온보딩 설문 + 설정 페이지에서 쓰는 프로필 조회/수정 라우트.
// 반드시 로그인 필요 — Authorization: Bearer <access_token>으로 auth user를 검증하고
// profiles.id(=auth.users.id) 행만 조회/수정한다(RLS는 서비스롤로 우회하므로 여기서 직접 소유자 체크).
//
// 선택형 값은 전부 언어중립 영문 소문자 코드(DB CHECK 제약과 동일) — 화면 표시 라벨 변환은
// 클라이언트의 client/src/lib/i18n/profileLabels.ts가 담당하고 서버는 코드 검증만 한다.
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

const ORG_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const INDUSTRIES = [
  'saas', 'manufacturing', 'biotech_healthcare', 'retail_commerce', 'finance',
  'media_content', 'hardware_semiconductor', 'energy', 'logistics_transport',
  'consumer_goods', 'real_estate_construction', 'other',
];
const JOB_ROLES = ['sales', 'bd', 'strategy', 'other'];
const JOB_LEVELS = ['junior', 'mid', 'senior', 'team_lead', 'executive'];
const PURPOSES = ['meeting_prep', 'partner_research', 'competitor_analysis', 'other'];

const PROFILE_FIELDS = 'company_name, org_size, industry, job_role, job_level, purpose, purpose_other, onboarding_completed_at';

router.get('/', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FIELDS)
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    console.error('[profile] GET 실패', { userId: authUser.id, message: error.message, code: error.code, details: error.details });
    res.status(500).json({ error: '프로필 조회 중 오류가 발생했습니다.' });
    return;
  }
  res.json(data ?? {});
});

router.patch('/', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { company_name, org_size, industry, job_role, job_level, purpose, purpose_other, completeOnboarding } = req.body as {
    company_name?: string | null;
    org_size?: string | null;
    industry?: string | null;
    job_role?: string | null;
    job_level?: string | null;
    purpose?: string[] | null;
    purpose_other?: string | null;
    completeOnboarding?: boolean;
  };

  if (org_size != null && !ORG_SIZES.includes(org_size)) {
    res.status(400).json({ error: `org_size는 ${ORG_SIZES.join('/')} 중 하나여야 합니다.` });
    return;
  }
  if (industry != null && !INDUSTRIES.includes(industry)) {
    res.status(400).json({ error: `industry는 ${INDUSTRIES.join('/')} 중 하나여야 합니다.` });
    return;
  }
  if (job_role != null && !JOB_ROLES.includes(job_role)) {
    res.status(400).json({ error: `job_role은 ${JOB_ROLES.join('/')} 중 하나여야 합니다.` });
    return;
  }
  if (job_level != null && !JOB_LEVELS.includes(job_level)) {
    res.status(400).json({ error: `job_level은 ${JOB_LEVELS.join('/')} 중 하나여야 합니다.` });
    return;
  }
  if (purpose != null && !purpose.every(p => PURPOSES.includes(p))) {
    res.status(400).json({ error: `purpose는 ${PURPOSES.join('/')} 중에서만 선택할 수 있습니다.` });
    return;
  }

  const fields: Record<string, unknown> = {};
  if (company_name !== undefined) fields.company_name = company_name;
  if (org_size !== undefined) fields.org_size = org_size;
  if (industry !== undefined) fields.industry = industry;
  if (job_role !== undefined) fields.job_role = job_role;
  if (job_level !== undefined) fields.job_level = job_level;
  if (purpose !== undefined) fields.purpose = purpose;
  if (purpose_other !== undefined) fields.purpose_other = purpose_other;
  if (completeOnboarding) fields.onboarding_completed_at = new Date().toISOString();

  if (Object.keys(fields).length === 0) {
    res.status(400).json({ error: '변경할 값이 없습니다.' });
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(fields)
    .eq('id', authUser.id)
    .select(PROFILE_FIELDS)
    .maybeSingle();

  if (error) {
    console.error('[profile] PATCH 실패', { userId: authUser.id, fields: Object.keys(fields), message: error.message, code: error.code, details: error.details });
    res.status(500).json({ error: '프로필 저장 중 오류가 발생했습니다.' });
    return;
  }
  res.json(data);
});

export default router;

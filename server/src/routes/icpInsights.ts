// ICP 인사이트 평가(별점/코멘트) — 생성 자체는 /api/analyze/:id/icp-insight(analyze.ts)가
// 담당하고, 이 라우터는 이미 생성된 icp_insights 행 하나에 대한 피드백 저장만 다룬다.
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

// POST /api/icp-insights/:id/rate — rating(1~5, nullable)/rating_comment(nullable) 저장.
// 둘 중 하나만 와도 저장(예: 코멘트만 남기고 별점은 비워두는 경우).
router.post('/:id/rate', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const id = String(req.params.id ?? '').trim();
  const { rating, rating_comment } = req.body as { rating?: number | null; rating_comment?: string | null };

  if (rating === undefined && rating_comment === undefined) {
    res.status(400).json({ error: 'rating 또는 rating_comment 중 하나는 필요합니다.' });
    return;
  }
  if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    res.status(400).json({ error: 'rating은 1~5 사이의 정수여야 합니다.' });
    return;
  }

  const fields: Record<string, unknown> = {};
  if (rating !== undefined) fields.rating = rating;
  if (rating_comment !== undefined) fields.rating_comment = rating_comment;

  const { data, error } = await supabase
    .from('icp_insights')
    .update(fields)
    .eq('id', id)
    .select('id, rating, rating_comment')
    .maybeSingle();

  if (error) {
    console.error('[icp-insights] rate 실패', { id, message: error.message });
    res.status(500).json({ error: '평가 저장 중 오류가 발생했습니다.' });
    return;
  }
  if (!data) {
    res.status(404).json({ error: '해당 인사이트를 찾을 수 없습니다.' });
    return;
  }
  res.json(data);
});

export default router;

import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

type CompanyRef = { name: string } | null;

const MIN_QUERY_LEN = 2;
const MAX_RESULTS = 8;

// GET /api/companies/autocomplete?q=검색어
// 이미 분석된(=캐시가 있는) 기업만 제안 — companies!inner(analyses)로 분석 없는 기업 제외.
// 같은 기업에 재분석 이력이 여러 건 있을 수 있어(analyses 1:N) 최신 것만 남기고 중복 제거.
router.get('/autocomplete', async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? '';
  if (q.length < MIN_QUERY_LEN) {
    res.json({ results: [] });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('analyses')
      .select('id, created_at, companies!inner(name)')
      .ilike('companies.name', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const seen = new Set<string>();
    const results: { analysisId: string; name: string; lastAnalyzedAt: string }[] = [];
    for (const row of data ?? []) {
      const name = (row.companies as unknown as CompanyRef)?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      results.push({ analysisId: row.id, name, lastAnalyzedAt: row.created_at });
      if (results.length >= MAX_RESULTS) break;
    }

    res.json({ results });
  } catch (err) {
    console.error('[GET /api/companies/autocomplete]', err);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

export default router;

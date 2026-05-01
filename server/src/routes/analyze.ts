import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { analyzeCompany } from '../lib/claude';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { companyName } = req.body as { companyName?: string };

    if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
      res.status(400).json({ error: '기업명을 입력해주세요.' });
      return;
    }

    const name = companyName.trim();

    // Upsert company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();

    if (companyError) {
      console.error('Company upsert error:', companyError);
      res.status(500).json({ error: 'DB 오류가 발생했습니다.' });
      return;
    }

    // Run analysis
    const content = await analyzeCompany(name);

    // Save analysis
    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .insert({ company_id: company.id, content })
      .select('id, content, created_at')
      .single();

    if (analysisError) {
      console.error('Analysis insert error:', analysisError);
      res.status(500).json({ error: 'DB 저장 오류가 발생했습니다.' });
      return;
    }

    res.json({
      companyName: name,
      analysisId: analysis.id,
      content: analysis.content,
      createdAt: analysis.created_at,
    });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.' });
  }
});

export default router;

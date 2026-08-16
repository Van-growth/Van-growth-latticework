// "Ben" — 분석 결과 화면 우측 패널의 채팅 어시스턴트. ICP Insights(discovery questions 큐레이션)
// 탭을 대체한다 — 정해진 질문 세트를 미리 뽑아 보여주는 대신, 유저가 그때그때 궁금한 걸
// 자유롭게 물어보는 채팅형. 대화는 분석당 1개만 저장한다(Harry의 여러 컨텍스트 관리와 달리
// Ben의 컨텍스트는 항상 "이 분석 하나"라 멀티스레드 히스토리가 필요 없음).
//
// 인증: 다른 Claude 호출 라우트와 동일하게 로그인 필수(resolveAuthUser 하드 401) — 죽은
// /api/chat 라우트(구 AiAssistantPanel.tsx)가 쓰던 "인증 없는 Next.js API route + 클라이언트
// 노출 키" 패턴은 되살리지 않는다.
import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase';
import { resolveAuthUser } from '../lib/authUser';
import { checkBenUsage, recordBenUsage, BEN_DAILY_LIMIT } from '../lib/benUsage';
import { anthropic, Language } from '../lib/claude';
import { benStaticSystem, buildBenAnalysisContext, BenAnalysisRow } from '../lib/benContext';

const router = Router();

interface BenMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

type CompanyRef = { name: string } | null;

// GET /api/analyses/:id/ask — 패널 오픈 시 기존 대화 복원
router.get('/:id/ask', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const analysisId = String(req.params.id ?? '').trim();
  if (!analysisId) {
    res.status(400).json({ error: 'analysisId가 필요합니다.' });
    return;
  }

  const { data, error } = await supabase
    .from('ben_conversations')
    .select('messages')
    .eq('analysis_id', analysisId)
    .eq('user_id', authUser.id)
    .maybeSingle();
  if (error) {
    console.error('[ben] GET /:id/ask FAIL', error);
    res.status(500).json({ error: '대화를 불러오지 못했습니다.' });
    return;
  }

  res.json({ messages: (data?.messages as BenMessage[] | undefined) ?? [] });
});

// DELETE /api/analyses/:id/ask — 초기화 버튼
router.delete('/:id/ask', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const analysisId = String(req.params.id ?? '').trim();
  if (!analysisId) {
    res.status(400).json({ error: 'analysisId가 필요합니다.' });
    return;
  }

  const { error } = await supabase
    .from('ben_conversations')
    .delete()
    .eq('analysis_id', analysisId)
    .eq('user_id', authUser.id);
  if (error) {
    console.error('[ben] DELETE /:id/ask FAIL', error);
    res.status(500).json({ error: '대화 초기화에 실패했습니다.' });
    return;
  }

  res.json({ ok: true });
});

// POST /api/analyses/:id/ask — SSE 스트리밍 채팅 한 턴. body: { message: string }
// 서버가 히스토리를 들고 있으므로 클라이언트는 새 유저 발화만 보낸다.
router.post('/:id/ask', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const analysisId = String(req.params.id ?? '').trim();
  const { message } = req.body as { message?: string };
  if (!analysisId || !message?.trim()) {
    res.status(400).json({ error: 'message가 필요합니다.' });
    return;
  }
  const userMessage = message.trim();

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
    const usage = await checkBenUsage(authUser.id);
    if (!usage.allowed) {
      send('rate_limited', { usedCount: usage.usedCount, limit: BEN_DAILY_LIMIT, nextAvailableAt: usage.nextAvailableAt });
      res.end();
      return;
    }

    const { data: analysis, error: fetchErr } = await supabase
      .from('analyses')
      .select('companies(name), language, purpose_category, purpose_detail, summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, strategy_v2, financials_v2, founder_v2')
      .eq('id', analysisId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!analysis) {
      send('error', { reason: 'not_found' });
      res.end();
      return;
    }

    const companyName = (analysis.companies as unknown as CompanyRef)?.name ?? '';
    const language: Language = analysis.language === 'ko' ? 'ko' : 'en';

    const { data: existing } = await supabase
      .from('ben_conversations')
      .select('messages')
      .eq('analysis_id', analysisId)
      .eq('user_id', authUser.id)
      .maybeSingle();
    const priorMessages = (existing?.messages as BenMessage[] | undefined) ?? [];

    const analysisContext = buildBenAnalysisContext(companyName, analysis as unknown as BenAnalysisRow);

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      system: [
        { type: 'text' as const, text: benStaticSystem(language), cache_control: { type: 'ephemeral' as const } },
        { type: 'text' as const, text: analysisContext, cache_control: { type: 'ephemeral' as const } },
      ],
      messages: [
        ...priorMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ],
    });

    stream.on('text', (delta: string) => {
      send('token', { text: delta });
    });

    const finalMessage = await stream.finalMessage();
    console.log(`[cache-stats][ben] input=${finalMessage.usage.input_tokens} cache_read=${finalMessage.usage.cache_read_input_tokens ?? 0} cache_write=${finalMessage.usage.cache_creation_input_tokens ?? 0}`);

    const assistantText = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map(b => b.text)
      .join('');

    const now = new Date().toISOString();
    const nextMessages: BenMessage[] = [
      ...priorMessages,
      { role: 'user', content: userMessage, created_at: now },
      ...(assistantText ? [{ role: 'assistant' as const, content: assistantText, created_at: now }] : []),
    ];

    const { error: upsertErr } = await supabase
      .from('ben_conversations')
      .upsert(
        { analysis_id: analysisId, user_id: authUser.id, messages: nextMessages, updated_at: now },
        { onConflict: 'analysis_id,user_id' },
      );
    if (upsertErr) console.error('[ben] conversation upsert FAIL', upsertErr);

    await recordBenUsage(authUser.id, analysisId);

    send('done', {});
    res.end();
  } catch (err) {
    console.error('[ben] POST /:id/ask FAIL', err);
    // 응답 바디 자체에 원인 카테고리를 남긴다 — 브라우저 Network 탭만으로도(서버 로그
    // 없이) 왜 실패했는지 구분 가능하게(2026-08-16, "200인데 왜 에러냐" 제보 계기).
    // 원본 메시지는 그대로 노출하지 않음 — 카테고리만.
    const reason = err instanceof Anthropic.APIError ? 'upstream' : 'server';
    send('error', { reason });
    res.end();
  }
});

export default router;

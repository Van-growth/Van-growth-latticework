import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { resolveAuthUser } from '../lib/authUser';
import { recordAnalysisUsage } from '../lib/analysisUsage';
import { isAdminUser } from '../lib/admin';

const router = Router();

const MIN_QUERY_LEN = 2;
const MAX_RESULTS = 8;

type Listing = { source: 'EDGAR' | 'DART'; identifier: string; ticker: string | null };
type TypeaheadResult = { name: string; listings: Listing[]; companyId?: string };

// GET /api/companies/typeahead?q=검색어
// corp_master(DART) + cik_master(EDGAR) 전체를 그때그때 직접 조회(지연 생성 —
// companies/company_listings는 유저가 실제로 클릭할 때만 생성됨, resolve 참고).
// company_dual_listings_manual에 등록된 다중상장 회사는 한 항목으로 병합해서 반환.
router.get('/typeahead', async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? '';
  if (q.length < MIN_QUERY_LEN) {
    res.json({ results: [] });
    return;
  }

  try {
    const [dartRes, edgarRes] = await Promise.all([
      supabase
        .from('corp_master')
        .select('corp_code, corp_name, stock_code')
        .ilike('corp_name', `%${q}%`)
        .order('corp_name')
        .limit(MAX_RESULTS),
      supabase
        .from('cik_master')
        .select('cik, name, ticker')
        .or(`name.ilike.%${q}%,ticker.ilike.%${q}%`)
        .order('name')
        .limit(MAX_RESULTS),
    ]);
    if (dartRes.error) throw dartRes.error;
    if (edgarRes.error) throw edgarRes.error;

    const dartRows = dartRes.data ?? [];
    const edgarRows = edgarRes.data ?? [];

    const dualRes = await supabase
      .from('company_dual_listings_manual')
      .select('dart_corp_code, edgar_cik')
      .or(
        [
          dartRows.length ? `dart_corp_code.in.(${dartRows.map(r => r.corp_code).join(',')})` : null,
          edgarRows.length ? `edgar_cik.in.(${edgarRows.map(r => r.cik).join(',')})` : null,
        ].filter(Boolean).join(','),
      );
    const dualPairs = dualRes.data ?? [];

    const edgarByCik = new Map(edgarRows.map(r => [r.cik, r]));
    const consumedDart = new Set<string>();
    const consumedEdgar = new Set<string>();
    const results: TypeaheadResult[] = [];

    // 다중상장 병합 — DART 후보 기준으로 매칭되는 EDGAR 파트너를 찾아 한 항목으로.
    // EDGAR 파트너가 이번 cik_master 검색 결과에 없으면(다른 언어라 검색어로는 안 걸림)
    // cik로 직접 조회해서라도 붙인다 — 다중상장 배지는 검색어와 무관하게 항상 보여야 함.
    for (const d of dartRows) {
      const pair = dualPairs.find(p => p.dart_corp_code === d.corp_code);
      if (!pair) continue;
      let edgarRow = edgarByCik.get(pair.edgar_cik);
      if (!edgarRow) {
        const { data } = await supabase
          .from('cik_master').select('cik, name, ticker')
          .eq('cik', pair.edgar_cik).maybeSingle();
        edgarRow = data ?? undefined;
      }
      if (!edgarRow) continue;
      consumedDart.add(d.corp_code);
      consumedEdgar.add(edgarRow.cik);
      results.push({
        name: d.corp_name,
        listings: [
          { source: 'DART', identifier: d.corp_code, ticker: d.stock_code },
          { source: 'EDGAR', identifier: edgarRow.cik, ticker: edgarRow.ticker },
        ],
      });
    }

    for (const d of dartRows) {
      if (consumedDart.has(d.corp_code)) continue;
      results.push({ name: d.corp_name, listings: [{ source: 'DART', identifier: d.corp_code, ticker: d.stock_code }] });
    }
    for (const e of edgarRows) {
      if (consumedEdgar.has(e.cik)) continue;
      results.push({ name: e.name, listings: [{ source: 'EDGAR', identifier: e.cik, ticker: e.ticker }] });
    }

    const capped = results.slice(0, MAX_RESULTS);

    // 이미 클릭된 적 있는 회사면(companies에 이미 존재) company_id를 같이 내려줘서
    // resolve 단계에서 중복 생성 없이 바로 재사용할 수 있게 한다.
    if (capped.length > 0) {
      const names = capped.map(r => r.name);
      const { data: existing } = await supabase.from('companies').select('id, name').in('name', names);
      const idByName = new Map((existing ?? []).map(c => [c.name, c.id]));
      capped.forEach(r => {
        const id = idByName.get(r.name);
        if (id) r.companyId = id;
      });
    }

    res.json({ results: capped });
  } catch (err) {
    console.error('[GET /api/companies/typeahead]', err);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// POST /api/companies/resolve
// typeahead에서 클릭한 항목을 companies/company_listings에 upsert(지연 생성)하고
// 이 회사의 기존 분석 캐시 유무를 함께 반환 — 프론트는 이 응답 하나로만 조건부 렌더링한다.
router.post('/resolve', async (req: Request, res: Response) => {
  // /api/analyze/stream과 동일한 로그인 게이트 — 캐시 조회든 신규 분석 시작이든
  // 이 엔드포인트를 거쳐야 하므로 여기서 막지 않으면 로그인 없이 전체 분석 결과를
  // 열람할 수 있게 된다(2026-07-16 발견, 실전 발견 이력 참고).
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { name, listings } = req.body as { name?: string; listings?: Listing[] };
  if (!name?.trim()) {
    res.status(400).json({ error: '기업명이 필요합니다.' });
    return;
  }

  // listings가 없으면 typeahead(DART/EDGAR) 매칭 없이 자유 입력한 회사(비상장사 등)라는
  // 뜻 — 정상 typeahead 결과는 항상 listing이 1개 이상 딸려온다. 이 경로는 회사명 중복
  // 생성 위험이 있어(같은 회사도 표기가 다르면 별도 행) 관리자 계정에서만 허용한다.
  if (!listings?.length && !isAdminUser(authUser.id)) {
    res.status(403).json({ error: '검색 목록에서 기업을 선택해주세요.' });
    return;
  }

  try {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name: name.trim() }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

    if (listings?.length) {
      const rows = listings
        .filter(l => l.source && l.identifier)
        .map(l => ({ company_id: company.id, source: l.source, identifier: l.identifier, ticker: l.ticker ?? null }));
      if (rows.length) {
        const { error: listingsErr } = await supabase
          .from('company_listings')
          .upsert(rows, { onConflict: 'source,identifier' });
        if (listingsErr) throw listingsErr;
      }
    }

    const { data: cached } = await supabase
      .from('analyses')
      .select('id, created_at')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 캐시 있음 = 이 유저가 이 회사를 조회했다는 히스토리 기록 — 무료 횟수(checkAnalysisUsage)는
    // 안 깎지만(isCacheView=true) GET /api/analyses(히스토리 목록)에는 나타나야 한다.
    if (cached) {
      await recordAnalysisUsage(authUser.id, name.trim(), true);
    }

    res.json({
      companyId: company.id,
      cached: !!cached,
      lastAnalyzedAt: cached?.created_at ?? null,
      analysisId: cached?.id ?? null,
    });
  } catch (err) {
    console.error('[POST /api/companies/resolve]', err);
    res.status(500).json({ error: '기업 정보를 확인하지 못했습니다.' });
  }
});

export default router;

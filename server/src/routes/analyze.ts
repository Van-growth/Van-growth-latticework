import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import {
  analyzeCompany, AnalysisData, AnalysisSources, FinancialsV2, SectionSource, reanalyzeSingleSection,
  generateGrowthScenarioNarrative, generateSecBenchmarkInterpretations,
  SecBenchmarkComparison, Language,
} from '../lib/claude';
import { fetchFinancialContext, CompanyListingRef } from '../lib/financialContext';
import { buildIncomeStatementRows, buildBalanceSheetRows, buildRevenueLines } from '../lib/financialsTableBuilder';
import { computeSecBenchmarkDeviations, SEC_BENCHMARK_SOURCE_URL } from '../lib/secIndustryBenchmark';
import {
  extractRevenueTimeSeries, calculateGrowthStats, runRevenueSimulation, getSectorBenchmarkStats,
} from '../services/monteCarloService';
import {
  extractLatestRatios, getIndustryBenchmark, getCompetitorRevenueRanking,
} from '../services/industryBenchmarkService';
import { isPremiumUser } from '../lib/premium';
import { isAdminUser } from '../lib/admin';
import { checkAnalysisUsage, recordAnalysisUsage } from '../lib/analysisUsage';
import { resolveAuthUser } from '../lib/authUser';

const router = Router();

// 분석 요청 시 입력받는 목적 카테고리 — analyses.purpose_category CHECK 제약과 동일한 값 셋.
const PURPOSE_CATEGORIES = ['ma', 'investment', 'partnership', 'customer', 'other'];

// company_id로 상장 정보 조회 — 다중상장 회사(EDGAR+DART 둘 다 있음)면
// fetchFinancialContext가 이름 휴리스틱 대신 이 identifier로 직접 조회한다.
async function fetchCompanyListings(companyId: string | undefined): Promise<CompanyListingRef[] | undefined> {
  if (!companyId) return undefined;
  const { data } = await supabase
    .from('company_listings')
    .select('source, identifier, ticker')
    .eq('company_id', companyId);
  return data?.length ? (data as CompanyListingRef[]) : undefined;
}

// ── 3차: 몬테카를로 성장 시나리오 (revenue_history 확보 시에만) ─────────────────

// 1순위: 상장사(EDGAR/DART) 자체 매출 시계열 — 신뢰도 high
function computeOwnGrowthScenario(rawEdgar: any, rawDart: any): Record<string, any> | null {
  const source: 'EDGAR' | 'DART' | null = rawDart ? 'DART' : rawEdgar ? 'EDGAR' : null;
  if (!source) return null;

  const series = extractRevenueTimeSeries(rawDart ?? rawEdgar, source);
  if (!series) return null;
  const stats = calculateGrowthStats(series);
  if (!stats) return null;

  const baseRevenue = series[series.length - 1].revenue;
  const simulation  = runRevenueSimulation({ baseRevenue, mean: stats.mean, stdDev: stats.stdDev });

  return { series, stats, simulation, currency: source === 'DART' ? 'KRW' : 'USD', source, confidenceLevel: 'high' as const };
}

// 2순위: 상장 정보/자체 시계열이 없는 기업 — sectorTag + baseRevenue(둘 다 필요) 기반
// 섹터 벤치마크 성장률로 시뮬레이션. 신뢰도 low. UI에서 업종 선택을 아직 안 붙였으므로
// 현재는 요청 body의 sectorTag/baseRevenue 파라미터로만 트리거된다.
async function computeSectorBenchmarkScenario(
  sectorTag: string | undefined,
  manualBaseRevenue: number | undefined,
): Promise<Record<string, any> | null> {
  if (!sectorTag || !manualBaseRevenue || manualBaseRevenue <= 0) return null;

  const benchmark = await getSectorBenchmarkStats(sectorTag);
  if (!benchmark) return null;

  const simulation = runRevenueSimulation({ baseRevenue: manualBaseRevenue, mean: benchmark.mean, stdDev: benchmark.stdDev });

  return {
    series: null,
    stats: benchmark,
    simulation,
    currency: 'USD',
    source: 'SECTOR_BENCHMARK' as const,
    sectorTag,
    confidenceLevel: 'low' as const,
  };
}

// 라우트 분기: 자체 시계열 우선, 없으면 섹터 벤치마크로 폴백. 둘 다 없으면 null(탭 데이터 없음).
// 시뮬레이션 결과가 나오면 Claude로 한줄 해석(narrative)을 붙인다 — 실패해도 시뮬레이션 자체는 반환.
async function computeGrowthScenario(
  companyName: string,
  rawEdgar: any,
  rawDart: any,
  sectorTag?: string,
  manualBaseRevenue?: number,
  language: Language = 'en',
): Promise<Record<string, any> | null> {
  const own = computeOwnGrowthScenario(rawEdgar, rawDart);
  const scenario = own ?? await computeSectorBenchmarkScenario(sectorTag, manualBaseRevenue);
  if (!scenario) return null;

  const narrative = await generateGrowthScenarioNarrative(companyName, scenario as any, language);
  return { ...scenario, narrative };
}

// ── EDGAR/SEC 출처 URL 서버 조립 (2026-08-12) ───────────────────────────────────
// Claude가 "SEC EDGAR"류 출처의 url을 스스로 지어내면(기억에서 재구성) 깨진 링크가
// 나올 수 있다는 게 실측으로 확인됨(예: SEC Financial Statement Data Sets URL —
// secIndustryBenchmark.ts 참고). "SEC EDGAR" 자체를 가리키는 일반 출처(특정 문서가
// 아니라 "이 회사의 EDGAR 공시 전반")는 회사 CIK만 있으면 항상 유효한 URL을 서버가
// 직접 조립할 수 있으므로, Claude가 뭐라고 썼든 이 URL로 덮어쓴다. organization이
// "SEC"/"EDGAR"를 언급하는 모든 섹션의 sources[]에 적용(회사 자체 공시를 인용하는
// 섹션이면 어디든 나올 수 있어 특정 섹션에 국한하지 않음).
const SEC_ORG_PATTERN = /\bsec\b|edgar/i;

function fixEdgarSourceUrls(sources: { organization?: string; url?: string }[] | null | undefined, cik: string | undefined): void {
  if (!sources?.length || !cik) return;
  const cleanCik = String(cik).replace(/^CIK/i, '');
  const officialUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cleanCik}&type=10-K&dateb=&owner=include&count=40`;
  for (const s of sources) {
    if (s.organization && SEC_ORG_PATTERN.test(s.organization)) {
      s.url = officialUrl;
    }
  }
}

// analyzeCompany() 결과의 모든 섹션 sources[]를 순회해 EDGAR 출처 URL을 고정한다.
// DART/web_search 소스는 cik가 없어 fixEdgarSourceUrls 내부에서 자동 스킵.
function fixAllEdgarSourceUrls(analysis: Partial<AnalysisData>, cik: string | undefined): void {
  fixEdgarSourceUrls(analysis.summary_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.business_model_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.competitors_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.value_chain_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.strategy_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.financials_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.founder_v2?.sources, cik);
  fixEdgarSourceUrls(analysis.cross_industry_nudge_v1?.sources, cik);
}

// ── SEC 산업 벤치마크 막대비교 (2026-08-12) ──────────────────────────────────────
// 숫자(편차 계산)는 secIndustryBenchmark.ts가 순수 계산, interpretation 한 줄만 별도
// Claude 호출(claude.ts). financials_v2.narrative에는 이 숫자를 넣지 않음(막대비교
// 컴포넌트가 전담) — KPI 카드와의 숫자 중복 방지 원칙.
interface SecBenchmarkResult {
  comparison: SecBenchmarkComparison | null;
}

const EMPTY_SEC_BENCHMARK_RESULT: SecBenchmarkResult = { comparison: null };

async function buildSecBenchmarkComparison(companyName: string, rawEdgar: any, language: Language = 'en'): Promise<SecBenchmarkResult> {
  const deviations = await computeSecBenchmarkDeviations(rawEdgar);
  if (!deviations) return EMPTY_SEC_BENCHMARK_RESULT;
  if (deviations.status === 'insufficient_sample') {
    return { comparison: { sicCode: deviations.sicCode, status: 'insufficient_sample', maxN: deviations.maxN } };
  }
  const items = deviations.items ?? [];
  const interpretations = await generateSecBenchmarkInterpretations(companyName, deviations.sicCode, items, language);
  return {
    comparison: {
      sicCode: deviations.sicCode,
      status: 'compared',
      items: items.map((it, i) => ({ ...it, interpretation: interpretations[i] ?? '' })),
    },
  };
}

// financials_v2에 벤치마크 비교를 붙이고, 실제로 비교 수치를 인용했다면 sources[]에도
// L1(🟢 공식) 출처를 남긴다 — attachIndustryData가 industry_benchmark_cache에 대해 하는
// 것과 동일한 패턴(기존 출처 뱃지 시스템 재사용, 새 뱃지 체계 안 만듦).
function attachSecBenchmarkToFinancials(financialsV2: FinancialsV2 | null | undefined, result: SecBenchmarkResult): void {
  if (!financialsV2 || !result.comparison) return;
  const comparison = result.comparison;
  financialsV2.sec_benchmark_comparison = comparison;
  if (comparison.status !== 'compared' || !comparison.items?.length) return;
  const sources: SectionSource[] = financialsV2.sources ?? [];
  for (const item of comparison.items) {
    sources.push({
      index: sources.length + 1,
      level: 'L1',
      organization: 'SEC Financial Statement Data Sets',
      content: `SIC ${comparison.sicCode}, n=${item.n} (${item.label})`,
      url: SEC_BENCHMARK_SOURCE_URL,
    });
  }
  financialsV2.sources = sources;
}

// ── 업종 벤치마크(재무 탭) + 매출 순위(경쟁사 탭) — EDGAR 기업 전용 ───────────────
// Claude 배치와 무관하게 순수 계산되므로 financials_v2/competitors_v2가 어떤 경로로
// 채워졌든(캐시/배치완료 무관) 최종 응답 조립 직전에 한 번만 호출해 결과 객체를 직접 mutate한다.
// DART/웹서치 기반 기업은 rawEdgar 자체가 없어 자동으로 스킵됨(early return).
async function attachIndustryData(
  financialsV2: FinancialsV2 | null | undefined,
  competitorsV2: Record<string, any> | null | undefined,
  dataSource: string | null | undefined,
  rawEdgar: any,
): Promise<void> {
  if (dataSource !== 'edgar' || !rawEdgar?.cik || !rawEdgar?.ticker) return;
  if (!financialsV2 && !competitorsV2) return;

  try {
    // EdgarRawSeries.cik는 "CIK0000320193" 형태지만 cik_master.cik는 접두어 없는
    // 순수 10자리("0000320193")로 저장돼 있어 조인 전 접두어를 제거해야 한다.
    const cik = String(rawEdgar.cik).replace(/^CIK/, '');
    const { data: cikRow } = await supabase
      .from('cik_master')
      .select('sic_code')
      .eq('cik', cik)
      .maybeSingle();
    const sicCode = cikRow?.sic_code;
    if (!sicCode) return;

    const subjectRatios = extractLatestRatios(rawEdgar);
    const [benchmark, ranking] = await Promise.all([
      subjectRatios ? getIndustryBenchmark(sicCode, subjectRatios) : Promise.resolve(null),
      getCompetitorRevenueRanking(sicCode, rawEdgar.ticker),
    ]);

    // 벤치마크/순위 결과를 각 섹션의 sources 배열에 "1min 자체 집계" 항목으로 추가하고,
    // 그 인덱스를 문장에 [n]으로 삽입 — 기존 CitedText/[n] 각주 렌더링을 그대로 재사용.
    if (financialsV2) {
      if (benchmark) {
        const sources: SectionSource[] = financialsV2.sources ?? [];
        const idx = sources.length + 1;
        sources.push({
          index: idx, level: 'L1', organization: '1min 자체 집계',
          content: `동종업계(SIC ${benchmark.sicCode}) EDGAR 공식 재무데이터 기준, ${benchmark.asOf}`,
        });
        financialsV2.sources = sources;
        financialsV2.industry_benchmark = {
          ...benchmark,
          sourceIndex: idx,
          metrics: benchmark.metrics.map((m) => ({ ...m, sentence: `${m.sentence} [${idx}]` })),
        };
      } else {
        financialsV2.industry_benchmark = null;
      }
    }

    if (competitorsV2) {
      if (ranking) {
        const sources: SectionSource[] = competitorsV2.sources ?? [];
        const idx = sources.length + 1;
        sources.push({
          index: idx, level: 'L1', organization: '1min 자체 집계',
          content: `동종업계(SIC ${ranking.sicCode}) EDGAR 공식 매출데이터 기준, ${ranking.asOf}`,
        });
        competitorsV2.sources = sources;
        competitorsV2.revenue_ranking = { ...ranking, sourceIndex: idx };
      } else {
        competitorsV2.revenue_ranking = null;
      }
    }
  } catch (e) {
    console.warn('[industryBenchmark] attach failed', (e as Error).message);
  }
}

// ── financial_cache → FinancialsV2 변환 (배치 프리컴퓨트 raw 데이터 → 표시용 구조체) ──

function buildFinancialsV2FromRaw(rawEdgar: any, rawDart: any, source: 'EDGAR' | 'DART', language: Language): FinancialsV2 | null {
  // 표시 언어는 데이터 소스(DART/EDGAR)가 아니라 요청된 language를 따른다 — 미국 기업을
  // KR 모드로 볼 수도, 한국 기업을 EN 모드로 볼 수도 있으므로 소스 국적과 무관하게 분기.
  const t = (ko: string, en: string) => (language === 'ko' ? ko : en);
  const fmtUsd = (v: number | null): string => {
    if (v == null) return '—';
    const sign = v < 0 ? '-' : '';
    const abs  = Math.abs(v);
    return abs >= 1_000_000_000
      ? `${sign}${(abs / 1_000_000_000).toFixed(1)}B USD`
      : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
  };
  const fmtKrw = (v: number | null): string => {
    if (v == null) return '—';
    const sign = v < 0 ? '-' : '';
    const abs  = Math.abs(v);
    if (abs >= 1_000_000_000_000) return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조원`;
    if (abs >= 100_000_000)       return `${sign}${(abs / 100_000_000).toFixed(0)}억원`;
    return `${sign}${Math.round(abs / 10_000).toLocaleString()}만원`;
  };

  const series = rawEdgar ?? rawDart?.cfs ?? rawDart?.ofs;
  if (!series) return null;
  const fmt: (v: number | null) => string = rawEdgar ? fmtUsd : fmtKrw;
  // series.fiscalYears는 이미 그 회사가 실제로 보유한 연도만 담고 있다(extractAnnualSeries 등
  // 참고) — 예전엔 리터럴 2021~2025로 다시 걸러서 NVIDIA FY2026 같은 최신 연도가 fyrs[0](=이
  // 함수의 대표 연도 라벨)에서만 한 해 스테일하게 남는 불일치가 있었다(income_statement 표는
  // financialsTableBuilder.ts가 이미 정확히 보여주는데 key_bullets/sources 문구만 구버전
  // 연도를 말하는 상태, 2026-08-15 발견).
  const fyrs: string[] = series.fiscalYears ?? [];
  if (fyrs.length === 0) return null;

  // income_statement/balance_sheet는 financialsTableBuilder.ts의 공용 함수로 조립(Gross Profit은
  // EDGAR/DART 원본 태그값만 사용, EBITDA는 표시하지 않음 — 재무 파생 지표 처리 원칙 참고. Not
  // applicable/Not disclosed 구분, YoY까지 서버가 결정론적으로 계산) — batch3 최종 병합(claude.ts)
  // 시점의 override와 동일한 함수를 재사용해 fin_preview와 최종 결과가 항상 일치하도록 한다.
  const isRows = buildIncomeStatementRows(rawEdgar ?? null, rawDart ?? null, language);
  const bsRows = buildBalanceSheetRows(rawEdgar ?? null, rawDart ?? null, language);
  const revenueLines = buildRevenueLines(rawEdgar ?? null);

  const isKr   = source === 'DART';
  const name   = rawDart?.corp_name ?? rawEdgar?.ticker ?? '';
  const yr     = fyrs[0];
  const srcLbl = isKr ? t('DART 공시', 'DART filing') : 'SEC EDGAR';

  // 현금흐름 — EDGAR는 이제 rawSeries에 operatingCF/investingCF/financingCF가 실려 오므로
  // (2026-07-30 이전엔 edgar.ts/edgarBatchPrecompute.ts 양쪽에서 이 필드 자체가 누락돼 있었음)
  // 실제 값이 있으면 그대로 표시. DART는 이 파이프라인이 현금흐름 concept을 아예 안 가져오므로
  // 항상 미지원 — "배치 데이터라서 없다"는 부정확한 문구 대신 원인을 정확히 표기.
  const cf = {
    operating: fmt(series.operatingCF?.[0] ?? null),
    investing: fmt(series.investingCF?.[0] ?? null),
    financing: fmt(series.financingCF?.[0] ?? null),
  };
  const hasCf = cf.operating !== '—' || cf.investing !== '—' || cf.financing !== '—';

  return {
    key_bullets: ([
      t(`${srcLbl} 공식 데이터 (${yr}년 기준)`, `${srcLbl} official data (FY${yr})`),
      series.revenue?.[0]        != null ? t(`${yr}년 매출액: ${fmt(series.revenue[0])}`, `FY${yr} Revenue: ${fmt(series.revenue[0])}`) : null,
      series.operatingIncome?.[0] != null ? t(`${yr}년 영업이익: ${fmt(series.operatingIncome[0])}`, `FY${yr} Operating Income: ${fmt(series.operatingIncome[0])}`) : null,
    ] as (string | null)[]).filter((x): x is string => x !== null),
    income_statement: isRows ?? [],
    revenue_lines: revenueLines ?? undefined,
    balance_sheet: bsRows ?? [],
    cash_flow: hasCf
      ? { ...cf, fcf: t('확인 필요', 'Not disclosed'), notes: '' }
      : {
          operating: '—', investing: '—', financing: '—', fcf: '—',
          notes: isKr
            ? t('DART 배치 데이터 — 현금흐름 미지원', 'DART batch data — cash flow not supported')
            : t('SEC EDGAR 현금흐름 태깅 없음', 'SEC EDGAR cash flow tagging unavailable'),
        },
    key_risks: [],
    outlook: { shortTerm: '', midLongTerm: '', keyRisks: [] },
    sources: [{
      index: 1, level: 'L1' as const, organization: srcLbl, date: yr,
      content: t(`${name} 연간 재무제표 (공식 공시)`, `${name} annual financial statements (official filing)`), isEstimate: false,
      url: source === 'EDGAR' && rawEdgar?.cik
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${rawEdgar.cik}&type=10-K`
        : undefined,
    }],
  } as unknown as FinancialsV2;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBatchDbFields(batchNum: number, data: Partial<AnalysisData>): Record<string, any> {
  switch (batchNum) {
    case 1: return {
      summary_v2: data.summary_v2 ?? null,
      summary:    data.summary_v2?.key_bullets?.join(' | ') ?? '',
    };
    case 2: return {
      business_model_v2:       data.business_model_v2       ?? null,
      competitors_v2:          data.competitors_v2           ?? null,
      cross_industry_nudge_v1: data.cross_industry_nudge_v1  ?? null,
    };
    case 3: return {
      value_chain_v2: data.value_chain_v2    ?? null,
      strategy_v2:    data.strategy_v2       ?? null,
      financials_v2:  data.financials_v2     ?? null,
      financials:     '',
    };
    case 4: return {
      founder_v2: data.founder_v2 ?? null,
      sources:    data.sources    ?? {},
    };
    // 2026-08-16부터 industry_history_v2/tech_evolution_v2(Pain Diagnosis)가 배치5로
    // 승격되어 다른 배치와 동일하게 저장된다(구 온디맨드 전용 엔드포인트는 삭제됨).
    case 5: return {
      industry_history_v2: data.industry_history_v2 ?? null,
      tech_evolution_v2:   data.tech_evolution_v2    ?? null,
    };
    default: return {};
  }
}

function buildDonePayload(
  data: any,
  companyName: string,
  meta: { cached: boolean; analysisId: string | null; createdAt: string; dataSource: string; growthScenario?: Record<string, any> | null; isPremium: boolean; language: Language },
) {
  // 성장 시나리오는 계산/저장은 항상 수행하되, 응답 페이로드는 프리미엄 유저에게만 포함
  const growthScenarioOut = meta.isPremium ? (meta.growthScenario ?? data.growth_scenario_v2 ?? null) : null;
  return {
    analysisId:   meta.analysisId,
    companyName,
    createdAt:    meta.createdAt,
    cached:       meta.cached,
    language:     meta.language,
    summary:              data.summary_v2?.key_bullets?.join(' | ') ?? '',
    industry_history:     '',
    tech_evolution:       '',
    value_chain_overview: '',
    business_model:       '',
    financials:           '',
    metrics: [], strengths: [], risks: [],
    moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
    financials_structured: {},
    sources:          data.sources ?? {},
    valuechainPlayers: [],
    summary_v2:          data.summary_v2          ?? null,
    industry_history_v2: data.industry_history_v2 ?? null,
    tech_evolution_v2:   data.tech_evolution_v2   ?? null,
    value_chain_v2:      data.value_chain_v2      ?? null,
    business_model_v2:   data.business_model_v2   ?? null,
    competitors_v2:      data.competitors_v2       ?? null,
    cross_industry_nudge_v1: data.cross_industry_nudge_v1 ?? null,
    strategy_v2:         data.strategy_v2          ?? null,
    financials_v2:       data.financials_v2        ?? null,
    founder_v2:          data.founder_v2           ?? null,
    growth_scenario_v2:  growthScenarioOut,
    dataSource:          meta.dataSource,
  };
}

async function saveSources(analysisId: string, companyName: string, sources: AnalysisSources) {
  const rows = (Object.entries(sources) as [string, any[]][])
    .flatMap(([tab, srcs]) =>
      (srcs ?? []).map((s: any) => ({
        analysis_id:  analysisId,
        company_name: companyName,
        tab_name:     tab,
        source_index: s.index,
        level:        s.level,
        organization: s.organization,
        date:         s.date,
        content:      s.content,
        is_estimate:  s.isEstimate ?? (s.level === 'L3'),
        url:          s.url ?? null,
      })),
    );
  if (rows.length > 0) {
    await supabase.from('analysis_sources').insert(rows);
  }
}

// ── Non-streaming POST /api/analyze ──────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { companyName, companyId } = req.body as { companyName?: string; companyId?: string };

  if (!companyName?.trim()) {
    res.status(400).json({ error: '기업명을 입력해주세요.' });
    return;
  }

  const name = companyName.trim();

  try {
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

    const listings = await fetchCompanyListings(companyId ?? company.id);
    const { source: dataSource, contextText, rawEdgar, rawDart } = await fetchFinancialContext(name, listings);
    const analysis = await analyzeCompany(name, contextText || undefined, undefined, { rawEdgar, rawDart });
    fixAllEdgarSourceUrls(analysis, rawEdgar?.cik);
    if (dataSource === 'edgar' && rawEdgar) {
      const secBenchmarkResult = await buildSecBenchmarkComparison(name, rawEdgar).catch(() => EMPTY_SEC_BENCHMARK_RESULT);
      attachSecBenchmarkToFinancials(analysis.financials_v2, secBenchmarkResult);
    }

    const { data: savedAnalysis, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        company_id:           company.id,
        created_by:           authUser.id,
        summary:              analysis.summary_v2?.key_bullets?.join(' | ') ?? '',
        industry_history:     analysis.industry_history_v2?.industry_name ?? '',
        tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
        value_chain_overview: analysis.value_chain_v2?.industry ?? '',
        business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
        financials:           '',
        metrics: [], strengths: [], risks: [],
        moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
        financials_structured: {},
        sources:     analysis.sources ?? {},
        data_source: dataSource,
        summary_v2:          analysis.summary_v2,
        industry_history_v2: analysis.industry_history_v2,
        tech_evolution_v2:   analysis.tech_evolution_v2,
        value_chain_v2:      analysis.value_chain_v2,
        business_model_v2:   analysis.business_model_v2,
        competitors_v2:      analysis.competitors_v2,
        cross_industry_nudge_v1: analysis.cross_industry_nudge_v1,
        strategy_v2:         analysis.strategy_v2,
        financials_v2:       analysis.financials_v2,
        founder_v2:          analysis.founder_v2,
      })
      .select('id, created_at')
      .single();
    if (analysisErr) throw analysisErr;

    await saveSources(savedAnalysis.id, name, analysis.sources ?? {});

    res.json({
      analysisId: savedAnalysis.id,
      companyName: name,
      createdAt:   savedAnalysis.created_at,
      summary:              analysis.summary_v2?.key_bullets?.join(' | ') ?? '',
      industry_history:     analysis.industry_history_v2?.industry_name ?? '',
      tech_evolution:       analysis.tech_evolution_v2?.tech_name ?? '',
      value_chain_overview: analysis.value_chain_v2?.industry ?? '',
      business_model:       analysis.business_model_v2?.growth_motion_detail ?? '',
      financials:           '',
      metrics: [], strengths: [], risks: [],
      moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
      financials_structured: {},
      sources:          analysis.sources ?? {},
      valuechainPlayers: [],
      summary_v2:          analysis.summary_v2,
      industry_history_v2: analysis.industry_history_v2,
      tech_evolution_v2:   analysis.tech_evolution_v2,
      value_chain_v2:      analysis.value_chain_v2,
      business_model_v2:   analysis.business_model_v2,
      competitors_v2:      analysis.competitors_v2,
      cross_industry_nudge_v1: analysis.cross_industry_nudge_v1,
      strategy_v2:         analysis.strategy_v2,
      financials_v2:       analysis.financials_v2,
      founder_v2:          analysis.founder_v2,
      dataSource,
    });
  } catch (err) {
    console.error('[POST /api/analyze]', err);
    res.status(500).json({ error: '분석 중 오류가 발생했습니다.' });
  }
});

// ── GET /api/analyze/usage — 무료 분석 횟수 조회 (분석 실행 없이 카운터 표시용) ──

router.get('/usage', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }
  const isAdmin = isAdminUser(authUser.id);
  if (await isPremiumUser({ clientId: null, authUserId: authUser.id })) {
    res.json({ isPremium: true, isAdmin, usedCount: 0, limit: null, nextAvailableAt: null });
    return;
  }
  const usage = await checkAnalysisUsage(authUser.id);
  res.json({ isPremium: false, isAdmin, usedCount: usage.usedCount, limit: 2, nextAvailableAt: usage.nextAvailableAt ?? null });
});

// ── Streaming POST /api/analyze/stream ───────────────────────────────────────

router.post('/stream', async (req: Request, res: Response) => {
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const {
    companyName, companyId, forceRefresh, sectorTag, baseRevenue,
    language: rawLanguage, purposeCategory: rawPurposeCategory, purposeDetail,
  } = req.body as {
    companyName?: string;
    companyId?: string;
    forceRefresh?: boolean;
    // 상장 정보/자체 매출 시계열이 없는 기업의 몬테카를로 폴백용 (섹터 벤치마크).
    // 업종 선택 UI가 아직 없어 우선 요청 파라미터로 받는다 — 둘 다 있어야 사용됨.
    sectorTag?: string;
    baseRevenue?: number;
    language?: string;
    // 분석 요청마다 입력받는 목적(매 요청 단위) — 각 섹션 프롬프트에 해석 레이어로 주입.
    purposeCategory?: string;
    purposeDetail?: string;
  };
  // 기본값 EN(언어 정책 SSOT) — 클라이언트가 안 보내거나 알 수 없는 값이면 안전하게 폴백
  const language: Language = rawLanguage === 'ko' ? 'ko' : 'en';
  // 허용값 밖이면 조용히 무시(하드 400 아님) — language 폴백과 동일한 관용적 처리.
  const purposeCategory = PURPOSE_CATEGORIES.includes(rawPurposeCategory ?? '')
    ? rawPurposeCategory
    : undefined;
  const isPremium = await isPremiumUser({ clientId: null, authUserId: authUser.id });
  const usageUserId = authUser.id;

  if (!companyName?.trim()) {
    res.status(400).json({ error: '기업명을 입력해주세요.' });
    return;
  }

  const name = companyName.trim();

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

  // 신규 분석/강제 재분석 시에만 카운트 (캐시 그대로 보여주는 경우는 카운트 제외).
  // 프리미엄 유저도 기록은 남긴다(추후 사용량 분석/과금 근거용) — 제한 체크만 스킵.
  // 차단되면 'rate_limited' 이벤트를 보내고 스트림을 종료한다.
  const checkAndRecordUsage = async (): Promise<boolean> => {
    if (!isPremium) {
      const usage = await checkAnalysisUsage(usageUserId);
      if (!usage.allowed) {
        const nextDate = usage.nextAvailableAt ? usage.nextAvailableAt.slice(0, 10) : '';
        send('rate_limited', {
          message: `최근 7일간 무료 분석 2회를 모두 사용했어요. 다음 사용 가능 시점: ${nextDate}. 프리미엄으로 무제한 이용하기`,
          usedCount: usage.usedCount,
          nextAvailableAt: usage.nextAvailableAt,
        });
        res.end();
        return false;
      }
    }
    await recordAnalysisUsage(usageUserId, name);
    return true;
  };

  try {
    // 1. Upsert company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .upsert({ name }, { onConflict: 'name' })
      .select('id')
      .single();
    if (companyErr) throw companyErr;

    // 다중상장 회사(EDGAR+DART 둘 다 company_listings에 있음)면 fetchFinancialContext가
    // 이름 휴리스틱 대신 이 identifier로 직접 조회한다 — 없으면 기존 경로 그대로.
    const listings = await fetchCompanyListings(companyId ?? company.id);

    // 2. Check financials_v2_cache (3-month validity, company_name exact match)
    const finCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: finCache } = await supabase
      .from('financials_v2_cache')
      .select('financials_v2, company_name')
      .eq('company_name', name)           // 정확히 일치하는 company_name만
      .gte('updated_at', finCutoff)
      .maybeSingle();

    let cachedFinancials: FinancialsV2 | undefined = finCache?.financials_v2 ?? undefined;

    // 캐시 데이터 회사명 일치 검증 — 콘텐츠 어디에도 회사명 키워드가 없으면 오염된 캐시로 판단하고
    // 무시. 예전엔 narrative 필드 하나만 검색했으나(2026-08 재무 서사 섹션 삭제로 그 필드 자체가
    // 없어짐), 특정 필드에 의존하지 않도록 전체 JSON을 검색 대상으로 확장 — 더 안전함.
    if (cachedFinancials && finCache?.company_name === name) {
      const searchText = JSON.stringify(cachedFinancials).toLowerCase();
      const nameTokens = name.toLowerCase().split(/[\s,.\-]+/).filter(t => t.length >= 3);
      const hasMatch = nameTokens.some(token => searchText.includes(token));
      if (!hasMatch) {
        console.warn(`[financials_cache] company name mismatch — discarding cache for "${name}"`);
        cachedFinancials = undefined;
        // 오염된 캐시 즉시 삭제
        await supabase.from('financials_v2_cache').delete().eq('company_name', name);
      } else {
        console.log(`[financials_cache] HIT "${name}"`);
      }
    }

    // 3. Check analysis cache (무기한 — forceRefresh: true 시에만 재분석)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('analyses')
        .select('id, created_at, language, summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, cross_industry_nudge_v1, strategy_v2, financials_v2, founder_v2, growth_scenario_v2, sources, data_source')
        .eq('company_id', company.id)
        .eq('language', language)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const b1 = !!cached.summary_v2;
        const b2 = !!(cached.business_model_v2 && cached.competitors_v2 && cached.cross_industry_nudge_v1);
        const b3 = !!(cached.value_chain_v2 && cached.strategy_v2 && cached.financials_v2);
        const b4 = !!cached.founder_v2;
        // 2026-08-16부터 industry_history_v2/tech_evolution_v2(Pain Diagnosis)가 배치5로
        // 승격되어 다른 배치와 동일하게 캐시 완료 판정에 포함된다 — 배치5가 없는 기존 캐시
        // 행은 자동으로 partial cache로 떨어져 배치5만 라이브로 채워진다(자연 백필).
        const b5 = !!(cached.industry_history_v2 && cached.tech_evolution_v2);

        if (b1 && b2 && b3 && b4 && b5) {
          // Full cache hit — financial_cache 조회 (web_search 기반 캐시만 업그레이드)
          let effectiveFinancials = cached.financials_v2;
          let effectiveCompetitors = cached.competitors_v2;
          let effectiveSource: string = cached.data_source ?? 'web_search';

          if (cached.data_source === 'web_search') {
            try {
              const isKorean = /[가-힯]/.test(name);
              const now = new Date().toISOString();
              if (isKorean) {
                const { data: corpRow } = await supabase
                  .from('corp_master').select('stock_code')
                  .ilike('corp_name', name).not('stock_code', 'is', null).maybeSingle();
                if (corpRow?.stock_code) {
                  const { data: fc } = await supabase
                    .from('financial_cache').select('source, raw_edgar, raw_dart')
                    .eq('company_name', corpRow.stock_code).gt('expires_at', now).maybeSingle();
                  if (fc) {
                    const built = buildFinancialsV2FromRaw(fc.raw_edgar, fc.raw_dart, fc.source as 'EDGAR' | 'DART', language);
                    if (built) { effectiveFinancials = built; effectiveSource = fc.source.toLowerCase(); }
                  }
                }
              } else {
                // 티커 직접 입력 케이스 (AAPL, MSFT 등 1~6자 대문자)
                const nameTicker = name.toUpperCase().replace(/\s+/g, '');
                if (/^[A-Z]{1,6}$/.test(nameTicker)) {
                  const { data: fc } = await supabase
                    .from('financial_cache').select('source, raw_edgar, raw_dart')
                    .eq('company_name', nameTicker).gt('expires_at', now).maybeSingle();
                  if (fc) {
                    const built = buildFinancialsV2FromRaw(fc.raw_edgar, fc.raw_dart, fc.source as 'EDGAR' | 'DART', language);
                    if (built) { effectiveFinancials = built; effectiveSource = fc.source.toLowerCase(); }
                  }
                }
              }
            } catch (e) {
              console.warn('[financial_cache full-hit check]', (e as Error).message);
            }
          }

          // 업종 벤치마크/매출 순위(EDGAR 전용) — fetchFinancialContext는 financial_cache
          // 우선 조회라 캐시 히트 시 빠름. DART/web_search 소스면 호출 자체를 건너뛴다.
          if (effectiveSource === 'edgar') {
            const { rawEdgar } = await fetchFinancialContext(name, listings);
            await attachIndustryData(effectiveFinancials, effectiveCompetitors, effectiveSource, rawEdgar);
          }

          send('done', buildDonePayload(
            { ...cached, financials_v2: effectiveFinancials, competitors_v2: effectiveCompetitors },
            name,
            { cached: true, analysisId: cached.id, createdAt: cached.created_at, dataSource: effectiveSource, isPremium, language },
          ));
          return res.end();
        }

        // Partial cache — send completed batches immediately, run missing ones
        const skipBatches = new Set<number>();
        const initialData: Partial<AnalysisData> = {};
        let completedCount = 0;

        const sendCached = (batchNum: number, data: Record<string, any>) => {
          completedCount++;
          skipBatches.add(batchNum);
          Object.assign(initialData, data);
          send('batch', { batch: batchNum, data, completed: completedCount, total: 5, analysisId: cached.id });
        };

        if (b1) sendCached(1, { summary_v2: cached.summary_v2 });
        if (b2) sendCached(2, {
          business_model_v2: cached.business_model_v2,
          competitors_v2:    cached.competitors_v2,
          cross_industry_nudge_v1: cached.cross_industry_nudge_v1,
        });
        if (b3) sendCached(3, {
          value_chain_v2: cached.value_chain_v2,
          strategy_v2:    cached.strategy_v2,
          financials_v2:  cached.financials_v2,
        });
        if (b4) sendCached(4, { founder_v2: cached.founder_v2, sources: cached.sources ?? {} });
        if (b5) sendCached(5, {
          industry_history_v2: cached.industry_history_v2,
          tech_evolution_v2:   cached.tech_evolution_v2,
        });

        if (!(await checkAndRecordUsage())) return;

        // 이번 요청에 목적이 실려왔으면 기존 캐시 행에 반영(라이브로 재생성되는 섹션에만
        // 적용됨 — 이미 캐시된 섹션 콘텐츠를 소급 변경하진 않음, "주입 배관만" 스코프).
        if (purposeCategory) {
          await supabase.from('analyses')
            .update({ purpose_category: purposeCategory, purpose_detail: purposeDetail?.trim() || null })
            .eq('id', cached.id);
        }

        const { source: dataSource, contextText, rawEdgar, rawDart, isCacheHit } = await fetchFinancialContext(name, listings);
        send('meta', { isFirstLookup: !isCacheHit });
        const useCachedFin = !skipBatches.has(3) ? cachedFinancials : undefined;

        // fin_preview: send financials immediately from raw cache if batch 3 hasn't loaded yet
        if (!skipBatches.has(3)) {
          const quickFin = (rawEdgar || rawDart)
            ? buildFinancialsV2FromRaw(rawEdgar ?? null, rawDart ?? null, rawDart ? 'DART' : 'EDGAR', language)
            : (useCachedFin ?? null);
          if (quickFin) {
            const previewSource = rawDart ? 'dart' : (rawEdgar ? 'edgar' : dataSource);
            send('fin_preview', { financials_v2: quickFin, dataSource: previewSource });
          }
        }

        // EDGAR 소스에만 적용(SIC 체계라 DART/web_search는 자연히 스킵) — analyzeCompany()와
        // 병렬로 미리 시작해두고 batch3(financials_v2) 완료 시점에 await해서 붙인다. 계산
        // 자체는 rawEdgar만 있으면 되므로 다른 배치를 기다릴 필요가 없어 지연을 숨긴다.
        const secBenchmarkPromise = dataSource === 'edgar' && rawEdgar
          ? buildSecBenchmarkComparison(name, rawEdgar, language).catch(() => EMPTY_SEC_BENCHMARK_RESULT)
          : Promise.resolve(EMPTY_SEC_BENCHMARK_RESULT);

        const analysis = await analyzeCompany(
          name,
          contextText || undefined,
          async (batchNum, data) => {
            completedCount++;
            fixAllEdgarSourceUrls(data, rawEdgar?.cik);
            if (batchNum === 3 && data.financials_v2) {
              attachSecBenchmarkToFinancials(data.financials_v2, await secBenchmarkPromise);
            }
            send('batch', { batch: batchNum, data, completed: completedCount, total: 5, analysisId: cached.id });
            const fields = getBatchDbFields(batchNum, data);
            if (Object.keys(fields).length > 0) {
              await supabase.from('analyses').update(fields).eq('id', cached.id);
            }
            if (batchNum === 3 && !cachedFinancials && data.financials_v2) {
              await supabase.from('financials_v2_cache').upsert(
                { company_name: name, financials_v2: data.financials_v2, updated_at: new Date().toISOString() },
                { onConflict: 'company_name' },
              );
            }
          },
          { skipBatches, initialData, cachedFinancials: useCachedFin, language, rawEdgar, rawDart, purposeCategory, purposeDetail },
        );

        if (analysis.sources) await saveSources(cached.id, name, analysis.sources);

        // 3차: 2차(batch2-5) 완료 후 revenue_history 확보 시에만 몬테카를로 트리거
        // 계산/DB 저장은 항상 수행 — 프리미엄 여부와 무관하게 데이터는 준비해둔다.
        const growthScenario = cached.growth_scenario_v2 ?? await computeGrowthScenario(name, rawEdgar, rawDart, sectorTag, baseRevenue, language);
        if (growthScenario && !cached.growth_scenario_v2) {
          await supabase.from('analyses').update({ growth_scenario_v2: growthScenario }).eq('id', cached.id);
        }
        // SSE 전송은 프리미엄 유저에게만 — 무료 유저는 이 이벤트 자체를 받지 않는다.
        if (growthScenario && isPremium) {
          send('batch', { batch: 6, data: { growth_scenario_v2: growthScenario }, completed: completedCount, total: 5, analysisId: cached.id });
        }

        await attachIndustryData(analysis.financials_v2, analysis.competitors_v2, dataSource, rawEdgar);

        send('done', buildDonePayload(analysis, name, {
          cached: false,
          analysisId: cached.id,
          createdAt:  cached.created_at,
          dataSource: dataSource ?? cached.data_source ?? 'web_search',
          growthScenario,
          isPremium,
          language,
        }));
        return res.end();
      }
    }

    // 4. No cache — full analysis with per-batch DB saves
    if (!(await checkAndRecordUsage())) return;

    const { source: dataSource, contextText, rawEdgar, rawDart, isCacheHit } = await fetchFinancialContext(name, listings);
    send('meta', { isFirstLookup: !isCacheHit });

    // fin_preview: show financials immediately from raw/cached data if available
    {
      const quickFin = (rawEdgar || rawDart)
        ? buildFinancialsV2FromRaw(rawEdgar ?? null, rawDart ?? null, rawDart ? 'DART' : 'EDGAR', language)
        : (cachedFinancials ?? null);
      if (quickFin) {
        const previewSource = rawDart ? 'dart' : (rawEdgar ? 'edgar' : dataSource);
        send('fin_preview', { financials_v2: quickFin, dataSource: previewSource });
      }
    }

    // EDGAR 소스에만 적용(SIC 체계라 DART/web_search는 자연히 스킵) — analyzeCompany()와
    // 병렬로 미리 시작해두고 batch3(financials_v2) 완료 시점에 await해서 붙인다.
    const secBenchmarkPromise = dataSource === 'edgar' && rawEdgar
      ? buildSecBenchmarkComparison(name, rawEdgar, language).catch(() => EMPTY_SEC_BENCHMARK_RESULT)
      : Promise.resolve(EMPTY_SEC_BENCHMARK_RESULT);

    let savedId: string | null = null;
    let savedAt: string | null = null;
    let batchCount = 0;

    const analysis = await analyzeCompany(
      name,
      contextText || undefined,
      async (batchNum, data) => {
        batchCount++;
        fixAllEdgarSourceUrls(data, rawEdgar?.cik);
        if (batchNum === 3 && data.financials_v2) {
          attachSecBenchmarkToFinancials(data.financials_v2, await secBenchmarkPromise);
        }

        if (batchNum === 1) {
          const { data: saved, error } = await supabase
            .from('analyses')
            .insert({
              company_id: company.id,
              created_by: authUser.id,
              language:   language,
              summary:    data.summary_v2?.key_bullets?.join(' | ') ?? '',
              industry_history: '', tech_evolution: '', value_chain_overview: '',
              business_model: '', financials: '',
              metrics: [], strengths: [], risks: [],
              moat_analysis: {}, risk_analysis: {}, competitors: {}, strategy: {},
              financials_structured: {},
              sources:     {},
              data_source: dataSource,
              purpose_category: purposeCategory ?? null,
              purpose_detail:   purposeDetail?.trim() || null,
              summary_v2:          data.summary_v2 ?? null,
              industry_history_v2: null,
              tech_evolution_v2:   null,
              value_chain_v2:      null,
              business_model_v2:   null,
              competitors_v2:      null,
              cross_industry_nudge_v1: null,
              strategy_v2:         null,
              financials_v2:       null,
              founder_v2:          null,
            })
            .select('id, created_at')
            .single();
          if (!error && saved) { savedId = saved.id; savedAt = saved.created_at; }
          send('batch', { batch: batchNum, data, completed: batchCount, total: 5, analysisId: savedId });

        } else if (savedId) {
          const fields = getBatchDbFields(batchNum, data);
          if (Object.keys(fields).length > 0) {
            await supabase.from('analyses').update(fields).eq('id', savedId);
          }
          send('batch', { batch: batchNum, data, completed: batchCount, total: 5, analysisId: savedId });

          if (batchNum === 3 && !cachedFinancials && data.financials_v2) {
            await supabase.from('financials_v2_cache').upsert(
              { company_name: name, financials_v2: data.financials_v2, updated_at: new Date().toISOString() },
              { onConflict: 'company_name' },
            );
          }
        }
      },
      { cachedFinancials, language, rawEdgar, rawDart, purposeCategory, purposeDetail },
    );

    if (savedId && analysis.sources) await saveSources(savedId, name, analysis.sources);

    // 3차: 2차(batch2-5) 완료 후 revenue_history 확보 시에만 몬테카를로 트리거
    // 계산/DB 저장은 항상 수행 — 프리미엄 여부와 무관하게 데이터는 준비해둔다.
    const growthScenario = await computeGrowthScenario(name, rawEdgar, rawDart, sectorTag, baseRevenue, language);
    if (growthScenario && savedId) {
      await supabase.from('analyses').update({ growth_scenario_v2: growthScenario }).eq('id', savedId);
    }
    // SSE 전송은 프리미엄 유저에게만 — 무료 유저는 이 이벤트 자체를 받지 않는다.
    if (growthScenario && savedId && isPremium) {
      send('batch', { batch: 6, data: { growth_scenario_v2: growthScenario }, completed: batchCount, total: 5, analysisId: savedId });
    }

    await attachIndustryData(analysis.financials_v2, analysis.competitors_v2, dataSource, rawEdgar);

    send('done', buildDonePayload(analysis, name, {
      cached:     false,
      analysisId: savedId,
      createdAt:  savedAt ?? new Date().toISOString(),
      dataSource,
      growthScenario,
      isPremium,
      language,
    }));
    res.end();

  } catch (err) {
    console.error('[POST /api/analyze/stream]', err);
    send('error', { message: '분석 중 오류가 발생했습니다.' });
    res.end();
  }
});

// ── POST /api/analyze/reanalyze — 단일 섹션 재분석 ──────────────────────────────

const REANALYZE_SECTION_MAP: Record<string, string> = {
  summary:        'summary_v2',
  industry:       'industry_history_v2',
  business_model: 'business_model_v2',
  competitors:    'competitors_v2',
  nudge:          'cross_industry_nudge_v1',
  tech:           'tech_evolution_v2',
  value_chain:    'value_chain_v2',
  strategy:       'strategy_v2',
  financials:     'financials_v2',
  founder:        'founder_v2',
};

function getReanalyzeSectionDbFields(sectionKey: string, data: any): Record<string, any> {
  switch (sectionKey) {
    case 'summary_v2':          return { summary_v2: data, summary: data?.key_bullets?.join(' | ') ?? '' };
    case 'financials_v2':       return { financials_v2: data, financials: '' };
    case 'business_model_v2':   return { business_model_v2: data, business_model: data?.growth_motion_detail ?? '' };
    default:                    return { [sectionKey]: data };
  }
}

router.post('/reanalyze', async (req: Request, res: Response) => {
  // 하드 401만 적용 — 소유권(403) 체크는 없음. 이 라우트는 "탭별 재분석" 버튼을 통해
  // 공용 캐시된 분석을 누구든(생성자가 아니어도) 갱신할 수 있는 협업성 기능으로 설계됨
  // (2026-07-16 소유권 검증 감사 때 사용자가 명시적으로 이 동작 유지를 선택 — 실전 발견
  // 이력 16번 참고). 로그인 자체는 필수 — 비로그인 무단 비용발생만 차단한다.
  const authUser = await resolveAuthUser(req);
  if (!authUser) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  const { analysisId, companyName, section } = req.body as {
    analysisId?: string;
    companyName?: string;
    section?: string;
  };

  if (!analysisId?.trim() || !companyName?.trim() || !section?.trim()) {
    res.status(400).json({ error: 'analysisId, companyName, section 모두 필요합니다.' });
    return;
  }

  const sectionKey = REANALYZE_SECTION_MAP[section];
  if (!sectionKey) {
    res.status(400).json({ error: `알 수 없는 섹션: ${section}` });
    return;
  }

  const name = companyName.trim();
  console.log(`[reanalyze] START ${section} (${sectionKey}) for "${name}"`);

  try {
    // 이 행이 어느 언어로 생성됐는지는 클라이언트 입력이 아니라 DB에서 직접 읽는다 —
    // 한 리포트 안에서 섹션마다 언어가 갈리는 사고를 방지(언어 정책 SSOT 참고). purpose도
    // 동일하게 DB 행 기준으로 읽어 개별 재시도에서도 일관성을 유지한다(재입력 요구 안 함).
    const { data: existing } = await supabase
      .from('analyses').select('language, purpose_category, purpose_detail').eq('id', analysisId.trim()).maybeSingle();
    const language: Language = existing?.language === 'ko' ? 'ko' : 'en';

    let financialCtx: string | undefined;
    let rawFinancials: Parameters<typeof reanalyzeSingleSection>[4];
    if (sectionKey === 'financials_v2') {
      const { contextText, rawEdgar, rawDart } = await fetchFinancialContext(name);
      financialCtx = contextText || undefined;
      rawFinancials = { rawEdgar, rawDart };
    }

    const data = await reanalyzeSingleSection(name, sectionKey, financialCtx, language, rawFinancials, {
      purposeCategory: existing?.purpose_category, purposeDetail: existing?.purpose_detail,
    });

    if (!data) {
      res.status(422).json({ error: '재분석 결과를 얻지 못했습니다. 잠시 후 다시 시도해주세요.' });
      return;
    }

    const dbFields = getReanalyzeSectionDbFields(sectionKey, data);
    const { error: updateErr } = await supabase
      .from('analyses')
      .update(dbFields)
      .eq('id', analysisId.trim());

    if (updateErr) throw updateErr;

    console.log(`[reanalyze] OK ${section} for "${name}"`);
    res.json({ section, data });
  } catch (err) {
    console.error(`[reanalyze] ${section} FAIL`, err);
    res.status(500).json({ error: '재분석 중 오류가 발생했습니다.' });
  }
});

export default router;

import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fetchFinancialContext } from './financialContext';
import type { IndustryBenchmarkResult, CompetitorRevenueRanking } from '../services/industryBenchmarkService';
import type { DiscoveryQuestionCandidate } from './discoveryQuestions';
import type { EdgarRawSeries } from './edgar';
import type { DartRawSeries } from './dart';
import { buildIncomeStatementRows, buildBalanceSheetRows, buildRevenueLines, getRowYearCols } from './financialsTableBuilder';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Language (output synthesis only — research/web-search stays English) ──────

export type Language = 'ko' | 'en';

const LANGUAGE_DIRECTIVE: Record<Language, string> = {
  en: 'Generate all content in English (keep company names, technology names, and tickers in their original form).',
  ko: 'Generate all content in Korean (한국어로 작성) — keep company names, technology names, and tickers in their original form (e.g. "NVIDIA", "GPU", "NASDAQ:NVDA" stay as-is, do not transliterate).',
};

const FOUNDER_LANGUAGE_DIRECTIVE: Record<Language, string> = {
  en: 'Generate all content in English (keep names and company names in their original form).',
  ko: 'Generate all content in Korean (한국어로 작성) — keep names and company names in their original form (do not transliterate).',
};

const PLACEHOLDER_MARKERS: Record<Language, { notDisclosed: string; notApplicable: string; estimated: string }> = {
  en: { notDisclosed: 'Not disclosed', notApplicable: 'Not applicable', estimated: '(estimated)' },
  ko: { notDisclosed: '확인 필요', notApplicable: '해당없음', estimated: '(추정)' },
};

// 두 언어 마커를 모두 인식해야 하는 검증 로직(Quality Gate/Golden Set)용 — 어느 언어로
// 생성됐든 "데이터 없음"으로 정확히 인식하려면 language 인자 없이도 항상 둘 다 체크한다.
const NO_DATA_MARKERS: string[] = [
  PLACEHOLDER_MARKERS.en.notDisclosed, PLACEHOLDER_MARKERS.en.notApplicable,
  PLACEHOLDER_MARKERS.ko.notDisclosed, PLACEHOLDER_MARKERS.ko.notApplicable,
];

// ── Types (V2 schema) ─────────────────────────────────────────────────────────

// L1: 공식 출처 (기업 공시, CFO/CEO 공식 발표, SEC, DART)
// L2: 신뢰 기관 보도 (Bloomberg, Reuters, WSJ, Fortune, CNBC, Sacra 등)
// L3: 추정/분석 (기관 추정치, 2차 분석) — isEstimate 항상 true
export type SourceLevel = 'L1' | 'L2' | 'L3';

export interface Source {
  index: number;
  level: SourceLevel;
  organization: string;
  date: string;
  content: string;
  isEstimate: boolean;
  url?: string;
}

export interface AnalysisSources {
  summary?: Source[];
  industry_history?: Source[];
  tech_evolution?: Source[];
  value_chain?: Source[];
  business_model?: Source[];
  competitors?: Source[];
  strategy?: Source[];
  financials?: Source[];
}

export interface SectionSource {
  index: number;
  level: SourceLevel;
  organization: string;
  content: string;
  url?: string;
}

export interface SummaryV2 {
  company: string;
  ticker: string | null;
  industry: string;
  hq: string;
  value_chain_position: 'upstream' | 'midstream' | 'downstream';
  // revenue_share(매출 비중 %) 필드는 2026-08-15부로 제거 — 웹서치 기반 자유추정치였고,
  // financials_v2.revenue_lines(EDGAR R.htm 실측)가 유일한 매출 비중 출처가 되어야 한다는
  // 원칙에 따라 이름+정성적 설명만 남긴다. Ford 사례(01번 탭 12%/05번 탭 7% 불일치) 재발 방지.
  products: { name: string; description: string }[];
  key_metrics: { label: string; value: string; trend: 'up' | 'down' | 'flat'; source_index?: number | null }[];
  top_customers: string[];
  customer_concentration?: {
    customers: { name: string; revenue_share: number }[];
    top_n: number;
    top_n_share: number;
    is_concentrated: boolean;
    trend: 'concentrating' | 'diversifying' | 'stable';
  };
  key_markets: { country: string; revenue_share: number }[];
  trigger_events?: {
    date: string;
    // 2026-08 영어 단일화 이전 캐시는 한국어 값, 이후 신규 분석은 영어 값 — 기존 레코드
    // 변환 없이 유지하므로 유니온으로 둘 다 허용.
    type: '투자유치' | '유상증자' | '대규모딜' | 'Funding' | 'Equity Offering' | 'Major Deal';
    amount: string;
    counterparty: string;
    description: string;
    source_index: number;
  }[];
  key_bullets: string[];
  bull_case: string[];
  bear_case: string[];
  oneLiner: string;
  // AE 디스커버리 콜 질문 후보(2026-08-15, ICP 인사이트 탭 2단계 통합 재료) — 3-5개,
  // 발표형 금지·질문형만. 빈 배열 허용(억지로 채우지 않음).
  discovery_questions: string[];
  sources?: SectionSource[];
}

export interface IndustryHistoryV2 {
  industry_name: string;
  timeline: {
    period: string;
    title: string;
    technology: string;
    market_need: string;
    key_players: string[];
    significance: string;
  }[];
  why_durable: string[];
  chasm_points: string[];
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
}

export interface TechEvolutionV2 {
  tech_name: string;
  stages: {
    stage: number;
    period: string;
    title: string;
    description: string;
    hype_level: 'emerging' | 'hype' | 'trough' | 'recovery' | 'mainstream';
    key_enablers: string[];
    key_players: string[];
  }[];
  current_stage: { label: string; detail: string };
  next_inflection: { label: string; detail: string };
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
}

export interface ValueChainLayerLeader {
  name: string;
  country: string;
  why_leader: string;
}

export interface ValueChainLayer {
  name: string;
  description: string;
  is_subject: boolean;
  pricing_power: 'high' | 'medium' | 'low';
  bottleneck: boolean;
  global_leaders: ValueChainLayerLeader[];
}

export interface ValueChainV2 {
  industry: string;
  layers: ValueChainLayer[];
  value_flow: string[];
  subject_position: string[];
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
}

// revenue_share(매출 비중 %) 필드는 2026-08-15부로 제거 — 웹서치 기반 자유추정치였고,
// financials_v2.revenue_lines(EDGAR R.htm 실측)가 유일한 매출 비중 출처가 되어야 한다는
// 원칙에 따라 정성적 설명만 남긴다.
export interface RevenueStream {
  name: string;
  type: 'subscription' | 'transaction' | 'service' | 'license' | 'other';
  description: string;
  operating_margin: number;
  growth_rate: number;
}

export interface BusinessSegment {
  name: string;
  characteristics: string;
}

export interface MoatV2 {
  type: string;
  strength: 'strong' | 'medium' | 'weak';
  description: string;
}

export interface BusinessModelV2 {
  revenue_streams: RevenueStream[];
  segments: BusinessSegment[];
  growth_motion: 'PLG' | 'SLG' | 'FLG' | 'hybrid';
  growth_motion_detail: string;
  unit_economics: {
    gross_margin: number;
    operating_margin: number;
    net_margin: number;
    fcf_margin: number;
    nrr: number;
  };
  moat: MoatV2[];
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
}

export interface DirectCompetitorV2 {
  name: string;
  country: string;
  market_share: string;
  strengths: string[];
  weaknesses: string[];
  vs_subject: string;
}

export interface CompetitorsV2 {
  direct: DirectCompetitorV2[];
  indirect: { name: string; threat: string }[];
  substitutes: { name: string; threat: string }[];
  competitive_position: 'leader' | 'challenger' | 'niche' | 'follower';
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
  // EDGAR 기업 전용 — Claude가 생성하지 않고 industryBenchmarkService가 순수 계산 후 병합(analyze.ts).
  revenue_ranking?: CompetitorRevenueRanking | null;
}

export interface StrategyV2 {
  corporate: {
    direction: string;
    portfolio: string;
    ma_partnerships: string[];
    geographic: string;
  };
  business: {
    direction: string;
    competitive_advantage: string;
    go_to_market: string;
    product_roadmap: string[];
  };
  financial: {
    direction: string;
    capital_allocation: string;
    investment_priority: string;
    return_target: string;
  };
  strategy_coherence: string;
  ten_year_durability: string[];
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
}

// fy{year} 컬럼은 회사마다 보유 연도 수·범위가 다르다(신규 상장사는 짧고, 오래된 기업은
// 최대 5개) — 고정된 fy2021~fy2025 리터럴 대신 인덱스 시그니처로 가변 연도를 수용한다.
export interface FinancialsV2Row {
  item: string;
  yoy?: string;
  [yearKey: string]: string | undefined;
}

export interface FinancialsV2BSRow {
  item: string;
  [yearKey: string]: string | undefined;
}

// SEC 산업 벤치마크 막대비교(2026-08-12) — server/src/lib/secIndustryBenchmark.ts가 회사 자신의
// 수치/업종 중앙값을 서버에서 직접 계산(Claude 손 안 탐), interpretation 한 줄만 별도의 작은
// Claude 호출(generateSecBenchmarkInterpretations)로 채운다. financials_v2.narrative에는 이
// 숫자들을 반복하지 않음 — 막대비교 컴포넌트가 전담(KPI 카드와의 숫자 중복 방지).
export interface SecBenchmarkComparisonItem {
  metric: string;
  label: string;
  unit: string; // '%' | 'x'
  companyValue: number;
  median: number;
  n: number;
  interpretation: string;
}

export interface SecBenchmarkComparison {
  sicCode: string;
  status: 'compared' | 'insufficient_sample';
  maxN?: number; // status==='insufficient_sample'일 때만
  items?: SecBenchmarkComparisonItem[]; // status==='compared'일 때만
}

export interface FinancialsV2 {
  income_statement: FinancialsV2Row[];
  // 회사가 실제 10-K에서 라인 구분해 공시한 매출만(축 종류·개수 무관, 서버가 R.htm에서 직접
  // 파싱 — Claude는 생성하지 않음) — 라인 구분이 없는 회사(NVIDIA 등)는 undefined, 프론트가
  // 섹션째 스킵한다. EDGAR 소스 전용(DART는 스코프 밖).
  revenue_lines?: { label: string; value: string; sharePct: number }[];
  balance_sheet: FinancialsV2BSRow[];
  cash_flow: {
    operating: string;
    investing: string;
    financing: string;
    fcf: string;
    notes: string;
  };
  key_risks: string[];
  outlook: {
    shortTerm: string;
    midLongTerm: string;
    keyRisks: string[];
  };
  key_bullets: string[];
  discovery_questions: string[];
  sources: SectionSource[];
  // EDGAR 기업 전용 — Claude가 생성하지 않고 industryBenchmarkService가 순수 계산 후 병합(analyze.ts).
  industry_benchmark?: IndustryBenchmarkResult | null;
  // EDGAR 기업 전용, SEC 전수 벌크 데이터 기반 — Claude가 생성하지 않고 analyze.ts가 병합.
  sec_benchmark_comparison?: SecBenchmarkComparison | null;
}

export interface FounderV2 {
  founders: {
    name: string;
    title: string;
    education: string;
    major: string;
  }[];
  career_trajectory: {
    period: string;
    company: string;
    role: string;
  }[];
  founding_history: {
    type: '1st_time' | 'serial';
    previous_ventures: {
      name: string;
      result: 'exit' | 'closed' | 'operating';
      exit_type?: 'M&A' | 'IPO' | null;
    }[];
  };
  reputation: {
    sns_style: string;
    media_exposure: string;
    blind_glassdoor: string;
  };
  network: {
    investors: string[];
    advisors_board: string[];
    cofounders: string[];
  };
  key_bullets: string[];
  discovery_questions: string[];
  sources?: SectionSource[];
}

export interface CrossIndustryNudgeV1 {
  industry_pain: {
    title: string;
    description: string[];
    financial_impact_question: string;
  };
  cross_industry_example: {
    source_industry: string;
    case_name: string;
    solution_description: string;
  };
  key_bullets: string[];
  sources: SectionSource[];
}

export interface AnalysisData {
  summary_v2: SummaryV2;
  // 온디맨드 전환(2026-07) — 초기 배치에서 생성하지 않음. null이면 "아직 생성 안 됨"을 의미하며
  // 프론트가 "pain 진단 시작" 버튼 클릭 시 /api/analyze/:id/pain-diagnosis로 그때 생성함
  // (2026-08 — 기존 탭별 자동생성 방식에서 명시적 버튼 트리거 방식으로 전환).
  industry_history_v2: IndustryHistoryV2 | null;
  tech_evolution_v2: TechEvolutionV2 | null;
  value_chain_v2: ValueChainV2;
  business_model_v2: BusinessModelV2;
  competitors_v2: CompetitorsV2;
  // 2026-08 신규 — 배치2에서 business_model_v2/competitors_v2와 함께 생성(pain 진단 그룹의
  // "넛지" 탭). SIC/KSIC 업종 pain 1개 + 타산업 해결사례 1개, 재무임팩트는 질문형으로만.
  cross_industry_nudge_v1: CrossIndustryNudgeV1;
  strategy_v2: StrategyV2;
  financials_v2: FinancialsV2;
  founder_v2: FounderV2;
  sources: AnalysisSources;
}


// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_ANALYSIS_DATA: AnalysisData = {
  summary_v2: {
    company: '', ticker: null, industry: '', hq: '',
    value_chain_position: 'midstream',
    products: [], key_metrics: [], top_customers: [], key_markets: [],
    key_bullets: [], bull_case: [], bear_case: [], oneLiner: '', discovery_questions: [], sources: [],
  },
  industry_history_v2: { industry_name: '', timeline: [], why_durable: [], chasm_points: [], key_bullets: [], discovery_questions: [], sources: [] },
  tech_evolution_v2: { tech_name: '', stages: [], current_stage: { label: '', detail: '' }, next_inflection: { label: '', detail: '' }, key_bullets: [], discovery_questions: [], sources: [] },
  value_chain_v2: { industry: '', layers: [], value_flow: [], subject_position: [], key_bullets: [], discovery_questions: [], sources: [] },
  business_model_v2: {
    revenue_streams: [], segments: [],
    growth_motion: 'hybrid', growth_motion_detail: '',
    unit_economics: { gross_margin: 0, operating_margin: 0, net_margin: 0, fcf_margin: 0, nrr: 0 },
    moat: [],
    key_bullets: [], discovery_questions: [], sources: [],
  },
  competitors_v2: { direct: [], indirect: [], substitutes: [], competitive_position: 'niche', key_bullets: [], discovery_questions: [], sources: [] },
  cross_industry_nudge_v1: {
    industry_pain: { title: '', description: [], financial_impact_question: '' },
    cross_industry_example: { source_industry: '', case_name: '', solution_description: '' },
    key_bullets: [], sources: [],
  },
  strategy_v2: {
    corporate: { direction: '', portfolio: '', ma_partnerships: [], geographic: '' },
    business: { direction: '', competitive_advantage: '', go_to_market: '', product_roadmap: [] },
    financial: { direction: '', capital_allocation: '', investment_priority: '', return_target: '' },
    strategy_coherence: '', ten_year_durability: [], key_bullets: [], discovery_questions: [], sources: [],
  },
  financials_v2: {
    income_statement: [], balance_sheet: [],
    cash_flow: { operating: '', investing: '', financing: '', fcf: '', notes: '' },
    key_risks: [],
    outlook: { shortTerm: '', midLongTerm: '', keyRisks: [] },
    key_bullets: [], discovery_questions: [], sources: [],
  },
  founder_v2: {
    founders: [],
    career_trajectory: [],
    founding_history: { type: '1st_time', previous_ventures: [] },
    reputation: { sns_style: '-', media_exposure: '-', blind_glassdoor: '-' },
    network: { investors: [], advisors_board: [], cofounders: [] },
    key_bullets: [],
    discovery_questions: [],
    sources: [],
  },
  sources: {},
};

// ── Low-level helpers ─────────────────────────────────────────────────────────

// SEC EDGAR Archives 전체 원문 차단 — 수십 MB HTML 다운로드 방지
const BLOCKED_URL_PATTERNS = [
  /sec\.gov\/Archives\//i,         // 전체 10-K/10-Q 원문 (수십 MB)
  /sec\.gov\/cgi-bin\/browse-edgar/i, // 검색 결과 페이지 (불필요)
];

function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some(p => p.test(url));
}

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000); // 10s → 5s
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return `HTTP ${res.status} — could not fetch ${url}`;

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/pdf')) return `PDF document at ${url} — cannot extract text directly`;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, nav, footer, header, aside, noscript, iframe, .ad, .ads, .advertisement, [aria-hidden="true"]').remove();

    // Prefer semantic main content
    const main = $('main, article, [role="main"], .content, #content, .article-body, .post-body').first();
    const raw = (main.length ? main : $('body')).text();
    const text = raw.replace(/\s+/g, ' ').trim();

    return text.length > 0 ? text.slice(0, 10_000) : `No readable content found at ${url}`;
  } catch (err: any) {
    return `Error fetching ${url}: ${err.message}`;
  }
}

const WEB_SEARCH_TOOL = [
  { type: 'web_search_20250305', name: 'web_search' },
  {
    name: 'fetch_url',
    description: 'Fetch and read the full text content of a specific web page. Use this after web_search to get complete content from important sources — SEC filings, annual reports, IR pages, news articles, etc. — instead of relying on short snippets.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL to fetch (https://...)' },
      },
      required: ['url'],
    },
  },
] as any;

async function runWithWebSearch(
  systemPrompt: string | { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[],
  userMessage: string,
  model: string,
  maxRounds = 10,
  maxTokens = 16000,
  label = 'research',
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  let lastTexts = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: WEB_SEARCH_TOOL,
      messages,
    });
    logCacheUsage(label, response.usage);

    const texts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n\n');
    if (texts) lastTexts = texts;

    console.log(`[gatherResearch][${label}] round ${round + 1}/${maxRounds} stop_reason=${response.stop_reason}`);

    if (response.stop_reason === 'end_turn') return texts;

    messages.push({ role: 'assistant', content: response.content });

    const toolUseBlocks = (response.content as Anthropic.ContentBlock[])
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (toolUseBlocks.length === 0) {
      if (texts) return texts;
      continue;
    }

    // web_search_20250305 is server-side — pass only tool_use_id (no content).
    // fetch_url is client-side — fetch the page and return its content.
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (b) => {
        if (b.name === 'fetch_url') {
          const { url } = b.input as { url: string };
          if (isBlockedUrl(url)) {
            console.log(`[fetch_url][${label}] BLOCKED ${url}`);
            return { type: 'tool_result' as const, tool_use_id: b.id, content: `Blocked: ${url} — SEC full filing skipped. Use web_search for financial summaries (Yahoo Finance, Macrotrends, StockAnalysis) instead.` };
          }
          console.log(`[fetch_url][${label}] ${url}`);
          const content = await fetchUrlContent(url);
          return { type: 'tool_result' as const, tool_use_id: b.id, content };
        }
        return { type: 'tool_result' as const, tool_use_id: b.id };
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  // maxRounds 소진 — 예외를 던지면 analyzeCompany 전체가 죽는다 (2026-07-06 삼성전기
  // 사고: gatherResearch1/2가 이 함수를 직접 await하며 runBatch의 try/catch 밖에 있어
  // 여기서 throw하면 배치 격리 없이 전체 분석이 중단됨). Quality Gate 원칙과 동일하게
  // 그 시점까지 모은 부분 결과로 폴백 — 호출부(gatherResearch1/2)에도 방어적으로
  // try/catch를 둬 다른 종류의 에러(네트워크 등)까지 이중으로 격리한다.
  console.warn(`[gatherResearch][${label}] maxRounds(${maxRounds}) 소진 — 부분 결과로 폴백`);
  return lastTexts || `[${label}] 리서치 라운드 초과로 데이터를 완전히 수집하지 못함 — 확보된 정보만으로 진행.`;
}

function extractJson<T>(raw: string, label = 'response'): T | null {
  const text = raw.trim();

  try { return JSON.parse(text) as T; } catch {}

  const fenced = text.match(/```(?:json|typescript|js)?\s*\n?([\s\S]*?)\n?```/s);
  if (fenced?.[1]) {
    const inner = fenced[1].trim();
    try { return JSON.parse(inner) as T; } catch {}
    const innerBlock = inner.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (innerBlock) {
      try { return JSON.parse(innerBlock[0]) as T; } catch {}
    }
  }

  const block = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (block) {
    try { return JSON.parse(block[0]) as T; } catch {}
  }

  console.error(`[claude] ${label}: JSON parse failed. Preview:\n${text.slice(0, 400)}`);
  dumpParseFailure(label, text);
  return null;
}

// 2026-08-15 디버깅용 — JSON 파싱 실패 시 원문 전체를 파일로 남긴다. 위 console.error의
// preview는 400자로 잘려 실제 문법 오류 위치를 못 보여준다(NVIDIA strategy_v2가
// stop_reason=end_turn인데도 파싱 실패한 사례에서 원인 특정이 막혔던 게 계기 — 이 케이스는
// 아직 미해결, 다음 재현 시 이 파일로 바로 확인). 디버깅 편의 기능이라 파일 쓰기가
// 실패해도(권한 등) 본 요청 흐름을 막지 않는다 — 조용히 무시.
const PARSE_FAIL_LOG_DIR = path.resolve(__dirname, '../../debug-logs/parse-failures');
function dumpParseFailure(label: string, text: string): void {
  try {
    fs.mkdirSync(PARSE_FAIL_LOG_DIR, { recursive: true });
    const file = path.join(PARSE_FAIL_LOG_DIR, `${label}-${Date.now()}.txt`);
    fs.writeFileSync(file, text, 'utf8');
    console.error(`[claude] ${label}: 파싱 실패 원문 전체 저장됨 → ${file}`);
  } catch (writeErr) {
    console.error(`[claude] ${label}: 디버깅 파일 저장 실패`, writeErr);
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// 프롬프트 캐싱 실측용(2026-08-13 감사 계기) — 호출 지점마다 cache_read/cache_write가
// 실제로 찍히는지, 정적 프리픽스가 모델 최소 캐시 크기를 넘는지 grep 가능한 로그로 남긴다.
// `grep "\[cache-stats\]"`로 전 호출 지점을 한 번에 확인 가능.
function logCacheUsage(label: string, usage: { input_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }) {
  console.log(`[cache-stats][${label}] input=${usage.input_tokens} cache_read=${usage.cache_read_input_tokens ?? 0} cache_write=${usage.cache_creation_input_tokens ?? 0}`);
}

// ── Section prompts ───────────────────────────────────────────────────────────

function sectionSystem(language: Language): string {
  const m = PLACEHOLDER_MARKERS[language];
  const schemaExampleNote = language === 'ko'
    ? `\n[Schema examples are structural, not literal]\nThe JSON schema below shows example string values for guidance (e.g. "item":"Revenue", "item":"Operating Income") — these illustrate what KIND of value that field expects, not a literal string to copy. Always write the actual value translated into Korean (e.g. "매출", "영업이익"), never echo the schema's English example text verbatim just because it appeared in the instructions.\n`
    : '';
  return `You are an expert company analyst. Using the provided research data, analyze only the specified section.
Rules: Output pure JSON only — no markdown, no code blocks, no extra commentary. ${LANGUAGE_DIRECTIVE[language]}
${schemaExampleNote}
[Company naming]
- Use the commonly known brand name. Never use the legal holding-company name. Example: Google (not Alphabet), Meta (not Facebook).
- Never mix parent and subsidiary names — use one consistent name for the same company throughout the analysis.
- Subsidiaries can keep their own name. Example: Google DeepMind, Instagram (the parent is always Meta).
- For Korean companies, use the standard English name used in English-language business press. Example: Samsung Electronics, Kakao, Naver.

[key_bullets principles]
Each section's 3 key_bullets must say something only that section can say.
Don't repeat content another section already covers (e.g., don't put financial figures in the summary tab's bullets).
No investor/stock-price/valuation/return language. Write from a business practitioner's point of view.
Follow each section's own bullets guidance.

[Data reliability principles]
1. Only state numbers you can actually confirm — from a traceable source (10-K, IR materials, DART, etc.).
2. Any estimated or inferred number must end with the label "${m.estimated}". Example: "15.2% ${m.estimated}".
3. If a data point isn't available, return "${m.notDisclosed}". Never make one up.
   Exception: if the provided context explicitly marks a metric as not applicable / "structurally not
   reported" (e.g., a holding company or insurer whose SEC filings never tag operating income because of its
   segment structure), return "${m.notApplicable}" for that metric instead of "${m.notDisclosed}" — "${m.notDisclosed}"
   means "we looked but couldn't confirm it"; "${m.notApplicable}" means "this line item doesn't structurally
   exist for this company." Keep that distinction.
   Important: the context you're given may itself contain a literal marker word for these two cases —
   in either English ("Not disclosed"/"Not applicable") or Korean ("확인 필요"/"해당없음"), regardless of
   which language you were asked to write this analysis in. That's just the context-builder's own internal
   instructional wording, not a value to echo verbatim. No matter which literal word the context happens to
   use, your OUTPUT marker must always be "${m.notDisclosed}" / "${m.notApplicable}" — translate the
   context's marker into the marker above, never copy its literal wording into your output.
4. Don't state specific figures like regional revenue mix or named customers unless they're grounded in
   disclosed data.
5. Small or private companies can have real data gaps — say so plainly instead of filling the gap.
6. When you cite a URL in any sources[] array, it must be the exact URL as it appeared in the web_search
   results you were given — copy it character-for-character. Never retype, shorten, "clean up," or
   reconstruct a URL from memory of what a site's URL pattern usually looks like, even for a well-known
   site (e.g. a government agency's domain, a company's investor-relations path). If you're not certain
   of the exact URL for a fact, either use the exact URL from a search result that does support it, or
   set url to null — a missing URL is far better than a wrong one.
7. When the context's [Disclosed data] block already states a figure for a specific line item and fiscal
   year, copy that number exactly as given — don't round it, recompute it, derive a margin/ratio from a
   different year's figures, or substitute a number from an adjacent year. Treat that block as ground truth
   to transcribe, not raw material to calculate from. Only compute a derived figure (e.g. a YoY % or a
   margin) yourself when the underlying inputs for that exact same fiscal year are both present in the
   context — never mix inputs from different years to produce a number that looks like it belongs to one.
8. Never describe a growth rate as an "N-year average" or CAGR unless you have at least N-1 genuine
   adjacent-year YoY figures to back it — if the context's [Growth rate data availability] note says only
   one YoY comparison exists (or the disclosed data only spans two adjacent fiscal years), describe it as
   "grew X% YoY" / "전년 대비 X% 증가," never as an "N-year average" or "N개년 평균." Also: a growth-rate
   number belongs only to the specific thing it was calculated for (e.g. one product line's revenue, or the
   company's total revenue) — never restate a number from one scope (a single revenue stream, a single
   segment) as if it described a different scope (total company growth), even when the numbers happen to
   be close. If you're unsure which scope a number in the context describes, don't reuse it — describe
   growth qualitatively instead of attaching a borrowed percentage to it.

[Tone & voice]
Write like a sharp US B2B practitioner — Sales, BD, or Strategy — briefing a peer, not like an equity
research report. Aim for Gong / HubSpot / Salesforce blog voice, not McKinsey deck voice.
- Use real sales/BD vocabulary where it fits naturally: leverage, GTM motion, land-and-expand, ICP, champion,
  buying committee, deal cycle, pipeline, ACV, renewal risk. Use it where a practitioner actually would —
  don't force it into every sentence.
- Investor vocabulary stays banned: no "valuation multiple," no "P/E," no ROE/ROIC/owner-earnings framing,
  no stock-price talk.
- No academic or overly formal tone. Skip hedges like "it can be argued that" or "it is worth noting that."
- Keep sentences short and direct. Every sentence should connect to a business decision — cut anything that's
  just describing, not informing a decision.`;
}

const SECTION_SCHEMAS: Record<string, string> = {
  summary_v2: `Output only a JSON object matching this schema:
{"company":"Company name","ticker":"TradingView-format ticker or null","industry":"Industry classification","hq":"HQ city, country","value_chain_position":"upstream|midstream|downstream","products":[{"name":"Product/segment name","description":"What it covers, 1 line"}],"key_metrics":[{"label":"Revenue","value":"figure — 'Not disclosed' if unconfirmed","trend":"up|down|flat","source_index":number or null},{"label":"Operating margin","value":"figure% — 'figure% (estimated)' if estimated","trend":"up|down|flat","source_index":number or null},{"label":"Market cap","value":"figure","trend":"up|down|flat","source_index":number or null},{"label":"YoY growth","value":"figure%","trend":"up|down|flat","source_index":number or null}],"top_customers":["Only customer names confirmed by disclosure. Empty array [] if uncertain"],"customer_concentration":{"customers":[{"name":"Customer name","revenue_share":number confirmed by disclosure}],"top_n":number,"top_n_share":number,"is_concentrated":true,"trend":"concentrating|diversifying|stable"},"key_markets":[{"country":"Country","revenue_share":number confirmed by disclosure only — omit the entry if unavailable}],"trigger_events":[{"date":"YYYY-MM-DD or YYYY-MM","type":"Funding|Equity Offering|Major Deal","amount":"amount — empty string if unconfirmed","counterparty":"counterparty (investor/partner name) — empty string if unconfirmed","description":"1-line description, include [n] source markers","source_index":number}],"key_bullets":["Why this company is distinct in this market — core positioning, 8 words or fewer","This company's core growth driver, 8 words or fewer","This company's biggest execution risk, 8 words or fewer"],"bull_case":["Growth momentum bullet — market expansion, partnership, or competitive edge point, 1 line","2nd growth momentum bullet, 1 line"],"bear_case":["Key risk bullet — execution, competitive, regulatory, or market risk, 1 line","2nd key risk bullet, 1 line"],"oneLiner":"1-2 sentence read on where this company stands right now, written so a strategy or sales practitioner gets it immediately","discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
discovery_questions: 3-5 candidate discovery-call questions an AE could ask on a call, grounded only in this section's own data. Phrase each as something you're curious to ask — never a statement of a fact you already know. Bad: "70% of revenue is concentrated in Product A." Good: "Is there a deliberate push to reduce that revenue concentration?" — state the consequence a fact implies, not the fact itself. If trigger_events is non-empty, turn each event's implication into a question this way — Bad: "You raised a Series C recently." Good: "Has anything changed in team structure or priorities since that round?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
top_customers: only names confirmed via IR or disclosure. Empty array if it's a guess. key_markets.revenue_share: if there's no disclosed figure, drop that country's entry entirely.
products.description: 1 short line on what that product/segment actually does or covers — never state, imply, or round off a revenue-share percentage or dollar figure here (e.g. never write "roughly half of revenue" or "the smaller of the two segments"). The financials tab's revenue_lines section (server-computed straight from the 10-K, not you) is the only place revenue mix appears now — this section is name + what-it-is only.
key_metrics.value must contain only the figure itself (e.g. "$215.9B", "38%", "38% (estimated)") — never append a fiscal year or data-source name in parentheses like "(EDGAR, FY2026)"; that detail belongs in the linked source instead. key_metrics.source_index must point at the index of the entry in this section's own sources[] array that backs that figure — put the fiscal year in that source's content (e.g. "FY2026 10-K revenue disclosure") so the footnote carries it. Use null only if the figure genuinely can't be attributed to any listed source.
ticker must be returned in TradingView format: US NASDAQ → "NASDAQ:SYMBOL" (e.g. NASDAQ:NVDA), US NYSE → "NYSE:SYMBOL" (e.g. NYSE:PLTR), Korea KOSPI → "KRX:code" (e.g. KRX:005930), Korea KOSDAQ → "KOSDAQ:code" (e.g. KOSDAQ:388130), null if private or uncertain.
bull_case/bear_case: 2-4 short bullets each, one distinct point per bullet — never restate the same point twice worded differently. Write from a strategy/practitioner point of view. No stock price, valuation, or investment-return language. If a bullet draws on a source, put the [n] marker at the very end of that bullet.
customer_concentration: return null outright if per-customer revenue share can't be confirmed from disclosure or IR. Never use 0% or an unconfirmable number. The customers array also only includes disclosure-confirmed figures — empty array [] if uncertain. top_n_share: combined share of the top N customers (return the whole object as null if not disclosed). is_concentrated: true if top_n_share >= 30.
trigger_events: base this only on the context's [Recent trigger event candidates] section (EDGAR 8-K excerpts or DART material-event filings) and recent funding/partnership info from web research — never speculate. Only events within the last 12 months, most recent first, max 3. If there's no evidence-backed event, return an empty array []. Leave amount/counterparty as an empty string if the source doesn't confirm them, but always fill date/type/description.
oneLiner rule: don't just list numbers — explain in narrative form why the number matters. Style example: "Revenue's up, margins aren't — this is a company mid-buildout, pouring cash into infrastructure before it pays off."`,

  industry_history_v2: `Output only a JSON object matching this schema:
{"industry_name":"Industry name","timeline":[{"period":"Time period","title":"Era title, 5 words or fewer","technology":"Core technology, 1 line","market_need":"Market need, 1 line","key_players":["Company name (country)"],"significance":"Why it matters, 1 line"}],"why_durable":["Reason this industry endures, 1 line","2nd reason it endures, 1 line"],"chasm_points":["Chasm moment and why, 1 line each, max 3"],"key_bullets":["This industry's single most decisive historical turning point, 8 words or fewer","What stage of development the industry is at now, 8 words or fewer","A structural risk unique to this industry, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (the industry's history/durability/chasm points) — where the analyzed company might sit relative to a historical pattern. Phrase each as something you're curious to ask, never a stated fact. Bad: "This industry consolidated around 3 players after 2015." Good: "Where do you see yourselves positioned as this industry keeps consolidating?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
timeline: 4-6 entries in chronological order. Tag important facts in the body with [n] source markers.
why_durable: 2-4 short bullets, one distinct reason per bullet. If a bullet draws on a source, put the [n] marker at the very end of that bullet.
Each timeline entry covers only industry-wide technology, market, or regulatory turning points. Never include a single company's funding round, VC raise, or M&A event — unless that company's tech/product launch itself reshaped the industry.
key_players: list only companies that were actually active in the market at that time. Never include VCs, private equity, financial investors, or accelerators.
Sourcing discipline: this section is about the INDUSTRY as a whole, not the analyzed company. The analyzed
company's own official materials (10-K, IR site, press releases) may only back facts specifically ABOUT that
company — never cite them for an industry-wide fact (a technology's origin, a competitor's product, a broad
market or regulatory trend). Industry-wide claims need a real external source you actually found via web
search (a tech-history reference, an industry report, trade press, Wikipedia, etc.) — a different, specific
source per era where the claim differs, not the same one or two sources copy-pasted across every entry. If
you can't find a distinct source backing a specific era's claim, search again rather than reusing an
unrelated citation or leaving it unsourced.`,

  tech_evolution_v2: `Output only a JSON object matching this schema:
{"tech_name":"Core technology name","stages":[{"stage":1,"period":"Time period","title":"Stage title, 5 words or fewer","description":"Description, 2 sentences max","hype_level":"emerging|hype|trough|recovery|mainstream","key_enablers":["Key enabler, max 3"],"key_players":["Company name, max 4"]}],"current_stage":{"label":"Short 2-5 word phrase naming the current stage","detail":"1 sentence of supporting detail"},"next_inflection":{"label":"Short 2-5 word phrase naming the next inflection point","detail":"1 sentence of supporting detail"},"key_bullets":["Current maturity stage on the Hype Cycle, 8 words or fewer","The key trigger for the next inflection point, 8 words or fewer","The main barrier blocking wider adoption, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (the technology's maturity stage, next inflection, adoption barrier). Phrase each as something you're curious to ask, never a stated fact. Bad: "This tech is still in the trough of disillusionment." Good: "What's it going to take for this to cross into mainstream adoption for you?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
stages: 4-6 entries. Tag important facts in the body with [n] source markers.
current_stage/next_inflection: label is a short noun phrase (not a full sentence), detail is exactly 1 supporting sentence — don't restate the label inside detail.
Sourcing discipline: this section is about the TECHNOLOGY's evolution industry-wide, not the analyzed
company. The analyzed company's own official materials (10-K, IR site, press releases) may only back facts
specifically ABOUT that company — never cite them for an industry-wide fact (when a technology emerged, a
competitor's release, a broad adoption trend). Industry-wide claims need a real external source you actually
found via web search (a tech-history reference, an industry report, trade press, Wikipedia, etc.) — a
different, specific source per stage where the claim differs, not the same one or two sources copy-pasted
across every entry. If you can't find a distinct source backing a specific stage's claim, search again
rather than reusing an unrelated citation or leaving it unsourced.`,

  value_chain_v2: `Output only a JSON object matching this schema:
{"industry":"Industry name","layers":[{"name":"Layer name","description":"Description, 1 line","is_subject":false,"pricing_power":"high|medium|low","bottleneck":false,"buyer":false,"global_leaders":[{"name":"Company name","country":"Country","why_leader":"Why it leads, 1 line"}]}],"value_flow":["Pricing pass-through mechanism point, 1 line","2nd point, 1 line"],"subject_position":["The analyzed company's position point, 1 line","2nd point, 1 line"],"key_bullets":["Where this company is strongest in the value chain, 8 words or fewer","The basis for its pricing power / negotiating leverage, 8 words or fewer","The biggest risk that comes from this value-chain structure, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (pricing power, bottlenecks, the company's value-chain position). Phrase each as something you're curious to ask, never a stated fact. Bad: "You're squeezed by a bottleneck upstream." Good: "How much leverage do you actually have in pricing conversations with that upstream layer?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
layers: 4-6 entries. Set is_subject:true on the layer the analyzed company belongs to.
For end-consumer/buyer layers (e.g. consumers, enterprise customers, government), set buyer:true and omit the pricing_power field.
Only set pricing_power:"high"|"medium"|"low" on supplier, manufacturing, or distribution layers.
value_flow/subject_position: 2-4 short bullets each, one distinct point per bullet. If a bullet draws on a source, put the [n] marker at the very end of that bullet. Any URL confirmed via web search must go in sources[].url.`,

  business_model_v2: `Output only a JSON object matching this schema:
{"revenue_streams":[{"name":"Revenue stream","type":"subscription|transaction|service|license|other","description":"What this stream covers, 1 line","operating_margin":number,"growth_rate":number}],"segments":[{"name":"Segment name","characteristics":"Characteristics, 1 line"}],"growth_motion":"PLG|SLG|FLG|hybrid","growth_motion_detail":"How growth works, 2 sentences max","unit_economics":{"gross_margin":number,"operating_margin":number,"net_margin":number,"fcf_margin":number,"nrr":number},"moat":[{"type":"Moat type","strength":"strong|medium|weak","description":"Moat description, 1 line"}],"key_bullets":["The core of this company's revenue engine — why it makes money, 8 words or fewer","The core moat holding up the business model, 8 words or fewer","A structural weakness or collapse risk in the business model, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (revenue mix, growth motion, moat, unit economics). Phrase each as something you're curious to ask, never a stated fact. Bad: "Your NRR looks soft." Good: "What's driving expansion revenue right now versus new-logo growth?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
Tag important facts in growth_motion_detail/moat.description with [n] source markers. Any URL confirmed via web search must go in sources[].url.
operating_margin/growth_rate (inside revenue_streams) and unit_economics' gross_margin/operating_margin/net_margin/fcf_margin/nrr are numeric fields — return 0 if unconfirmable. Never use text like "Not disclosed"/"N/A" or a sentinel like -999 (that produces invalid JSON).
revenue_streams.description / segments.characteristics: 1 short line on what that stream/segment actually is or does — never state, imply, or round off a revenue-share percentage or dollar figure (e.g. never write "the majority of revenue" or "a small but growing stream"). Revenue mix now lives only in the financials tab's revenue_lines section (server-computed straight from the 10-K, not you).`,

  cross_industry_nudge_v1: `Output only a JSON object matching this schema:
{"industry_pain":{"title":"Pain point title, 8 words or fewer","description":["Pain point bullet common across the analyzed company's industry (by SIC/KSIC classification) as a whole — not specific to this one company, 1 line","2nd bullet, 1 line"],"financial_impact_question":"A question only — never a stated number, percentage, or dollar-figure conclusion — about how this pain point could hit the business financially. Example: 'How much of quarterly revenue could this bottleneck be putting at risk?'"},"cross_industry_example":{"source_industry":"The OTHER industry this solution came from — must be genuinely different from the analyzed company's own industry","case_name":"The company or case name that solved it","solution_description":"How that other industry solved an analogous operational problem, 2 sentences max"},"key_bullets":["Why this pain point matters right now for this company, 8 words or fewer","The core mechanism behind the cross-industry solution, 8 words or fewer","The single biggest condition for applying this solution here, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://..."}]}
Determine the analyzed company's industry (SIC/KSIC classification) from the provided context first. industry_pain.description: 2-4 short bullets, one distinct point per bullet, describing a pain point shared across that industry broadly, not a problem unique to this one company. cross_industry_example.source_industry must differ from the analyzed company's own industry — find a company in a different industry that solved a genuinely analogous operational problem. financial_impact_question must be phrased strictly as a question — never assert a number, percentage, or dollar-figure impact as fact. Both facts need at least one real, verifiable source URL in sources[].url — a real URL is required here (unlike other sections, don't leave it null); if you can't find a real source URL for a fact, drop that fact rather than inventing a URL. Tag industry_pain bullets and the solution_description with [n] source markers (bullets: marker at the end of the bullet; solution_description: marker at the end of the sentence it supports).`,

  competitors_v2: `Output only a JSON object matching this schema:
{"direct":[{"name":"Competitor name","country":"Country","market_share":"share% (estimates OK)","strengths":["Strength, 1 line, max 3 — strategy/technology/market-power focused"],"weaknesses":["Weakness, 1 line, max 2 — structural weaknesses"],"vs_subject":"1-line positioning gap vs. the analyzed company — format like 'stronger on X, weaker on Y'"}],"indirect":[{"name":"Indirect competitor","threat":"Threat, 1 line"}],"substitutes":[{"name":"Substitute","threat":"Threat, 1 line"}],"competitive_position":"leader|challenger|niche|follower","key_bullets":["This company's competitive position — where it's strongest and weakest, 8 words or fewer","The clearest strategic differentiator versus competitors, 8 words or fewer","The most threatening competitive risk — where it could get flipped, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (competitive position, direct competitors, differentiation gaps). Phrase each as something you're curious to ask, never a stated fact. Bad: "Competitor X is undercutting you on price." Good: "How are you thinking about competing on price versus X right now?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
direct: 3-5 global direct competitors required. If there's no public market_share figure, give an estimate tagged "(estimated)"; use "-" only when it's genuinely unknowable. vs_subject must not be a plain list — write one specific line on the strategic positioning gap (price, channel, technology, customer base, etc.). Tag important facts in the body with [n] source markers. Any URL confirmed via web search must go in sources[].url.`,

  strategy_v2: `Output only a JSON object matching this schema:
{"corporate":{"direction":"Corporate strategy, 1 line","portfolio":"Portfolio direction, 1 line","ma_partnerships":["M&A example, 1 line, max 3"],"geographic":"Geographic expansion, 1 line"},"business":{"direction":"Business strategy, 1 line","competitive_advantage":"Competitive edge, 1 line","go_to_market":"GTM strategy, 1 line","product_roadmap":["Roadmap item, 1 line, max 4"]},"financial":{"direction":"Financial strategy, 1 line","capital_allocation":"Capital allocation, 1 line","investment_priority":"Investment priority, 1 line","return_target":"Target return metric, 1 line"},"strategy_coherence":"How the 3 strategies connect, written as 2-3 short paragraphs separated by a blank line (\\n\\n) — not bullets","ten_year_durability":["10-year durability point, 1 line","2nd point, 1 line"],"key_bullets":["The core direction of corporate strategy in one line, 8 words or fewer","Business strategy — how it wins, 8 words or fewer","Financial strategy — where it's betting, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (corporate/business/financial strategy, coherence, durability). Phrase each as something you're curious to ask, never a stated fact. Bad: "You're betting heavily on geographic expansion." Good: "What's the biggest thing that has to go right for that geographic push to pay off?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.
strategy_coherence is the only field in this schema written as full paragraph prose — it's a narrative showing how the 3 strategy blocks above connect, so breaking it into bullets would just repeat what those blocks already say. Do NOT convert it to bullets — instead, split it into 2-3 short paragraphs separated by a blank line ("\n\n" inside the JSON string), each 2-4 sentences: paragraph 1 covers how the 3 strategy blocks connect to each other; paragraph 2 covers the financial consequence that connection produces; an optional paragraph 3 covers remaining risk or preconditions, only if there's something concrete worth flagging (omit it rather than padding). One long unbroken paragraph is no longer acceptable output for this field. Every [n] marker in it must sit at the very end of the sentence it supports — never mid-sentence; if a sentence draws on two sources, put both markers together at the end (e.g. "...as a result [1][2].").
ten_year_durability: 2-4 short bullets, one distinct point per bullet (e.g. one bullet per structural tailwind/headwind, not a running paragraph). If a bullet draws on a source, put the [n] marker at the very end of that bullet. Any URL confirmed via web search must go in sources[].url.`,

  financials_v2: `Output only a JSON object matching this schema:
{"income_statement":[{"item":"Revenue","fy2021":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2022":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2023":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2024":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2025":"disclosed figure or 'figure (estimated)' or 'Not disclosed' or 'Not applicable'","yoy":"▲N% or ▼N% or —"},{"item":"Gross Profit","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"Operating Income","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"Net Income","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""}],"balance_sheet":[{"item":"Cash & Equivalents","fy2023":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2024":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2025":"disclosed figure or 'figure (estimated)' or 'Not disclosed' or 'Not applicable'"},{"item":"Total Assets","fy2023":"","fy2024":"","fy2025":""},{"item":"Total Liabilities","fy2023":"","fy2024":"","fy2025":""},{"item":"Total Equity","fy2023":"","fy2024":"","fy2025":""}],"cash_flow":{"operating":"disclosed figure or 'Not disclosed'","investing":"disclosed figure or 'Not disclosed'","financing":"disclosed figure or 'Not disclosed'","fcf":"disclosed figure or 'figure (estimated)' or 'Not disclosed'","notes":"anything notable, or an empty string"},"key_risks":["Risk, 1 line, max 5"],"outlook":{"shortTerm":"Short-term outlook (3-6 months) — include a symbol: ○ positive / △ neutral / ▼ negative","midLongTerm":"Mid/long-term outlook (1-3 years) — include a symbol: ○ positive / △ neutral / ▼ negative","keyRisks":["Key risk, 1 line, max 3"]},"key_bullets":["The financial metric and trend most worth flagging, 8 words or fewer","Core state of profitability and cash flow, 8 words or fewer","The single biggest risk in the financial structure, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (income statement trend, cash flow, key risks, outlook). Phrase each as something you're curious to ask, never a stated fact or number. Bad: "Operating margin dropped 4 points this year." Good: "What's driving the margin compression — is it a deliberate investment phase or cost pressure?" No investor language (no valuation/P/E/ROE framing). Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one. (Note: industry-benchmark deviations are handled separately by the server after this call — don't try to reference them here.)
income_statement/balance_sheet: never leave a cell blank — if there's no disclosed figure, it must be 'Not disclosed'. Exception: if the context's [Years missing from source data] section explicitly marks a given year as having no data (the source filing has no financial statement at all for that year), label that year 'Not applicable' instead of 'Not disclosed' — "Not disclosed" means "we looked but couldn't confirm it," "Not applicable" means "that year's data doesn't exist in the first place." Keep the distinction. Estimated values must always use the 'number (estimated)' format. Do not add an EBITDA row — it is intentionally excluded (D&A tagging isn't consistent enough across companies to compute it reliably). Gross Profit must be the figure as directly disclosed/tagged by the company — never derive it yourself as Revenue minus Cost of Revenue; if it isn't directly disclosed, that's 'Not disclosed' or 'Not applicable', not a calculation.
Tag key figures with [n] source markers.
outlook rules: base it on the financial data. No baseless optimism. shortTerm/midLongTerm must always be prefixed with a ○/△/▼ symbol.`,

  sources: `Output only a JSON object matching this schema. Organize the sources actually referenced during research, by tab:
{"summary":[{"index":1,"level":"L1","organization":"Org name","date":"Mon YYYY","content":"Key point, 1 line","isEstimate":false,"url":"https://... or null"}],"industry_history":[...],"tech_evolution":[...],"value_chain":[...],"business_model":[...],"competitors":[...],"strategy":[...],"financials":[...]}

Reliability tier criteria:
- L1: Company official statements, CFO/CEO blog posts, SEC 10-K/10-Q, DART filings, company IR materials
- L2: Bloomberg, Reuters, WSJ, Fortune, CNBC, Financial Times, HSBC, Sacra, Menlo Ventures, CB Insights, Gartner
- L3: Institutional estimates, secondary analysis, general news/blogs — always isEstimate:true

Rules:
- 1-5 sources per tab. Include only sources actually referenced (empty array [] if none).
- organization is just the source org's name (e.g. "Bloomberg", "OpenAI (official)", "SEC EDGAR", "DART").
- date uses "Mar 2026" format.
- content is one line pulled from that source — figures and facts, not commentary.
- url only if actually confirmed via search. null if not.
- L3 entries must always be isEstimate:true.`,
};

// ── Quality Gate: 섹션별 "콘텐츠 있음" 판정 필드 ────────────────────────────────
// 예전에는 전 섹션 공용 필드 체인(oneLiner ?? narrative ?? ... ?? growth_motion_detail
// ?? strategy_coherence)으로 판정해서, 스키마에 없는 필드로 체인이 떨어지면
// (예: business_model_v2 → growth_motion_detail) 다른 필드(revenue_streams 등)에
// 실제 데이터가 있어도 섹션 전체가 폐기됐다 (business_model_v2 실측 폐기율 22%).
// 섹션별로 실제 존재하는 필드만 명시하고, 배열 필드 중 하나라도 채워져 있으면
// (대표 텍스트 필드가 placeholder여도) 섹션을 유지한다.
const SECTION_CONTENT_SIGNALS: Record<string, { text?: string[]; arrays?: string[] }> = {
  summary_v2:          { text: ['oneLiner'],                                    arrays: ['products', 'key_metrics', 'key_bullets'] },
  industry_history_v2: {                                                        arrays: ['timeline', 'chasm_points', 'why_durable', 'key_bullets'] },
  tech_evolution_v2:   {                                                        arrays: ['stages', 'key_bullets'] },
  value_chain_v2:      {                                                        arrays: ['layers', 'value_flow', 'key_bullets'] },
  business_model_v2:   { text: ['growth_motion_detail'],                        arrays: ['revenue_streams', 'segments', 'moat', 'key_bullets'] },
  competitors_v2:      {                                                        arrays: ['direct', 'indirect', 'substitutes', 'key_bullets'] },
  cross_industry_nudge_v1: {                                                    arrays: ['key_bullets', 'sources'] },
  strategy_v2:          { text: ['strategy_coherence'],                        arrays: ['ten_year_durability', 'key_bullets', 'corporate.ma_partnerships', 'business.product_roadmap'] },
  financials_v2:         {                                                        arrays: ['income_statement', 'balance_sheet', 'key_risks', 'key_bullets'] },
};

function isPlaceholderText(v: unknown): boolean {
  return typeof v === 'string' && ['', 'N/A', 'unknown', ...NO_DATA_MARKERS].includes(v.trim());
}

function getByPath(obj: any, path: string): unknown {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Rule 1 (-999 placeholder)도 예전엔 전체 섹션을 폐기했다 — 동일한 whole-object-nuke
// 결함. -999는 다른 필드 다 채워진 상태에서 숫자 필드 하나(예: business_model_v2의
// operating_margin)에만 나타나는 경우가 흔해, 그 필드만 제거하고 나머지는 유지한다.
function sanitizePlaceholderNumbers(value: any, sectionKey: string, path = ''): any {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      value[i] = sanitizePlaceholderNumbers(value[i], sectionKey, `${path}[${i}]`);
    }
    return value;
  }
  if (value !== null && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      value[k] = sanitizePlaceholderNumbers(value[k], sectionKey, path ? `${path}.${k}` : k);
    }
    return value;
  }
  if (typeof value === 'number' && value === -999) {
    console.warn(`[quality-gate] ${sectionKey}.${path} -999 감지 → 필드 null 처리`);
    return null;
  }
  if (typeof value === 'string' && value.includes('-999')) {
    console.warn(`[quality-gate] ${sectionKey}.${path} "-999" 문자열 감지 → 필드 빈값 처리`);
    return '';
  }
  return value;
}

// ── Research gathering (2-phase split) ───────────────────────────────────────

// Phase 1: 기업 기본 정보 + 최신 현황 (2 rounds) → batch1(summary) 즉시 가능
//
// 프롬프트 캐싱 실측(2026-08-12, cache-stats 로그): 이 함수는 기존에 회사명이 시스템
// 프롬프트([Search order] 섹션) 안에 직접 박혀있어서 cache_control을 걸어도 회사마다
// 매번 다른 문자열이 되어 캐시가 원천적으로 무효화됐고(실측: cache_read=0, cache_write=0,
// 캐싱 자체가 아예 안 걸림), 검색 결과 자체가 매 요청 달라 캐시 가능한 상한도 낮다 —
// 그래도 [Rules]/[What to collect] 같은 완전 정적 지시문 블록만이라도 캐시 대상으로
// 분리하는 게 더 낫다. 회사명이 들어가는 실제 검색 쿼리는 user 메시지로 이동.
const RESEARCH1_SYSTEM = `You are a company research analyst. Use quick web searches to gather only basic company info and the latest status.

[Rules]
- fetch_url at most once. Only IR press releases, Yahoo Finance, or StockAnalysis allowed.
- If the snippet already has the number, use it without fetch_url.
- Never fetch raw SEC Archives filings or large PDFs.
- Run at most 2 searches, in the order given in the user message.

[What to collect]
1. Company overview (business areas, key products/services, founding year, HQ, ticker)
2. Rough revenue figure (cite the source, skip if unavailable)
3. Business model summary (revenue structure, key customers)
4. Latest news / major developments (2025)
5. Growth momentum / key risks
6. Funding rounds or major partnerships/deals in the last 12 months (date, amount, counterparty, source — skip if unavailable)

Label any estimated figure "(estimated)".`;

async function gatherResearch1(companyName: string): Promise<string> {
  const systemPrompt = [{ type: 'text' as const, text: RESEARCH1_SYSTEM, cache_control: { type: 'ephemeral' as const } }];
  const userMessage = `Company: ${companyName}\n\nGather basic company info quickly with these 2 searches:\n1. web_search: "${companyName} overview products services revenue business model 2024 2025"\n2. web_search: "${companyName} news strategy funding investment partnership deal recent 2025"`;

  // analyzeCompany에서 runBatch 밖에서 직접 await하는 호출이라, 여기서 예외가 새면
  // 배치 격리 없이 전체 분석이 죽는다 (2026-07-06 삼성전기 사고) — 반드시 자체 방어.
  try {
    return await runWithWebSearch(
      systemPrompt,
      userMessage,
      'claude-sonnet-5',
      2,
      4000,
      'gatherResearch1',
    );
  } catch (err) {
    console.error(`[gatherResearch][gatherResearch1] FAIL — 빈 컨텍스트로 폴백`, err);
    return '';
  }
}

// Phase 2: 경쟁사·재무 상세·산업 심층 (2 rounds) → batch2-4에 사용
// gatherResearch1과 동일한 캐싱 원칙 — 정적 규칙만 시스템 프롬프트(cache_control),
// 회사명이 들어가는 검색 쿼리는 user 메시지로 분리(2026-08-12).
const RESEARCH2_SYSTEM = `You are a company research analyst. Gather competitor, financial-detail, and industry-depth information.

[Rules]
- fetch_url at most once. Only Yahoo Finance, Macrotrends, StockAnalysis, or IR press releases allowed.
- If the snippet already has the number, use it without fetch_url.
- Never fetch raw SEC Archives filings or large PDFs.
- Run at most 2 searches, in the order given in the user message.

[What to collect]
1. Key competitors + estimated market share (cite the source)
2. Financial detail (revenue, operating income, net income — last 3 years, cite the source)
3. Industry trends / technology shifts
4. Position in the value chain / supply-chain structure
5. Strategic direction (M&A, new businesses, geographic expansion)

Label any estimated figure "(estimated)". Source citation is required.`;

async function gatherResearch2(companyName: string): Promise<string> {
  const systemPrompt = [{ type: 'text' as const, text: RESEARCH2_SYSTEM, cache_control: { type: 'ephemeral' as const } }];
  const userMessage = `Company: ${companyName}\n\nGather detailed competitor/financial/industry info with these 2 searches:\n1. web_search: "${companyName} competitors market share industry trends value chain 2024 2025"\n2. web_search: "${companyName} annual revenue net income financials technology 2023 2024 2025"`;

  // gatherResearch1과 동일한 이유로 자체 방어 필요 (runBatch 밖에서 직접 await됨).
  try {
    return await runWithWebSearch(
      systemPrompt,
      userMessage,
      'claude-sonnet-5',
      2,
      4000,
      'gatherResearch2',
    );
  } catch (err) {
    console.error(`[gatherResearch][gatherResearch2] FAIL — 빈 컨텍스트로 폴백`, err);
    return '';
  }
}

// ── Section call (no web search, uses shared context) ─────────────────────────

// model 파라미터: 섹션별 모델 티어링 도입 대비(2026-08-12) — 기본값은 기존 sonnet 그대로,
// 프로덕션 분기 로직은 아직 연결 안 함(검토 후 결정 예정).
export async function callSection<T>(context: string, sectionKey: string, language: Language, model = 'claude-sonnet-5'): Promise<T | null> {
  const t0 = Date.now();
  try {
    const response = await anthropic.messages.create({
      model,
      // 2026-08-15 4000→6000→8000 상향 — Sonnet 5 신규 토크나이저가 동일 내용도 ~30-35%
      // 더 많은 토큰을 소비해(모델 마이그레이션 가이드 실측), strategy_coherence 등
      // 서술형 필드가 있는 스키마가 4000에서 응답이 잘려 JSON 파싱 실패로 이어졌음
      // (2026-08-15 J&J 실측 — strategy_v2/cross_industry_nudge_v1 재현). 6000으로 올린
      // 뒤에도 NVIDIA financials_v2가 stop_reason=max_tokens(정확히 6000 도달)로 재현돼
      // 8000으로 재상향. financials_v2 전용 분기를 두는 대신 8개 스키마 전체에 동일
      // 적용(ponytail 원칙 — 스키마별 분기는 코드 복잡도만 늘리고, max_tokens는 상한선이라
      // 실제로 다 안 쓰면 비용 증가 없음). 실전 발견 이력 참고.
      max_tokens: 8000,
      system: [{ type: 'text', text: sectionSystem(language), cache_control: { type: 'ephemeral' } }] as any,
      messages: [{
        role: 'user',
        content: `${context}\n\n---\n\n${SECTION_SCHEMAS[sectionKey]}`,
      }],
    });
    logCacheUsage(sectionKey, response.usage);
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    const result = extractJson<T>(raw, sectionKey);
    // ── Quality Gate (Rules 1–3) ──────────────────────────────────────────
    if (result !== null) {
      // Rule 1: -999 placeholder 감지 → 필드 단위 제거 (섹션 전체 폐기 금지)
      sanitizePlaceholderNumbers(result, sectionKey);
      // Rule 2: 섹션에 실제 콘텐츠가 하나도 없으면 null 처리 (필드 단위 판정).
      // 대표 텍스트 필드가 placeholder여도 배열 필드에 콘텐츠가 있으면 섹션은 유지 —
      // 배열·텍스트 신호가 모두 비어있을 때만 섹션 전체를 폐기한다.
      const r = result as any;
      const signals = SECTION_CONTENT_SIGNALS[sectionKey];
      if (signals) {
        const hasArrayContent = (signals.arrays ?? []).some(path => {
          const v = getByPath(r, path);
          return Array.isArray(v) && v.length > 0;
        });
        const hasTextContent = (signals.text ?? []).some(f => !isPlaceholderText(r[f]));
        if (!hasArrayContent && !hasTextContent) {
          console.warn(`[quality-gate] ${sectionKey} 콘텐츠 전무 (배열·텍스트 모두 비어있음) → null`);
          return null;
        }
        // 필드 단위 정리: placeholder 텍스트 필드만 빈 문자열로 정규화, 나머지는 그대로 유지
        for (const f of signals.text ?? []) {
          if (isPlaceholderText(r[f])) r[f] = '';
        }
      }
      // Rule 3: sources 배열 비어있음 — 경고만 (전체 중단 금지)
      if (Array.isArray(r.sources) && r.sources.length === 0) {
        console.warn(`[quality-gate] ${sectionKey} sources 배열 비어있음`);
      }
      // 프론트가 조건부 렌더링하는 단일 텍스트 필드가 비어있는 빈도 관찰용 — Quality Gate
      // 룰로 승격하지 않음(business_model_v2 22% 폐기율 재현 위험, 실전 발견 이력 6번 참고).
      if (sectionKey === 'summary_v2') {
        if (!r.bull_case?.length) console.warn(`[quality-gate] summary_v2.bull_case 비어있음`);
        if (!r.bear_case?.length) console.warn(`[quality-gate] summary_v2.bear_case 비어있음`);
      }
      if (sectionKey === 'business_model_v2' && !r.growth_motion_detail) {
        console.warn(`[quality-gate] business_model_v2.growth_motion_detail 비어있음`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────
    // 2026-08-15 로깅 결함 수정(심각도: 높음) — result가 null(extractJson()의 JSON 파싱
    // 실패)이어도 이 지점까지 예외 없이 도달하면 무조건 "OK"가 찍히던 버그. null이면
    // merge 단계(analyzeCompany())가 DEFAULT_ANALYSIS_DATA 빈 placeholder로 조용히
    // 대체하는데, 로그만 보면 성공한 것처럼 보여 원인 추적이 막혔음(2026-08-15 Sonnet 5
    // 전환 직후 J&J strategy_v2/cross_industry_nudge_v1에서 실측 재현). extractJson() 내부의
    // console.error는 원문 파싱 실패 자체는 남기지만 "이 섹션이 결국 빈 값으로 저장된다"는
    // 결과는 여기서 별도로 남겨야 grep으로 추적 가능하다. Sonnet 4.6 때도 동일한 잠재
    // 결함이었을 가능성이 높음 — 그때는 우연히 응답 길이가 짧아 안 걸렸을 뿐(같은 근본
    // 원인으로 의심되는 사례: Amprius Technologies 요약 탭 빈 화면).
    if (result !== null) {
      console.log(`[claude] ${sectionKey} OK  ${Date.now() - t0}ms`);
    } else {
      // stop_reason이 "max_tokens"면 진짜 길이 초과로 잘린 것(max_tokens 상향으로 해결
      // 가능) — 그 외 값(예: "end_turn"인데 JSON이 깨짐)이면 길이 문제가 아니라 모델이
      // 애초에 잘못된 JSON을 낸 것이므로 max_tokens를 올려도 소용없다(2026-08-15,
      // NVIDIA strategy_v2가 6000에서도 재현되어 원인 구분 필요성으로 추가).
      console.error(`[claude] ${sectionKey} FAIL ${Date.now() - t0}ms — JSON 파싱 실패로 null 반환, DEFAULT_ANALYSIS_DATA 빈 placeholder로 대체됨 (stop_reason=${response.stop_reason}, output_tokens=${response.usage.output_tokens})`);
    }
    return result;
  } catch (err) {
    console.error(`[claude] ${sectionKey} FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

// ── Founder section (own web-search pass) ─────────────────────────────────────

async function callFounderSection(companyName: string, language: Language): Promise<FounderV2 | null> {
  const t0 = Date.now();
  try {
    const systemPrompt = [{ type: 'text' as const, text: `You are an expert on company founders. Use web search to gather founder/CEO information, then return only the specified JSON schema.
Rules: Output pure JSON only — no markdown, no code blocks, no extra commentary. ${FOUNDER_LANGUAGE_DIRECTIVE[language]}
Mark any item you can't find as "-". For a private company, research this section more deeply than the financials.`, cache_control: { type: 'ephemeral' as const } }];

    const schema = `Output only a JSON object matching this schema:
{"founders":[{"name":"Name","title":"Title","education":"School or '-'","major":"Major or '-'"}],"career_trajectory":[{"period":"Period (e.g. 2018-present)","company":"Company name","role":"Title/role"}],"founding_history":{"type":"1st_time|serial","previous_ventures":[{"name":"Company name","result":"exit|closed|operating","exit_type":"M&A|IPO|null"}]},"reputation":{"sns_style":"Social media style, 1 line, or '-'","media_exposure":"Notable media exposure, 1 line, or '-'","blind_glassdoor":"Blind/Glassdoor reputation summary, 1 line, or '-'"},"network":{"investors":["Investor name/firm, max 5"],"advisors_board":["Advisor/board member, max 5"],"cofounders":["Co-founder name, max 5"]},"key_bullets":["This founder's core strength — why they're the right person for this business, 8 words or fewer","The most notable thing in the founder's network/track record, 8 words or fewer","Founder risk — the biggest concern, 8 words or fewer"],"discovery_questions":["Discovery-call question grounded in this section's data, 1 line","2nd question, 1 line"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
career_trajectory: sort most recent first. Empty array [] if founding_history.previous_ventures has none. Any LinkedIn/news/Crunchbase URL confirmed via search must go in sources[].url.
discovery_questions: 3-5 candidate discovery-call questions grounded only in this section's own data (founder background, career trajectory, founding history, network). Phrase each as something you're curious to ask, never a stated fact. Bad: "You've built and exited a company before." Good: "What are you doing differently this time based on what you learned from that exit?" No investor language. Every question's "you"/"your" must mean the company being analyzed itself — never phrase a question as if addressed to one of its customers, suppliers, or another company in its value chain. Return fewer than 3 (even an empty array) rather than inventing a weak one.`;

    const raw = await runWithWebSearch(
      systemPrompt,
      `Company: ${companyName}\n\nGather founder/CEO information using this search order:\n1. "${companyName} founder CEO name background education"\n2. "${companyName} founder serial entrepreneur exit history"\n3. "${companyName} investor board advisor"\n\nThen return the data using this schema:\n${schema}`,
      'claude-sonnet-5',
      3,
      6000,
      'founder_v2',
    );
    const result = extractJson<FounderV2>(raw, 'founder_v2');
    console.log(`[claude] founder_v2 OK  ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.error(`[claude] founder_v2 FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

// ── Financial refresh (own web-search pass) ───────────────────────────────────

// gatherResearch1/2와 동일한 캐싱 원칙(2026-08-12) — 이 함수만 그 수정에서 누락돼
// 회사명이 시스템 프롬프트에 직접 박혀있었고 cache_control도 없었다(2026-08-13 감사로 발견,
// 실측: cache_read=0, cache_write=0). 정적 규칙만 시스템 프롬프트(cache_control)로 분리하고,
// 회사명이 들어가는 검색 쿼리는 user 메시지로 이동.
const GATHER_FINANCIAL_SYSTEM = `You are a company financial analyst. Gather only the latest financial data for the company below.

[Source reliability]
Tier 1 — official disclosure: SEC 10-K/10-Q, DART, company IR
Tier 2 — Bloomberg, Reuters, Yahoo Finance, Macrotrends
Anything below tier 2 must be labeled "(estimated)".

[Rules]
- Run the 2 searches given in the user message, in order.
- For any SEC EDGAR / DART / IR URL in the results, fetch_url to read it in full.
- Cite the source for every figure. Mark anything you can't find "Not disclosed".`;

async function gatherFinancialResearch(companyName: string): Promise<string> {
  const systemPrompt = [{ type: 'text' as const, text: GATHER_FINANCIAL_SYSTEM, cache_control: { type: 'ephemeral' as const } }];
  const userMessage = `Company: ${companyName}\n\nGather the latest financial data with these 2 searches:\n1. web_search: "${companyName} annual report revenue operating income net income 2023 2024 2025"\n2. web_search: "${companyName} SEC 10-K OR DART financial statements 2024 2025"`;

  return runWithWebSearch(
    systemPrompt,
    userMessage,
    'claude-sonnet-5',
    6,
    4000,
    'gatherFinancialResearch',
  );
}

// income_statement/balance_sheet를 EDGAR/DART 원본으로 덮어쓴다 — Claude가 다년도 표를
// 텍스트로 다시 서술하다 일부 연도를 놓치는 실행별 비결정성 문제(2026-08-13 Ford FY2021/2022
// 공백 사고) 대응. raw 데이터가 아예 없으면(web_search 전용 소스 등) 원본 그대로 둔다 —
// 이 경우 서버가 조립할 원천 데이터 자체가 없으므로 Claude 결과가 유일한 소스.
function overrideFinancialsTable(
  f: FinancialsV2 | null | undefined,
  rawEdgar: EdgarRawSeries | null | undefined,
  rawDart: DartRawSeries | null | undefined,
  language: Language,
): FinancialsV2 | null | undefined {
  if (!f || (!rawEdgar && !rawDart)) return f;
  const isRows = buildIncomeStatementRows(rawEdgar ?? null, rawDart ?? null, language);
  const bsRows = buildBalanceSheetRows(rawEdgar ?? null, rawDart ?? null, language);
  const revenueLines = buildRevenueLines(rawEdgar ?? null);
  if (isRows) f.income_statement = isRows as unknown as FinancialsV2['income_statement'];
  if (bsRows) f.balance_sheet = bsRows as unknown as FinancialsV2['balance_sheet'];
  f.revenue_lines = revenueLines ?? undefined;
  return f;
}

export async function refreshFinancials(companyName: string, language: Language = 'en'): Promise<FinancialsV2> {
  const [{ contextText, rawEdgar, rawDart }, researchText] = await Promise.all([
    fetchFinancialContext(companyName),
    gatherFinancialResearch(companyName),
  ]);

  const context = [
    `Company: ${companyName}`,
    contextText ? `\n[Disclosed data — prioritize these figures]\n${contextText}` : null,
    `\n[Web research]\n${researchText}`,
  ].filter(Boolean).join('\n');

  const result = await callSection<FinancialsV2>(context, 'financials_v2', language);
  return overrideFinancialsTable(result, rawEdgar, rawDart, language) ?? DEFAULT_ANALYSIS_DATA.financials_v2;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(
  companyName: string,
  financialContext?: string,
  onBatch?: (batchNum: number, data: Partial<AnalysisData>) => Promise<void>,
  opts?: {
    skipBatches?: Set<number>;
    initialData?: Partial<AnalysisData>;
    cachedFinancials?: FinancialsV2;
    language?: Language;
    // batch3 완료 시 financials_v2.income_statement/balance_sheet를 서버가 EDGAR/DART 원본으로
    // 덮어쓰는 데 사용(overrideFinancialsTable) — 없으면 Claude 결과를 그대로 둔다.
    rawEdgar?: EdgarRawSeries | null;
    rawDart?: DartRawSeries | null;
  },
): Promise<AnalysisData> {
  const language: Language = opts?.language ?? 'en';
  const skip = opts?.skipBatches ?? new Set<number>();
  const result: AnalysisData = { ...DEFAULT_ANALYSIS_DATA, ...(opts?.initialData ?? {}) };
  // industry_history_v2/tech_evolution_v2는 배치2/3에서 더 이상 생성하지 않음(온디맨드 전환) —
  // 캐시(initialData)로 이미 채워진 게 아니라면 DEFAULT_ANALYSIS_DATA의 빈 placeholder 대신
  // null을 명시해야 프론트가 "생성됨(빈 데이터)"이 아니라 "아직 생성 안 됨"으로 인식한다.
  if (!opts?.initialData?.industry_history_v2) result.industry_history_v2 = null;
  if (!opts?.initialData?.tech_evolution_v2)   result.tech_evolution_v2   = null;

  const BATCH_TIMEOUT = 75_000;

  async function runBatch(
    batchNum: number,
    makeRunners: () => Promise<any>[],
    merge: (vals: any[]) => Partial<AnalysisData>,
  ): Promise<void> {
    if (skip.has(batchNum)) return;
    const t = Date.now();
    try {
      const vals = await withTimeout(Promise.all(makeRunners()), BATCH_TIMEOUT, `batch${batchNum}`);
      console.log(`[claude] batch${batchNum} OK ${Date.now() - t}ms`);
      const data = merge(vals);
      Object.assign(result, data);
      await onBatch?.(batchNum, data);
    } catch (err) {
      console.error(`[claude] batch${batchNum} FAIL ${Date.now() - t}ms`, err);
      await onBatch?.(batchNum, {});
    }
  }

  // ── Phase 1 research: 기본 정보·최신 현황 (2 rounds) ─────────────────────────
  const t0 = Date.now();
  const research1 = await gatherResearch1(companyName);
  console.log(`[claude] gatherResearch1 done ${Date.now() - t0}ms`);

  const phase1Context = [
    `Company: ${companyName}`,
    financialContext ? `\n[Disclosed data — prioritize these figures]\n${financialContext}` : null,
    `\n[Web research — basic info]\n${research1}`,
  ].filter(Boolean).join('\n');

  // ── Batch 1 (summary) + Phase 2 research 병렬 실행 ────────────────────────────
  // batch1은 완료 즉시 SSE 전송 → 요약 탭 표시
  // gatherResearch2는 batch1과 동시에 실행, 완료 후 batch2-4에 사용
  const t1 = Date.now();
  const [, research2] = await Promise.all([
    runBatch(1,
      () => [callSection<SummaryV2>(phase1Context, 'summary_v2', language)],
      ([s]) => ({ summary_v2: s ?? { ...DEFAULT_ANALYSIS_DATA.summary_v2, company: companyName } }),
    ),
    gatherResearch2(companyName),
  ]);
  console.log(`[claude] batch1 + gatherResearch2 done ${Date.now() - t1}ms`);

  // ── Phase 2 컨텍스트 (1+2 합산) → batch2-4 공유 ──────────────────────────────
  const sharedContext = [
    `Company: ${companyName}`,
    financialContext ? `\n[Disclosed data — prioritize these figures]\n${financialContext}` : null,
    `\n[Web research — basic info]\n${research1}`,
    `\n[Web research — detailed info]\n${research2}`,
  ].filter(Boolean).join('\n');

  // Batch 2-4 병렬 실행 — sharedContext 공유, 완료 순서대로 즉시 SSE 전송
  // 각 runBatch는 완료 즉시 onBatch → send('batch') 호출 → 탭 순차 채워짐
  // financial_cache 히트 시 batch3(financials)가 가장 먼저 완료될 수 있음
  const cachedFin = opts?.cachedFinancials;
  // 2026-08 재편: industry_history_v2/tech_evolution_v2를 "pain 진단 시작" 버튼 트리거
  // 온디맨드 엔드포인트(POST /api/analyze/:id/pain-diagnosis)로 완전히 분리하면서 배치가
  // 2/3/4 세 개로 줄었다 — founder_v2(구 배치5)는 sources와 함께 배치4로, financials_v2는
  // value_chain_v2/strategy_v2와 함께 배치3으로 재배치.
  await Promise.all([
    runBatch(2,
      () => [
        callSection<BusinessModelV2>(sharedContext, 'business_model_v2', language),
        callSection<CompetitorsV2>(sharedContext, 'competitors_v2', language),
        callSection<CrossIndustryNudgeV1>(sharedContext, 'cross_industry_nudge_v1', language),
      ],
      ([bm, c, n]) => ({
        business_model_v2:       bm ?? DEFAULT_ANALYSIS_DATA.business_model_v2,
        competitors_v2:          c  ?? DEFAULT_ANALYSIS_DATA.competitors_v2,
        cross_industry_nudge_v1: n  ?? DEFAULT_ANALYSIS_DATA.cross_industry_nudge_v1,
      }),
    ),
    runBatch(3,
      () => [
        callSection<ValueChainV2>(sharedContext, 'value_chain_v2', language),
        callSection<StrategyV2>(sharedContext, 'strategy_v2', language),
        cachedFin ? Promise.resolve(cachedFin) : callSection<FinancialsV2>(sharedContext, 'financials_v2', language),
      ],
      ([vc, s, f]) => {
        // Rule 4: 재무 수치 전년 대비 10배 이상 변동 → (추정) 뱃지 강제 적용
        if (f?.income_statement) {
          for (const row of f.income_statement) {
            const pct = row.yoy?.match(/[▲▼](\d+(?:\.\d+)?)%/);
            if (pct && parseFloat(pct[1]) >= 900) {
              const isNoData = (v: string | undefined) =>
                !v || NO_DATA_MARKERS.includes(v);
              const yr = getRowYearCols(row).reverse().find(y => !isNoData(row[y]));
              if (yr && !row[yr]!.includes('추정') && !row[yr]!.includes('estimated')) {
                row[yr] = row[yr] + ' ' + PLACEHOLDER_MARKERS[language].estimated;
                console.warn(`[quality-gate] financials ${row.item} YoY ${row.yoy} → ${yr} ${PLACEHOLDER_MARKERS[language].estimated} 강제 적용`);
              }
            }
          }
        }
        // income_statement/balance_sheet를 EDGAR/DART 원본으로 덮어쓴다 — Rule 5(아래)보다 먼저
        // 적용해야 Rule 5가 서버가 확정한 정확한 데이터를 기준으로 판단한다(순서 중요).
        if (f) overrideFinancialsTable(f, opts?.rawEdgar, opts?.rawDart, language);
        // Rule 5: strategy_v2 자유서술이 "N년 평균 성장률"을 주장하는데 financials_v2의 매출 행에서
        // 실제 확인 가능한 인접연도 YoY가 1개 이하면(2개년치로는 "평균"을 낼 수 없음) 표현을
        // "전년 대비 성장률"로 다운그레이드 — 2026-08-13 워트인텔리전스 실측 사고(strategy_v2가
        // "2년 평균 43%"라고 썼지만 실제 YoY는 1회(44.7%)뿐이었고, 43%조차 income_statement가
        // 아니라 business_model_v2.revenue_streams의 특정 스트림 숫자를 잘못 가져다 쓴 것) 재발
        // 방지. 프롬프트 지시(Data reliability principles 규칙 8)만으로는 강제력이 약해
        // monteCarloService의 growthRates.length<2→null과 같은 취지의 코드 레벨 가드를 추가했다 —
        // 다만 이건 생성 자체를 막는 몬테카를로와 달리 자유 서술 필드라 "생성 후 검증+치환"만 가능.
        if (f?.income_statement && s) {
          const isNoData = (v: string | undefined) => !v || NO_DATA_MARKERS.includes(v);
          const revenueRow = f.income_statement.find((row: FinancialsV2Row) => /revenue|매출/i.test(row.item));
          if (revenueRow) {
            // getRowYearCols는 회사가 실제로 보유한 연도만 오름차순으로 반환(고정 리터럴 아님) —
            // 다만 값이 정말 인접한 연도인지(중간에 빈 해가 끼어있지 않은지)는 별도로 확인한다.
            const cols = getRowYearCols(revenueRow);
            let adjacentYoY = 0;
            for (let i = 0; i < cols.length - 1; i++) {
              const y0 = Number(cols[i].slice(2)), y1 = Number(cols[i + 1].slice(2));
              if (y1 - y0 !== 1) continue;
              if (!isNoData(revenueRow[cols[i]]) && !isNoData(revenueRow[cols[i + 1]])) adjacentYoY++;
            }
            if (adjacentYoY <= 1) {
              const avgClaim = /\d+\s*(?:개)?년\s*평균|\d+-year average/i;
              const fixText = (text: string) =>
                text.replace(/\d+\s*(?:개)?년\s*평균|\d+-year average/gi, m => /년/.test(m) ? '전년 대비' : 'YoY');
              const freeTextFields: Array<[string, string, (v: string) => void]> = [
                ['financial.direction', s.financial.direction, v => { s.financial.direction = v; }],
                ['financial.capital_allocation', s.financial.capital_allocation, v => { s.financial.capital_allocation = v; }],
                ['corporate.direction', s.corporate.direction, v => { s.corporate.direction = v; }],
                ['business.direction', s.business.direction, v => { s.business.direction = v; }],
                ['strategy_coherence', s.strategy_coherence, v => { s.strategy_coherence = v; }],
              ];
              for (const [name, original, set] of freeTextFields) {
                if (original && avgClaim.test(original)) {
                  console.warn(`[quality-gate] strategy_v2.${name}이 "N년 평균 성장률"을 주장하지만 실제 인접연도 YoY는 ${adjacentYoY}개뿐 — 표현 다운그레이드`);
                  set(fixText(original));
                }
              }
            }
          }
        }
        return {
          value_chain_v2: vc ?? DEFAULT_ANALYSIS_DATA.value_chain_v2,
          strategy_v2:    s  ?? DEFAULT_ANALYSIS_DATA.strategy_v2,
          financials_v2:  f  ?? DEFAULT_ANALYSIS_DATA.financials_v2,
        };
      },
    ),
    runBatch(4,
      () => [
        callFounderSection(companyName, language),
        callSection<AnalysisSources>(sharedContext, 'sources', language),
      ],
      ([fo, src]) => ({
        founder_v2: fo  ?? DEFAULT_ANALYSIS_DATA.founder_v2,
        sources:    src ?? DEFAULT_ANALYSIS_DATA.sources,
      }),
    ),
  ]);

  // ── Golden Set 검증 (전체 배치 완료 후 1회) ───────────────────────────────
  if (!result.summary_v2.company.toLowerCase().includes(companyName.toLowerCase())) {
    console.warn(`[golden-set] summary.company에 기업명 없음 (got: "${result.summary_v2.company}")`);
  }
  const hasRealFinancials = result.financials_v2.income_statement.some(row =>
    getRowYearCols(row).some(y => row[y] && !NO_DATA_MARKERS.includes(row[y]!))
  );
  if (!hasRealFinancials) {
    console.warn(`[golden-set] financials 실제 수치 없음`);
  }
  const hasAnySources = Object.values(result.sources).some(
    arr => Array.isArray(arr) && arr.length > 0
  );
  if (!hasAnySources) {
    console.warn(`[golden-set] sources 전체 비어있음`);
  }
  // industry_history_v2/tech_evolution_v2는 온디맨드 전환으로 초기 분석에서 항상 null이라
  // "실패"가 아니므로 golden-set 빈 섹션 카운트에서 제외.
  const emptySectionCount = [
    result.value_chain_v2.layers.length === 0,
    result.business_model_v2.revenue_streams.length === 0,
    result.competitors_v2.direct.length === 0,
    result.strategy_v2.corporate.direction === '',
    result.financials_v2.income_statement.length === 0,
    result.founder_v2.founders.length === 0,
  ].filter(Boolean).length;
  if (emptySectionCount >= 4) {
    console.warn(`[golden-set] ⚠️ ${emptySectionCount}개 섹션 데이터 없음 — 전체 분석 실패 가능성`);
  }
  // ─────────────────────────────────────────────────────────────────────────

  return result;
}


// ── Single-section reanalysis (used by /api/analyze/reanalyze) ────────────────
export async function reanalyzeSingleSection(
  companyName: string,
  sectionKey: string,
  financialContext?: string,
  language: Language = 'en',
  rawFinancials?: { rawEdgar?: EdgarRawSeries | null; rawDart?: DartRawSeries | null },
): Promise<any> {
  if (sectionKey === 'founder_v2') {
    return callFounderSection(companyName, language);
  }
  const [research1, research2] = await Promise.all([
    gatherResearch1(companyName),
    gatherResearch2(companyName),
  ]);
  const context = [
    `Company: ${companyName}`,
    financialContext ? `\n[Disclosed data — prioritize these figures]\n${financialContext}` : null,
    `\n[Web research — basic info]\n${research1}`,
    `\n[Web research — detailed info]\n${research2}`,
  ].filter(Boolean).join('\n');
  const result = await callSection(context, sectionKey, language);
  if (sectionKey === 'financials_v2' && rawFinancials) {
    return overrideFinancialsTable(result as FinancialsV2, rawFinancials.rawEdgar, rawFinancials.rawDart, language);
  }
  return result;
}

// ── Growth scenario narrative (몬테카를로 시뮬레이션 결과 한줄 해석) ──────────

export interface GrowthScenarioForNarrative {
  simulation: { p10: number[]; p50: number[]; p90: number[] };
  confidenceLevel: 'high' | 'low';
  currency: 'KRW' | 'USD';
  sectorTag?: string;
}

function growthScenarioNarrativeSystem(language: Language): string {
  return `You are a company analyst writing for BD, Sales, and Strategy practitioners.
Based on the Monte Carlo revenue growth simulation results below, write a 1-2 sentence core interpretation.
${LANGUAGE_DIRECTIVE[language]}

Rules:
- No investor language — never say "valuation," "enterprise value," "investment return," "stock price."
- Write from a partnership/deal/sales-decision point of view (e.g. "the expected revenue growth range if you partner with this company is...").
- If confidence is low, the sentence must convey that this is "an estimate based on industry benchmarks" —
  don't hide the fact that it isn't this company's own official financial data.
- Output pure text only, 1-2 sentences — no markdown, no quotes, no bullets.`;
}

function formatScenarioForPrompt(currency: 'KRW' | 'USD', simulation: GrowthScenarioForNarrative['simulation']): string {
  const fmt = (v: number) =>
    currency === 'KRW' ? `${(v / 100_000_000).toFixed(0)}억원` : `${(v / 1_000_000).toFixed(0)}M USD`;
  return simulation.p50
    .map((_, y) => `Year+${y + 1}: conservative ${fmt(simulation.p10[y])} / expected ${fmt(simulation.p50[y])} / optimistic ${fmt(simulation.p90[y])}`)
    .join('\n');
}

export async function generateGrowthScenarioNarrative(
  companyName: string,
  scenario: GrowthScenarioForNarrative,
  language: Language = 'en',
): Promise<string | null> {
  const { simulation, confidenceLevel, currency, sectorTag } = scenario;

  const userPrompt = `Company: ${companyName}
Confidence: ${confidenceLevel === 'high' ? "based on the company's own official financial time series" : `estimated from industry (${sectorTag ?? 'sector'}) benchmarks`}
${formatScenarioForPrompt(currency, simulation)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      system: growthScenarioNarrativeSystem(language),
      messages: [{ role: 'user', content: userPrompt }],
    });
    logCacheUsage('growth_scenario_narrative', response.usage);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch (err) {
    console.error('[claude] growth_scenario narrative FAIL', err);
    return null;
  }
}

// ── SEC 산업 벤치마크 막대비교 — interpretation 한 줄 (2026-08-12) ────────────────
// 숫자(companyValue/median/n)는 server/src/lib/secIndustryBenchmark.ts가 rawEdgar +
// industry_benchmark 테이블로 이미 서버에서 확정한 값 — 여기선 그 숫자를 절대 다시 계산하거나
// 고쳐쓰지 않고, "왜 이 차이가 의미있는지" 한 줄만 요청한다(질문형 재무임팩트 규칙 동일 적용).

function secBenchmarkInterpretationSystem(language: Language): string {
  return `You are a company analyst writing for BD, Sales, and Strategy practitioners.
For each industry-benchmark comparison below, write ONE short sentence (max ~15 words) on why this gap might
matter for someone evaluating this company — not a restatement of the numbers (they're already shown as a bar
chart next to your sentence).
${LANGUAGE_DIRECTIVE[language]}

Rules:
- Never repeat the exact percentages/multiples in your sentence — the reader already sees them.
- If you imply a financial impact, phrase it as a question, never as a stated conclusion.
- No investor language (no "valuation," "P/E," "ROE/ROIC," stock-price talk).
- Output pure JSON only: an array of strings, one per input item, in the same order. No markdown, no commentary.`;
}

export async function generateSecBenchmarkInterpretations(
  companyName: string,
  sicCode: string,
  items: Array<{ label: string; unit: string; companyValue: number; median: number; n: number }>,
  language: Language = 'en',
): Promise<string[]> {
  if (items.length === 0) return [];
  const lines = items.map((it, i) =>
    `${i + 1}. ${it.label}: this company ${it.companyValue.toFixed(it.unit === 'x' ? 2 : 1)}${it.unit} vs. ` +
    `SIC ${sicCode} industry median ${it.median.toFixed(it.unit === 'x' ? 2 : 1)}${it.unit} (n=${it.n})`,
  ).join('\n');
  const userPrompt = `Company: ${companyName}\n${lines}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 500,
      system: secBenchmarkInterpretationSystem(language),
      messages: [{ role: 'user', content: userPrompt }],
    });
    logCacheUsage('sec_benchmark_interpretation', response.usage);
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = extractJson<string[]>(raw, 'sec_benchmark_interpretations');
    if (!Array.isArray(parsed) || parsed.length !== items.length) {
      console.warn('[claude] sec_benchmark_interpretations shape mismatch, falling back to empty strings');
      return items.map(() => '');
    }
    return parsed.map(s => (typeof s === 'string' ? s : ''));
  } catch (err) {
    console.error('[claude] sec_benchmark_interpretations FAIL', err);
    return items.map(() => '');
  }
}

// financials_v2.discovery_questions는 Claude가 callSection()에서 생성할 때 벤치마크
// 편차를 아예 볼 수 없다(콘텐츠 포맷 원칙 1번 — 이 숫자는 narrative/프롬프트 컨텍스트에
// 안 실린다, 막대비교 컴포넌트 전담). 그래서 편차를 소재로 한 질문 1개는 이 계산이 끝난
// 뒤 여기서 별도로 만들어 analyze.ts가 financials_v2.discovery_questions 앞에 붙인다
// (generateSecBenchmarkInterpretations와 동일한 위치·패턴, 입력도 동일).
function benchmarkDiscoveryQuestionSystem(language: Language): string {
  return `You are a B2B sales/BD strategist. Given a company's financial metrics that diverge from its industry's SEC-benchmark median, write exactly ONE discovery-call question an AE could ask about the single most notable deviation.
Rules: Output pure JSON only — no markdown, no commentary. ${LANGUAGE_DIRECTIVE[language]}
Phrase it as something you're curious to ask, never a stated fact or number. Bad: "Your operating margin is 8pt below the industry median." Good: "Is that margin gap versus peers something you're actively working to close, or is it structural?" No investor language (no valuation/P/E/ROE framing). If there are several deviating metrics, pick the single most striking one — one sharp question beats a vague composite one.`;
}

export async function generateBenchmarkDiscoveryQuestion(
  companyName: string,
  sicCode: string,
  items: Array<{ label: string; unit: string; companyValue: number; median: number; n: number }>,
  language: Language = 'en',
): Promise<string | null> {
  if (items.length === 0) return null;
  const lines = items.map((it, i) =>
    `${i + 1}. ${it.label}: this company ${it.companyValue.toFixed(it.unit === 'x' ? 2 : 1)}${it.unit} vs. ` +
    `SIC ${sicCode} industry median ${it.median.toFixed(it.unit === 'x' ? 2 : 1)}${it.unit} (n=${it.n})`,
  ).join('\n');
  const userPrompt = `Company: ${companyName}\n${lines}\n\nOutput only a JSON object matching this schema: {"question":"The single discovery-call question"}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      system: benchmarkDiscoveryQuestionSystem(language),
      messages: [{ role: 'user', content: userPrompt }],
    });
    logCacheUsage('benchmark_discovery_question', response.usage);
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = extractJson<{ question?: string }>(raw, 'benchmark_discovery_question');
    const q = parsed?.question?.trim();
    return q || null;
  } catch (err) {
    console.error('[claude] benchmark_discovery_question FAIL', err);
    return null;
  }
}

// ── ICP 인사이트 탭: discovery_questions 큐레이션 (2026-08-15) ─────────────────
// 5카테고리 신호별 insight+consequence 합성(2026-08-13 설계) 대신, 이미 9개 섹션이
// 자체적으로 생성해둔 discovery_questions 후보 풀(discoveryQuestions.ts,
// collectDiscoveryQuestionCandidates)에서 이 유저의 ICP와 관련도 높은 3-5개를
// 선별·재구성만 한다 — 카테고리별 함의를 매번 새로 합성하지 않으므로 "사실이 아니라
// 결과"라는 품질 기준은 이미 1단계(섹션 프롬프트)에서 강제됐고, 여기서는 선택과
// ICP 맞춤 문구 조정만 담당한다.
//
// 근거 추적: 후보마다 id를 매겨 넘기고, Claude에게 "그 id들 중에서 골라(문구는 재구성
// 가능)"라고만 시킨다 — 반환된 id가 후보 풀에 실제로 있는지 서버가 다시 검증하므로,
// Claude가 새 id를 지어내거나 원본에 없는 질문을 끼워 넣을 방법이 없다(원본 섹션 데이터
// 근거를 벗어나지 않을 것 원칙의 서버측 강제). ICP가 전부 비어있을 때는 이 호출 자체를
// 생략하고 discoveryQuestions.ts의 pickDefaultDiscoveryQuestions()가 결정론적으로
// 선택한다(불필요한 Claude 호출 방지).

function discoveryQuestionCurationSystem(language: Language): string {
  return `You are a B2B sales/BD strategist selecting discovery-call questions for someone about to research or meet this company, tailored to their ICP (Ideal Customer Profile).
Rules: Output pure JSON only — no markdown, no code blocks, no extra commentary. ${LANGUAGE_DIRECTIVE[language]}

[Task]
You're given a numbered pool of candidate questions, each already grounded in this company's actual analysis data (no candidate is speculative — that filtering already happened upstream). Pick the 3-5 candidates most relevant to the reader's ICP and return them.

[Rephrasing — optional, must stay grounded]
You may lightly rephrase a candidate's wording to sharpen it for this specific ICP (e.g. naming the reader's product category instead of a generic phrase) — but the question must still be answerable from the same underlying fact as the original candidate. Never introduce a new fact, number, or claim that wasn't in the original candidate. If a candidate is already sharp as-is, return it unchanged.

[ICP-aware framing]
Any ICP field marked "(not provided)" must NOT be used to narrow selection — fall back to picking on general business relevance for that dimension. Never invent ICP details the reader didn't give you.

[Question form — non-negotiable]
Every returned question must be phrased as something you'd ask the company, not a statement of fact you already know. No investor language (valuation/P/E/ROE/stock price).

[Selection]
Return 3-5 items (fewer only if the candidate pool itself has fewer than 3), ordered by relevance to this ICP (most relevant first). Always return each item's original "id" copied verbatim from the candidate pool — never invent a new id.`;
}

export interface CuratedDiscoveryQuestion {
  id: number;
  question: string;
}

export async function curateDiscoveryQuestions(
  companyName: string,
  candidates: DiscoveryQuestionCandidate[],
  icp: { product: string | null; targetIndustry: string | null; targetRole: string | null },
  language: Language = 'en',
): Promise<CuratedDiscoveryQuestion[] | null> {
  if (candidates.length === 0) return [];
  const t0 = Date.now();

  const icpLines = [
    `product: ${icp.product || '(not provided)'}`,
    `target_industry: ${icp.targetIndustry || '(not provided)'}`,
    `target_role: ${icp.targetRole || '(not provided)'}`,
  ].join('\n');

  const candidatesJson = JSON.stringify(candidates.map(c => ({ id: c.id, section: c.section, question: c.question })), null, 2);

  const schema = `Output only a JSON object matching this schema:
{"selected":[{"id":<candidate id, copied verbatim from the pool below>,"question":"The question — the original wording, or lightly rephrased for this ICP"}]}
Return 3-5 items (fewer only if the candidate pool has fewer than 3).`;

  const userMessage = `Company: ${companyName}

[Reader's ICP]
${icpLines}

[Candidate questions — id, originating section, question text]
${candidatesJson}

---

${schema}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      system: [{ type: 'text', text: discoveryQuestionCurationSystem(language), cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: userMessage }],
    });
    logCacheUsage('discovery_question_curation', response.usage);
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');
    const parsed = extractJson<{ selected: Array<{ id: number; question: string }> }>(raw, 'discovery_question_curation');
    if (!parsed?.selected || !Array.isArray(parsed.selected)) {
      console.error(`[claude] discovery_question_curation FAIL ${Date.now() - t0}ms — no selected array in response`);
      return null;
    }

    // 근거 검증: 실제로 넘긴 candidate id만 통과 — 지어낸 id나 근거 없는 항목은 버린다.
    const validIds = new Set(candidates.map(c => c.id));
    const result: CuratedDiscoveryQuestion[] = parsed.selected
      .filter(item => typeof item.id === 'number' && validIds.has(item.id) && typeof item.question === 'string' && item.question.trim())
      .slice(0, 5)
      .map(item => ({ id: item.id, question: item.question.trim() }));

    console.log(`[claude] discovery_question_curation OK ${Date.now() - t0}ms (${result.length}/${candidates.length} candidates selected)`);
    return result;
  } catch (err) {
    console.error(`[claude] discovery_question_curation FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

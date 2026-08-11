import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { fetchFinancialContext } from './financialContext';
import type { IndustryBenchmarkResult, CompetitorRevenueRanking } from '../services/industryBenchmarkService';

dotenv.config();

if (!process.env.ANTHROPIC_API_KEY) throw new Error('Missing ANTHROPIC_API_KEY');

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  products: { name: string; revenue_share: number }[];
  key_metrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[];
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
  bull_case: string;
  bear_case: string;
  oneLiner: string;
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
  why_durable: string;
  chasm_points: string[];
  key_bullets: string[];
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
  current_stage: string;
  next_inflection: string;
  key_bullets: string[];
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
  value_flow: string;
  subject_position: string;
  key_bullets: string[];
  sources: SectionSource[];
}

export interface RevenueStream {
  name: string;
  type: 'subscription' | 'transaction' | 'service' | 'license' | 'other';
  revenue_share: number;
  operating_margin: number;
  growth_rate: number;
}

export interface BusinessSegment {
  name: string;
  revenue_share: number;
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
  ten_year_durability: string;
  key_bullets: string[];
  sources: SectionSource[];
}

export interface FinancialsV2Row {
  item: string;
  fy2021?: string;
  fy2022?: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
  yoy?: string;
}

export interface FinancialsV2BSRow {
  item: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
}

export interface FinancialsV2 {
  narrative: string;
  income_statement: FinancialsV2Row[];
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
  sources: SectionSource[];
  // EDGAR 기업 전용 — Claude가 생성하지 않고 industryBenchmarkService가 순수 계산 후 병합(analyze.ts).
  industry_benchmark?: IndustryBenchmarkResult | null;
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
  sources?: SectionSource[];
}

export interface CrossIndustryNudgeV1 {
  industry_pain: {
    title: string;
    description: string;
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
    key_bullets: [], bull_case: '', bear_case: '', oneLiner: '', sources: [],
  },
  industry_history_v2: { industry_name: '', timeline: [], why_durable: '', chasm_points: [], key_bullets: [], sources: [] },
  tech_evolution_v2: { tech_name: '', stages: [], current_stage: '', next_inflection: '', key_bullets: [], sources: [] },
  value_chain_v2: { industry: '', layers: [], value_flow: '', subject_position: '', key_bullets: [], sources: [] },
  business_model_v2: {
    revenue_streams: [], segments: [],
    growth_motion: 'hybrid', growth_motion_detail: '',
    unit_economics: { gross_margin: 0, operating_margin: 0, net_margin: 0, fcf_margin: 0, nrr: 0 },
    moat: [],
    key_bullets: [], sources: [],
  },
  competitors_v2: { direct: [], indirect: [], substitutes: [], competitive_position: 'niche', key_bullets: [], sources: [] },
  cross_industry_nudge_v1: {
    industry_pain: { title: '', description: '', financial_impact_question: '' },
    cross_industry_example: { source_industry: '', case_name: '', solution_description: '' },
    key_bullets: [], sources: [],
  },
  strategy_v2: {
    corporate: { direction: '', portfolio: '', ma_partnerships: [], geographic: '' },
    business: { direction: '', competitive_advantage: '', go_to_market: '', product_roadmap: [] },
    financial: { direction: '', capital_allocation: '', investment_priority: '', return_target: '' },
    strategy_coherence: '', ten_year_durability: '', key_bullets: [], sources: [],
  },
  financials_v2: {
    narrative: '',
    income_statement: [], balance_sheet: [],
    cash_flow: { operating: '', investing: '', financing: '', fcf: '', notes: '' },
    key_risks: [],
    outlook: { shortTerm: '', midLongTerm: '', keyRisks: [] },
    key_bullets: [], sources: [],
  },
  founder_v2: {
    founders: [],
    career_trajectory: [],
    founding_history: { type: '1st_time', previous_ventures: [] },
    reputation: { sns_style: '-', media_exposure: '-', blind_glassdoor: '-' },
    network: { investors: [], advisors_board: [], cofounders: [] },
    key_bullets: [],
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
  return null;
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ── Section prompts ───────────────────────────────────────────────────────────

const SECTION_SYSTEM = `You are an expert company analyst. Using the provided research data, analyze only the specified section.
Rules: Output pure JSON only — no markdown, no code blocks, no extra commentary. Generate all content in English (keep company names, technology names, and tickers in their original form).

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
2. Any estimated or inferred number must end with the label "(estimated)". Example: "15.2% (estimated)".
3. If a data point isn't available, return "Not disclosed." Never make one up.
   Exception: if the provided context explicitly marks a metric as "Not applicable" / "structurally not
   reported" (e.g., a holding company or insurer whose SEC filings never tag operating income because of its
   segment structure), return "Not applicable" for that metric instead of "Not disclosed" — "Not disclosed"
   means "we looked but couldn't confirm it"; "Not applicable" means "this line item doesn't structurally
   exist for this company." Keep that distinction.
4. Don't state specific figures like regional revenue mix or named customers unless they're grounded in
   disclosed data.
5. Small or private companies can have real data gaps — say so plainly instead of filling the gap.

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

const SECTION_SCHEMAS: Record<string, string> = {
  summary_v2: `Output only a JSON object matching this schema:
{"company":"Company name","ticker":"TradingView-format ticker or null","industry":"Industry classification","hq":"HQ city, country","value_chain_position":"upstream|midstream|downstream","products":[{"name":"Product name","revenue_share":number}],"key_metrics":[{"label":"Revenue","value":"figure — 'Not disclosed' if unconfirmed","trend":"up|down|flat"},{"label":"Operating margin","value":"figure% — 'figure% (estimated)' if estimated","trend":"up|down|flat"},{"label":"Market cap","value":"figure","trend":"up|down|flat"},{"label":"YoY growth","value":"figure%","trend":"up|down|flat"}],"top_customers":["Only customer names confirmed by disclosure. Empty array [] if uncertain"],"customer_concentration":{"customers":[{"name":"Customer name","revenue_share":number confirmed by disclosure}],"top_n":number,"top_n_share":number,"is_concentrated":true,"trend":"concentrating|diversifying|stable"},"key_markets":[{"country":"Country","revenue_share":number confirmed by disclosure only — omit the entry if unavailable}],"trigger_events":[{"date":"YYYY-MM-DD or YYYY-MM","type":"Funding|Equity Offering|Major Deal","amount":"amount — empty string if unconfirmed","counterparty":"counterparty (investor/partner name) — empty string if unconfirmed","description":"1-line description, include [n] source markers","source_index":number}],"key_bullets":["Why this company is distinct in this market — core positioning, 8 words or fewer","This company's core growth driver, 8 words or fewer","This company's biggest execution risk, 8 words or fewer"],"bull_case":"Growth momentum: market expansion / partnership opportunity / competitive edge, 2 sentences max","bear_case":"Key risk: execution risk / competitive threat / regulatory or market variable, 2 sentences max","oneLiner":"1-2 sentence read on where this company stands right now, written so a strategy or sales practitioner gets it immediately","sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
top_customers: only names confirmed via IR or disclosure. Empty array if it's a guess. key_markets.revenue_share: if there's no disclosed figure, drop that country's entry entirely.
ticker must be returned in TradingView format: US NASDAQ → "NASDAQ:SYMBOL" (e.g. NASDAQ:NVDA), US NYSE → "NYSE:SYMBOL" (e.g. NYSE:PLTR), Korea KOSPI → "KRX:code" (e.g. KRX:005930), Korea KOSDAQ → "KOSDAQ:code" (e.g. KOSDAQ:388130), null if private or uncertain.
bull_case/bear_case: write from a strategy/practitioner point of view. No stock price, valuation, or investment-return language.
customer_concentration: return null outright if per-customer revenue share can't be confirmed from disclosure or IR. Never use 0% or an unconfirmable number. The customers array also only includes disclosure-confirmed figures — empty array [] if uncertain. top_n_share: combined share of the top N customers (return the whole object as null if not disclosed). is_concentrated: true if top_n_share >= 30.
trigger_events: base this only on the context's [Recent trigger event candidates] section (EDGAR 8-K excerpts or DART material-event filings) and recent funding/partnership info from web research — never speculate. Only events within the last 12 months, most recent first, max 3. If there's no evidence-backed event, return an empty array []. Leave amount/counterparty as an empty string if the source doesn't confirm them, but always fill date/type/description.
oneLiner rule: don't just list numbers — explain in narrative form why the number matters. Style example: "Revenue's up, margins aren't — this is a company mid-buildout, pouring cash into infrastructure before it pays off."`,

  industry_history_v2: `Output only a JSON object matching this schema:
{"industry_name":"Industry name","timeline":[{"period":"Time period","title":"Era title, 5 words or fewer","technology":"Core technology, 1 line","market_need":"Market need, 1 line","key_players":["Company name (country)"],"significance":"Why it matters, 1 line"}],"why_durable":"Why this industry endures, 2 sentences max","chasm_points":["Chasm moment and why, 1 line each, max 3"],"key_bullets":["This industry's single most decisive historical turning point, 8 words or fewer","What stage of development the industry is at now, 8 words or fewer","A structural risk unique to this industry, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
timeline: 4-6 entries in chronological order. Tag important facts in the body with [n] source markers.
Each timeline entry covers only industry-wide technology, market, or regulatory turning points. Never include a single company's funding round, VC raise, or M&A event — unless that company's tech/product launch itself reshaped the industry.
key_players: list only companies that were actually active in the market at that time. Never include VCs, private equity, financial investors, or accelerators.`,

  tech_evolution_v2: `Output only a JSON object matching this schema:
{"tech_name":"Core technology name","stages":[{"stage":1,"period":"Time period","title":"Stage title, 5 words or fewer","description":"Description, 2 sentences max","hype_level":"emerging|hype|trough|recovery|mainstream","key_enablers":["Key enabler, max 3"],"key_players":["Company name, max 4"]}],"current_stage":"Current stage, 1 line","next_inflection":"Next inflection point, 1 line","key_bullets":["Current maturity stage on the Hype Cycle, 8 words or fewer","The key trigger for the next inflection point, 8 words or fewer","The main barrier blocking wider adoption, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
stages: 4-6 entries. Tag important facts in the body with [n] source markers.`,

  value_chain_v2: `Output only a JSON object matching this schema:
{"industry":"Industry name","layers":[{"name":"Layer name","description":"Description, 1 line","is_subject":false,"pricing_power":"high|medium|low","bottleneck":false,"buyer":false,"global_leaders":[{"name":"Company name","country":"Country","why_leader":"Why it leads, 1 line"}]}],"value_flow":"Pricing pass-through mechanism, 2 sentences max","subject_position":"The analyzed company's position, 2 sentences max","key_bullets":["Where this company is strongest in the value chain, 8 words or fewer","The basis for its pricing power / negotiating leverage, 8 words or fewer","The biggest risk that comes from this value-chain structure, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
layers: 4-6 entries. Set is_subject:true on the layer the analyzed company belongs to.
For end-consumer/buyer layers (e.g. consumers, enterprise customers, government), set buyer:true and omit the pricing_power field.
Only set pricing_power:"high"|"medium"|"low" on supplier, manufacturing, or distribution layers.
Tag important facts in value_flow/subject_position with [n] source markers. Any URL confirmed via web search must go in sources[].url.`,

  business_model_v2: `Output only a JSON object matching this schema:
{"revenue_streams":[{"name":"Revenue stream","type":"subscription|transaction|service|license|other","revenue_share":number,"operating_margin":number,"growth_rate":number}],"segments":[{"name":"Segment name","revenue_share":number,"characteristics":"Characteristics, 1 line"}],"growth_motion":"PLG|SLG|FLG|hybrid","growth_motion_detail":"How growth works, 2 sentences max","unit_economics":{"gross_margin":number,"operating_margin":number,"net_margin":number,"fcf_margin":number,"nrr":number},"moat":[{"type":"Moat type","strength":"strong|medium|weak","description":"Moat description, 1 line"}],"key_bullets":["The core of this company's revenue engine — why it makes money, 8 words or fewer","The core moat holding up the business model, 8 words or fewer","A structural weakness or collapse risk in the business model, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
Tag important facts in growth_motion_detail/moat.description with [n] source markers. Any URL confirmed via web search must go in sources[].url.
operating_margin/growth_rate (inside revenue_streams) and unit_economics' gross_margin/operating_margin/net_margin/fcf_margin/nrr are numeric fields — return 0 if unconfirmable. Never use text like "Not disclosed"/"N/A" or a sentinel like -999 (that produces invalid JSON). For revenue_share, don't default to 0 if unconfirmable — always fill in a reasonable estimate.`,

  cross_industry_nudge_v1: `Output only a JSON object matching this schema:
{"industry_pain":{"title":"Pain point title, 8 words or fewer","description":"An operational or business pain point common across the analyzed company's industry (by SIC/KSIC classification) as a whole — not specific to this one company, 2 sentences max","financial_impact_question":"A question only — never a stated number, percentage, or dollar-figure conclusion — about how this pain point could hit the business financially. Example: 'How much of quarterly revenue could this bottleneck be putting at risk?'"},"cross_industry_example":{"source_industry":"The OTHER industry this solution came from — must be genuinely different from the analyzed company's own industry","case_name":"The company or case name that solved it","solution_description":"How that other industry solved an analogous operational problem, 2 sentences max"},"key_bullets":["Why this pain point matters right now for this company, 8 words or fewer","The core mechanism behind the cross-industry solution, 8 words or fewer","The single biggest condition for applying this solution here, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://..."}]}
Determine the analyzed company's industry (SIC/KSIC classification) from the provided context first. industry_pain must describe a pain point shared across that industry broadly, not a problem unique to this one company. cross_industry_example.source_industry must differ from the analyzed company's own industry — find a company in a different industry that solved a genuinely analogous operational problem. financial_impact_question must be phrased strictly as a question — never assert a number, percentage, or dollar-figure impact as fact. Both facts need at least one real, verifiable source URL in sources[].url — a real URL is required here (unlike other sections, don't leave it null); if you can't find a real source URL for a fact, drop that fact rather than inventing a URL. Tag both descriptions with [n] source markers.`,

  competitors_v2: `Output only a JSON object matching this schema:
{"direct":[{"name":"Competitor name","country":"Country","market_share":"share% (estimates OK)","strengths":["Strength, 1 line, max 3 — strategy/technology/market-power focused"],"weaknesses":["Weakness, 1 line, max 2 — structural weaknesses"],"vs_subject":"1-line positioning gap vs. the analyzed company — format like 'stronger on X, weaker on Y'"}],"indirect":[{"name":"Indirect competitor","threat":"Threat, 1 line"}],"substitutes":[{"name":"Substitute","threat":"Threat, 1 line"}],"competitive_position":"leader|challenger|niche|follower","key_bullets":["This company's competitive position — where it's strongest and weakest, 8 words or fewer","The clearest strategic differentiator versus competitors, 8 words or fewer","The most threatening competitive risk — where it could get flipped, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
direct: 3-5 global direct competitors required. If there's no public market_share figure, give an estimate tagged "(estimated)"; use "-" only when it's genuinely unknowable. vs_subject must not be a plain list — write one specific line on the strategic positioning gap (price, channel, technology, customer base, etc.). Tag important facts in the body with [n] source markers. Any URL confirmed via web search must go in sources[].url.`,

  strategy_v2: `Output only a JSON object matching this schema:
{"corporate":{"direction":"Corporate strategy, 1 line","portfolio":"Portfolio direction, 1 line","ma_partnerships":["M&A example, 1 line, max 3"],"geographic":"Geographic expansion, 1 line"},"business":{"direction":"Business strategy, 1 line","competitive_advantage":"Competitive edge, 1 line","go_to_market":"GTM strategy, 1 line","product_roadmap":["Roadmap item, 1 line, max 4"]},"financial":{"direction":"Financial strategy, 1 line","capital_allocation":"Capital allocation, 1 line","investment_priority":"Investment priority, 1 line","return_target":"Target return metric, 1 line"},"strategy_coherence":"How the 3 strategies converge, 2 sentences max","ten_year_durability":"10-year durability, 2 sentences max","key_bullets":["The core direction of corporate strategy in one line, 8 words or fewer","Business strategy — how it wins, 8 words or fewer","Financial strategy — where it's betting, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
Tag important facts in strategy_coherence/ten_year_durability with [n] source markers. Any URL confirmed via web search must go in sources[].url.`,

  financials_v2: `Output only a JSON object matching this schema:
{"narrative":"Financial narrative, 3 sentences max","income_statement":[{"item":"Revenue","fy2021":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2022":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2023":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2024":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2025":"disclosed figure or 'figure (estimated)' or 'Not disclosed' or 'Not applicable'","yoy":"▲N% or ▼N% or —"},{"item":"Gross Profit","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"Operating Income","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"Net Income","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"EBITDA","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""}],"balance_sheet":[{"item":"Cash & Equivalents","fy2023":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2024":"disclosed figure or 'Not disclosed' or 'Not applicable'","fy2025":"disclosed figure or 'figure (estimated)' or 'Not disclosed' or 'Not applicable'"},{"item":"Total Assets","fy2023":"","fy2024":"","fy2025":""},{"item":"Total Liabilities","fy2023":"","fy2024":"","fy2025":""},{"item":"Total Equity","fy2023":"","fy2024":"","fy2025":""}],"cash_flow":{"operating":"disclosed figure or 'Not disclosed'","investing":"disclosed figure or 'Not disclosed'","financing":"disclosed figure or 'Not disclosed'","fcf":"disclosed figure or 'figure (estimated)' or 'Not disclosed'","notes":"anything notable, or an empty string"},"key_risks":["Risk, 1 line, max 5"],"outlook":{"shortTerm":"Short-term outlook (3-6 months) — include a symbol: ○ positive / △ neutral / ▼ negative","midLongTerm":"Mid/long-term outlook (1-3 years) — include a symbol: ○ positive / △ neutral / ▼ negative","keyRisks":["Key risk, 1 line, max 3"]},"key_bullets":["The financial metric and trend most worth flagging, 8 words or fewer","Core state of profitability and cash flow, 8 words or fewer","The single biggest risk in the financial structure, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"","content":"","url":""}]}
income_statement/balance_sheet: never leave a cell blank — if there's no disclosed figure, it must be 'Not disclosed'. Exception: if the context's [Years missing from source data] section explicitly marks a given year as having no data (the source filing has no financial statement at all for that year), label that year 'Not applicable' instead of 'Not disclosed' — "Not disclosed" means "we looked but couldn't confirm it," "Not applicable" means "that year's data doesn't exist in the first place." Keep the distinction. Estimated values must always use the 'number (estimated)' format.
Tag the narrative and key figures with [n] source markers.
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
  industry_history_v2: { text: ['why_durable'],                                 arrays: ['timeline', 'chasm_points', 'key_bullets'] },
  tech_evolution_v2:   { text: ['current_stage', 'next_inflection'],            arrays: ['stages', 'key_bullets'] },
  value_chain_v2:      { text: ['value_flow'],                                  arrays: ['layers', 'key_bullets'] },
  business_model_v2:   { text: ['growth_motion_detail'],                        arrays: ['revenue_streams', 'segments', 'moat', 'key_bullets'] },
  competitors_v2:      {                                                        arrays: ['direct', 'indirect', 'substitutes', 'key_bullets'] },
  cross_industry_nudge_v1: {                                                    arrays: ['key_bullets', 'sources'] },
  strategy_v2:          { text: ['strategy_coherence', 'ten_year_durability'],  arrays: ['key_bullets', 'corporate.ma_partnerships', 'business.product_roadmap'] },
  financials_v2:         { text: ['narrative'],                                 arrays: ['income_statement', 'balance_sheet', 'key_risks', 'key_bullets'] },
};

function isPlaceholderText(v: unknown): boolean {
  return typeof v === 'string' && ['', '확인 필요', 'N/A', 'unknown'].includes(v.trim());
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
async function gatherResearch1(companyName: string): Promise<string> {
  const systemPrompt = `You are a company research analyst. Use quick web searches to gather only basic company info and the latest status.

[Rules]
- fetch_url at most once. Only IR press releases, Yahoo Finance, or StockAnalysis allowed.
- If the snippet already has the number, use it without fetch_url.
- Never fetch raw SEC Archives filings or large PDFs.

[Search order — 2 searches max]
1. web_search: "${companyName} overview products services revenue business model 2024 2025"
2. web_search: "${companyName} news strategy funding investment partnership deal recent 2025"

[What to collect]
1. Company overview (business areas, key products/services, founding year, HQ, ticker)
2. Rough revenue figure (cite the source, skip if unavailable)
3. Business model summary (revenue structure, key customers)
4. Latest news / major developments (2025)
5. Growth momentum / key risks
6. Funding rounds or major partnerships/deals in the last 12 months (date, amount, counterparty, source — skip if unavailable)

Label any estimated figure "(estimated)".`;

  // analyzeCompany에서 runBatch 밖에서 직접 await하는 호출이라, 여기서 예외가 새면
  // 배치 격리 없이 전체 분석이 죽는다 (2026-07-06 삼성전기 사고) — 반드시 자체 방어.
  try {
    return await runWithWebSearch(
      systemPrompt,
      `Company: ${companyName}\n\nGather basic company info quickly with 2 searches.`,
      'claude-sonnet-4-6',
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
async function gatherResearch2(companyName: string): Promise<string> {
  const systemPrompt = `You are a company research analyst. Gather competitor, financial-detail, and industry-depth information.

[Rules]
- fetch_url at most once. Only Yahoo Finance, Macrotrends, StockAnalysis, or IR press releases allowed.
- If the snippet already has the number, use it without fetch_url.
- Never fetch raw SEC Archives filings or large PDFs.

[Search order — 2 searches max]
1. web_search: "${companyName} competitors market share industry trends value chain 2024 2025"
2. web_search: "${companyName} annual revenue net income financials technology 2023 2024 2025"

[What to collect]
1. Key competitors + estimated market share (cite the source)
2. Financial detail (revenue, operating income, net income — last 3 years, cite the source)
3. Industry trends / technology shifts
4. Position in the value chain / supply-chain structure
5. Strategic direction (M&A, new businesses, geographic expansion)

Label any estimated figure "(estimated)". Source citation is required.`;

  // gatherResearch1과 동일한 이유로 자체 방어 필요 (runBatch 밖에서 직접 await됨).
  try {
    return await runWithWebSearch(
      systemPrompt,
      `Company: ${companyName}\n\nGather detailed competitor/financial/industry info with 2 searches.`,
      'claude-sonnet-4-6',
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

async function callSection<T>(context: string, sectionKey: string): Promise<T | null> {
  const t0 = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: [{ type: 'text', text: SECTION_SYSTEM, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{
        role: 'user',
        content: `${context}\n\n---\n\n${SECTION_SCHEMAS[sectionKey]}`,
      }],
    });
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
        if (!r.bull_case) console.warn(`[quality-gate] summary_v2.bull_case 비어있음`);
        if (!r.bear_case) console.warn(`[quality-gate] summary_v2.bear_case 비어있음`);
      }
      if (sectionKey === 'business_model_v2' && !r.growth_motion_detail) {
        console.warn(`[quality-gate] business_model_v2.growth_motion_detail 비어있음`);
      }
    }
    // ─────────────────────────────────────────────────────────────────────
    console.log(`[claude] ${sectionKey} OK  ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.error(`[claude] ${sectionKey} FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

// ── Founder section (own web-search pass) ─────────────────────────────────────

async function callFounderSection(companyName: string): Promise<FounderV2 | null> {
  const t0 = Date.now();
  try {
    const systemPrompt = [{ type: 'text' as const, text: `You are an expert on company founders. Use web search to gather founder/CEO information, then return only the specified JSON schema.
Rules: Output pure JSON only — no markdown, no code blocks, no extra commentary. Generate all content in English (keep names and company names in their original form).
Mark any item you can't find as "-". For a private company, research this section more deeply than the financials.`, cache_control: { type: 'ephemeral' as const } }];

    const schema = `Output only a JSON object matching this schema:
{"founders":[{"name":"Name","title":"Title","education":"School or '-'","major":"Major or '-'"}],"career_trajectory":[{"period":"Period (e.g. 2018-present)","company":"Company name","role":"Title/role"}],"founding_history":{"type":"1st_time|serial","previous_ventures":[{"name":"Company name","result":"exit|closed|operating","exit_type":"M&A|IPO|null"}]},"reputation":{"sns_style":"Social media style, 1 line, or '-'","media_exposure":"Notable media exposure, 1 line, or '-'","blind_glassdoor":"Blind/Glassdoor reputation summary, 1 line, or '-'"},"network":{"investors":["Investor name/firm, max 5"],"advisors_board":["Advisor/board member, max 5"],"cofounders":["Co-founder name, max 5"]},"key_bullets":["This founder's core strength — why they're the right person for this business, 8 words or fewer","The most notable thing in the founder's network/track record, 8 words or fewer","Founder risk — the biggest concern, 8 words or fewer"],"sources":[{"index":1,"level":"L1","organization":"Source organization name","content":"Key point, 1 line","url":"https://... or null"}]}
career_trajectory: sort most recent first. Empty array [] if founding_history.previous_ventures has none. Any LinkedIn/news/Crunchbase URL confirmed via search must go in sources[].url.`;

    const raw = await runWithWebSearch(
      systemPrompt,
      `Company: ${companyName}\n\nGather founder/CEO information using this search order:\n1. "${companyName} founder CEO name background education"\n2. "${companyName} founder serial entrepreneur exit history"\n3. "${companyName} investor board advisor"\n\nThen return the data using this schema:\n${schema}`,
      'claude-sonnet-4-6',
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

async function gatherFinancialResearch(companyName: string): Promise<string> {
  const systemPrompt = `You are a company financial analyst. Gather only the latest financial data for the company below.

[Source reliability]
Tier 1 — official disclosure: SEC 10-K/10-Q, DART, company IR
Tier 2 — Bloomberg, Reuters, Yahoo Finance, Macrotrends
Anything below tier 2 must be labeled "(estimated)".

[Search order]
1. web_search: "${companyName} annual report revenue operating income net income 2023 2024 2025"
2. web_search: "${companyName} SEC 10-K OR DART financial statements 2024 2025"
3. For any SEC EDGAR / DART / IR URL in the results → fetch_url to read it in full

Cite the source for every figure. Mark anything you can't find "Not disclosed".`;

  return runWithWebSearch(
    systemPrompt,
    `Company: ${companyName}\n\nGather the latest financial data.`,
    'claude-sonnet-4-6',
    6,
    4000,
    'gatherFinancialResearch',
  );
}

export async function refreshFinancials(companyName: string): Promise<FinancialsV2> {
  const [{ contextText }, researchText] = await Promise.all([
    fetchFinancialContext(companyName),
    gatherFinancialResearch(companyName),
  ]);

  const context = [
    `Company: ${companyName}`,
    contextText ? `\n[Disclosed data — prioritize these figures]\n${contextText}` : null,
    `\n[Web research]\n${researchText}`,
  ].filter(Boolean).join('\n');

  const result = await callSection<FinancialsV2>(context, 'financials_v2');
  return result ?? DEFAULT_ANALYSIS_DATA.financials_v2;
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
    // financials_v2 전용 SEC 산업 벤치마크 컨텍스트(server/src/lib/secIndustryBenchmark.ts,
    // 2026-08-11) — sharedContext에 안 섞고 financials_v2 callSection 호출에만 덧붙인다.
    // 다른 섹션(summary_v2 등)에 벤치마크 언급이 새어 들어가지 않도록 하기 위함.
    secBenchmarkContext?: string | null;
  },
): Promise<AnalysisData> {
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
      () => [callSection<SummaryV2>(phase1Context, 'summary_v2')],
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
  const financialsContext = sharedContext + (opts?.secBenchmarkContext ?? '');
  // 2026-08 재편: industry_history_v2/tech_evolution_v2를 "pain 진단 시작" 버튼 트리거
  // 온디맨드 엔드포인트(POST /api/analyze/:id/pain-diagnosis)로 완전히 분리하면서 배치가
  // 2/3/4 세 개로 줄었다 — founder_v2(구 배치5)는 sources와 함께 배치4로, financials_v2는
  // value_chain_v2/strategy_v2와 함께 배치3으로 재배치.
  await Promise.all([
    runBatch(2,
      () => [
        callSection<BusinessModelV2>(sharedContext, 'business_model_v2'),
        callSection<CompetitorsV2>(sharedContext, 'competitors_v2'),
        callSection<CrossIndustryNudgeV1>(sharedContext, 'cross_industry_nudge_v1'),
      ],
      ([bm, c, n]) => ({
        business_model_v2:       bm ?? DEFAULT_ANALYSIS_DATA.business_model_v2,
        competitors_v2:          c  ?? DEFAULT_ANALYSIS_DATA.competitors_v2,
        cross_industry_nudge_v1: n  ?? DEFAULT_ANALYSIS_DATA.cross_industry_nudge_v1,
      }),
    ),
    runBatch(3,
      () => [
        callSection<ValueChainV2>(sharedContext, 'value_chain_v2'),
        callSection<StrategyV2>(sharedContext, 'strategy_v2'),
        cachedFin ? Promise.resolve(cachedFin) : callSection<FinancialsV2>(financialsContext, 'financials_v2'),
      ],
      ([vc, s, f]) => {
        // Rule 4: 재무 수치 전년 대비 10배 이상 변동 → (추정) 뱃지 강제 적용
        if (f?.income_statement) {
          for (const row of f.income_statement) {
            const pct = row.yoy?.match(/[▲▼](\d+(?:\.\d+)?)%/);
            if (pct && parseFloat(pct[1]) >= 900) {
              const isNoData = (v: string | undefined) =>
                !v || ['확인 필요', '해당없음', 'Not disclosed', 'Not applicable'].includes(v);
              const yr = (['fy2025', 'fy2024', 'fy2023', 'fy2022', 'fy2021'] as const)
                .find(y => !isNoData(row[y]));
              if (yr && !row[yr]!.includes('추정') && !row[yr]!.includes('estimated')) {
                row[yr] = row[yr] + ' (estimated)';
                console.warn(`[quality-gate] financials ${row.item} YoY ${row.yoy} → ${yr} (estimated) 강제 적용`);
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
        callFounderSection(companyName),
        callSection<AnalysisSources>(sharedContext, 'sources'),
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
    (['fy2021', 'fy2022', 'fy2023', 'fy2024', 'fy2025'] as const).some(
      y => row[y] && row[y] !== '확인 필요'
    )
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
): Promise<any> {
  if (sectionKey === 'founder_v2') {
    return callFounderSection(companyName);
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
  return callSection(context, sectionKey);
}

// ── Growth scenario narrative (몬테카를로 시뮬레이션 결과 한줄 해석) ──────────

export interface GrowthScenarioForNarrative {
  simulation: { p10: number[]; p50: number[]; p90: number[] };
  confidenceLevel: 'high' | 'low';
  currency: 'KRW' | 'USD';
  sectorTag?: string;
}

const GROWTH_SCENARIO_NARRATIVE_SYSTEM = `You are a company analyst writing for BD, Sales, and Strategy practitioners.
Based on the Monte Carlo revenue growth simulation results below, write a 1-2 sentence core interpretation.

Rules:
- No investor language — never say "valuation," "enterprise value," "investment return," "stock price."
- Write from a partnership/deal/sales-decision point of view (e.g. "the expected revenue growth range if you partner with this company is...").
- If confidence is low, the sentence must convey that this is "an estimate based on industry benchmarks" —
  don't hide the fact that it isn't this company's own official financial data.
- Output pure text only, 1-2 sentences — no markdown, no quotes, no bullets.`;

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
): Promise<string | null> {
  const { simulation, confidenceLevel, currency, sectorTag } = scenario;

  const userPrompt = `Company: ${companyName}
Confidence: ${confidenceLevel === 'high' ? "based on the company's own official financial time series" : `estimated from industry (${sectorTag ?? 'sector'}) benchmarks`}
${formatScenarioForPrompt(currency, simulation)}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: GROWTH_SCENARIO_NARRATIVE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });
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

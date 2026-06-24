import Anthropic from '@anthropic-ai/sdk';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

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

export interface SummaryV2 {
  company: string;
  ticker: string | null;
  industry: string;
  hq: string;
  value_chain_position: 'upstream' | 'midstream' | 'downstream';
  products: { name: string; revenue_share: number }[];
  key_metrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[];
  top_customers: string[];
  key_markets: { country: string; revenue_share: number }[];
  one_line: string;
  bull_case: string;
  bear_case: string;
  oneLiner: string;
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
  munger_buffett_metrics: {
    roe: string;
    roic: string;
    owner_earnings: string;
    debt_to_equity: string;
    interest_coverage: string;
    reinvestment_rate: string;
  };
  key_risks: string[];
  outlook: {
    shortTerm: string;
    midLongTerm: string;
    keyRisks: string[];
  };
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
  one_liner: string;
}

export interface AnalysisData {
  summary_v2: SummaryV2;
  industry_history_v2: IndustryHistoryV2;
  tech_evolution_v2: TechEvolutionV2;
  value_chain_v2: ValueChainV2;
  business_model_v2: BusinessModelV2;
  competitors_v2: CompetitorsV2;
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
    one_line: '', bull_case: '', bear_case: '', oneLiner: '',
  },
  industry_history_v2: { industry_name: '', timeline: [], why_durable: '', chasm_points: [] },
  tech_evolution_v2: { tech_name: '', stages: [], current_stage: '', next_inflection: '' },
  value_chain_v2: { industry: '', layers: [], value_flow: '', subject_position: '' },
  business_model_v2: {
    revenue_streams: [], segments: [],
    growth_motion: 'hybrid', growth_motion_detail: '',
    unit_economics: { gross_margin: 0, operating_margin: 0, net_margin: 0, fcf_margin: 0, nrr: 0 },
    moat: [],
  },
  competitors_v2: { direct: [], indirect: [], substitutes: [], competitive_position: 'niche' },
  strategy_v2: {
    corporate: { direction: '', portfolio: '', ma_partnerships: [], geographic: '' },
    business: { direction: '', competitive_advantage: '', go_to_market: '', product_roadmap: [] },
    financial: { direction: '', capital_allocation: '', investment_priority: '', return_target: '' },
    strategy_coherence: '', ten_year_durability: '',
  },
  financials_v2: {
    narrative: '',
    income_statement: [], balance_sheet: [],
    cash_flow: { operating: '', investing: '', financing: '', fcf: '', notes: '' },
    munger_buffett_metrics: { roe: '', roic: '', owner_earnings: '', debt_to_equity: '', interest_coverage: '', reinvestment_rate: '' },
    key_risks: [],
    outlook: { shortTerm: '', midLongTerm: '', keyRisks: [] },
  },
  founder_v2: {
    founders: [],
    career_trajectory: [],
    founding_history: { type: '1st_time', previous_ventures: [] },
    reputation: { sns_style: '-', media_exposure: '-', blind_glassdoor: '-' },
    network: { investors: [], advisors_board: [], cofounders: [] },
    one_liner: '-',
  },
  sources: {},
};

// ── Low-level helpers ─────────────────────────────────────────────────────────

async function fetchUrlContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
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
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxRounds = 10,
  maxTokens = 16000,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

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
          console.log(`[fetch_url] ${url}`);
          const content = await fetchUrlContent(url);
          return { type: 'tool_result' as const, tool_use_id: b.id, content };
        }
        return { type: 'tool_result' as const, tool_use_id: b.id };
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  throw new Error('Max conversation rounds exceeded');
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)), ms)
    ),
  ]);
}

// ── Section prompts ───────────────────────────────────────────────────────────

const SECTION_SYSTEM = `당신은 전문 기업 분석가입니다. 제공된 리서치 데이터를 바탕으로 지정된 섹션만 분석합니다.
규칙: 마크다운·코드블록·추가 설명 없이 순수 JSON만 출력. 모든 텍스트는 한국어 (기업명·기술명·티커는 원어 유지).

[데이터 신뢰성 원칙]
1. 확인된 데이터만 수치로 제시. 출처(10-K, IR, DART 등) 확인 가능한 것만.
2. 추정·추론한 수치는 반드시 값 끝에 "(추정)" 레이블 명시. 예: "15.2% (추정)"
3. 데이터가 없는 항목은 "확인 필요"로 반환. 절대 임의로 채우지 말 것.
4. 지역별 매출 비중·고객사명 등 구체적 수치는 공시 데이터 기반이 아니면 제시 금지.
5. 소규모·비상장 기업은 데이터 공백이 많을 수 있음 — 없으면 없다고 명시.`;

const SECTION_SCHEMAS: Record<string, string> = {
  summary_v2: `아래 스키마의 JSON 객체만 출력:
{"company":"기업명","ticker":"TradingView 형식 티커 or null","industry":"산업분류","hq":"본사 도시, 국가","value_chain_position":"upstream|midstream|downstream","products":[{"name":"제품명","revenue_share":숫자}],"key_metrics":[{"label":"매출","value":"수치 — 공시 미확인 시 '확인 필요'","trend":"up|down|flat"},{"label":"영업이익률","value":"수치% — 추정 시 '수치% (추정)'","trend":"up|down|flat"},{"label":"시가총액","value":"수치","trend":"up|down|flat"},{"label":"YoY 성장률","value":"수치%","trend":"up|down|flat"}],"top_customers":["공시 확인된 고객사명만. 불확실 시 빈 배열 []"],"key_markets":[{"country":"국가","revenue_share":공시 확인된 숫자만. 없으면 항목 제외}],"one_line":"투자자 관점 핵심 한줄 20자이내","bull_case":"강세 시나리오 2줄이내","bear_case":"약세 시나리오 2줄이내","oneLiner":"이 기업의 현재 상황을 투자자·실무자가 바로 이해할 수 있는 1~2문장 핵심 해석"}
top_customers: IR·공시에서 확인된 것만. 추정이면 빈 배열. key_markets.revenue_share: 공시 수치 없으면 해당 국가 항목 자체를 제외.
ticker 필드는 반드시 TradingView 형식으로 반환: 미국 NASDAQ 상장 → "NASDAQ:심볼" (예: NASDAQ:NVDA), 미국 NYSE 상장 → "NYSE:심볼" (예: NYSE:PLTR), 한국 코스피 → "KRX:종목코드" (예: KRX:005930), 한국 코스닥 → "KOSDAQ:종목코드" (예: KOSDAQ:388130), 비상장 또는 불확실하면 null.
oneLiner 규칙: 숫자 나열 금지. "왜 이 숫자가 의미있는가"를 서사로 설명. 예시 스타일: "매출은 늘었는데 이익은 줄었다 — 글로벌 인프라에 돈을 쏟아붓는 투자 시즌".`,

  industry_history_v2: `아래 스키마의 JSON 객체만 출력:
{"industry_name":"산업명","timeline":[{"period":"시기","title":"시대제목 15자이내","technology":"핵심기술 1줄","market_need":"시장수요 1줄","key_players":["기업명(국가)"],"significance":"중요성 1줄"}],"why_durable":"지속가능이유 2줄이내","chasm_points":["캐즘시점과이유 1줄 최대3개"]}
timeline은 연대순 4~6개.`,

  tech_evolution_v2: `아래 스키마의 JSON 객체만 출력:
{"tech_name":"핵심기술명","stages":[{"stage":1,"period":"시기","title":"단계제목 15자이내","description":"설명 2줄이내","hype_level":"emerging|hype|trough|recovery|mainstream","key_enablers":["핵심요인 최대3개"],"key_players":["기업명 최대4개"]}],"current_stage":"현재단계 1줄","next_inflection":"다음변곡점 1줄"}
stages는 4~6개.`,

  value_chain_v2: `아래 스키마의 JSON 객체만 출력:
{"industry":"산업명","layers":[{"name":"레이어명","description":"설명 1줄","is_subject":false,"pricing_power":"high|medium|low","bottleneck":false,"global_leaders":[{"name":"기업명","country":"국가","why_leader":"선도이유 1줄"}]}],"value_flow":"가격전가메커니즘 2줄이내","subject_position":"분석기업 포지션 2줄이내"}
layers는 4~6개. 분석 대상 기업이 속한 레이어에 is_subject:true 설정.`,

  business_model_v2: `아래 스키마의 JSON 객체만 출력:
{"revenue_streams":[{"name":"수익원","type":"subscription|transaction|service|license|other","revenue_share":숫자,"operating_margin":숫자,"growth_rate":숫자}],"segments":[{"name":"세그먼트명","revenue_share":숫자,"characteristics":"특성 1줄"}],"growth_motion":"PLG|SLG|FLG|hybrid","growth_motion_detail":"성장방식 2줄이내","unit_economics":{"gross_margin":숫자,"operating_margin":숫자,"net_margin":숫자,"fcf_margin":숫자,"nrr":숫자},"moat":[{"type":"해자유형","strength":"strong|medium|weak","description":"해자설명 1줄"}]}`,

  competitors_v2: `아래 스키마의 JSON 객체만 출력:
{"direct":[{"name":"경쟁사명","country":"국가","market_share":"점유율","strengths":["강점 1줄 최대3개"],"weaknesses":["약점 1줄 최대2개"],"vs_subject":"차별점 1줄"}],"indirect":[{"name":"간접경쟁사","threat":"위협 1줄"}],"substitutes":[{"name":"대체재","threat":"위협 1줄"}],"competitive_position":"leader|challenger|niche|follower"}
direct는 글로벌 직접 경쟁사 3~5개 필수.`,

  strategy_v2: `아래 스키마의 JSON 객체만 출력:
{"corporate":{"direction":"기업전략 한줄","portfolio":"포트폴리오방향 1줄","ma_partnerships":["M&A사례 1줄 최대3개"],"geographic":"지역확장 1줄"},"business":{"direction":"사업전략 한줄","competitive_advantage":"경쟁우위 1줄","go_to_market":"GTM전략 1줄","product_roadmap":["로드맵항목 1줄 최대4개"]},"financial":{"direction":"재무전략 한줄","capital_allocation":"자본배분 1줄","investment_priority":"투자우선순위 1줄","return_target":"목표수익지표 1줄"},"strategy_coherence":"3전략 수렴방향 2줄이내","ten_year_durability":"10년 지속가능성 2줄이내"}`,

  financials_v2: `아래 스키마의 JSON 객체만 출력:
{"narrative":"재무서사 3줄이내","income_statement":[{"item":"매출","fy2021":"공시값 or '확인 필요'","fy2022":"공시값 or '확인 필요'","fy2023":"공시값 or '확인 필요'","fy2024":"공시값 or '확인 필요'","fy2025":"공시값 or '수치 (추정)' or '확인 필요'","yoy":"▲N% or ▼N% or —"},{"item":"매출총이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"영업이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"순이익","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""},{"item":"EBITDA","fy2021":"","fy2022":"","fy2023":"","fy2024":"","fy2025":"","yoy":""}],"balance_sheet":[{"item":"현금·현금성자산","fy2023":"공시값 or '확인 필요'","fy2024":"공시값 or '확인 필요'","fy2025":"공시값 or '수치 (추정)' or '확인 필요'"},{"item":"총자산","fy2023":"","fy2024":"","fy2025":""},{"item":"총부채","fy2023":"","fy2024":"","fy2025":""},{"item":"자본총계","fy2023":"","fy2024":"","fy2025":""}],"cash_flow":{"operating":"공시값 or '확인 필요'","investing":"공시값 or '확인 필요'","financing":"공시값 or '확인 필요'","fcf":"공시값 or '수치 (추정)' or '확인 필요'","notes":"특이사항 or 빈문자"},"munger_buffett_metrics":{"roe":"공시값% or '수치% (추정)' or '확인 필요'","roic":"공시값% or '수치% (추정)' or '확인 필요'","owner_earnings":"공시값 or '확인 필요'","debt_to_equity":"공시값 or '확인 필요'","interest_coverage":"공시값 or '확인 필요'","reinvestment_rate":"공시값% or '수치% (추정)' or '확인 필요'"},"key_risks":["리스크 1줄 최대5개"],"outlook":{"shortTerm":"단기 전망 (3~6개월) — 심볼 포함: ○ 긍정 / △ 중립 / ▼ 부정","midLongTerm":"중장기 전망 (1~3년) — 심볼 포함: ○ 긍정 / △ 중립 / ▼ 부정","keyRisks":["핵심 리스크 1줄 최대3개"]}}
income_statement·balance_sheet 빈칸 절대 금지 — 공시 수치 없으면 반드시 '확인 필요'. 추정값은 반드시 '숫자 (추정)' 형식.
outlook 규칙: 재무 데이터 기반으로 작성. 근거 없는 낙관 금지. shortTerm·midLongTerm 앞에 반드시 ○/△/▼ 심볼 명시.`,

  sources: `아래 스키마의 JSON 객체만 출력. 리서치에서 실제로 참조한 출처를 탭별로 정리:
{"summary":[{"index":1,"level":"L1","organization":"기관명","date":"Mon YYYY","content":"핵심 내용 1줄","isEstimate":false,"url":"https://... or null"}],"industry_history":[...],"tech_evolution":[...],"value_chain":[...],"business_model":[...],"competitors":[...],"strategy":[...],"financials":[...]}

신뢰 등급 기준:
- L1: 기업 공식 발표, CFO/CEO 블로그, SEC 10-K/10-Q, DART 공시, 기업 IR 자료
- L2: Bloomberg, Reuters, WSJ, Fortune, CNBC, Financial Times, HSBC, Sacra, Menlo Ventures, CB Insights, Gartner
- L3: 기관 추정치, 2차 분석, 일반 뉴스/블로그 — 반드시 isEstimate:true

규칙:
- 각 탭당 1~5개 출처. 실제로 참조한 출처만 포함 (없으면 빈 배열 []).
- organization은 출처 기관명만 (예: "Bloomberg", "OpenAI 공식", "SEC EDGAR", "DART").
- date는 "Mar 2026" 형식.
- content는 해당 출처에서 가져온 핵심 내용 1줄 (수치·사실 중심).
- url은 실제 검색에서 확인된 URL만. 없으면 null.
- L3 항목은 반드시 isEstimate:true.`,
};

// ── Research gathering (1 web-search pass) ────────────────────────────────────

async function gatherResearch(companyName: string): Promise<string> {
  const systemPrompt = `당신은 기업 분석 리서처입니다. 아래 기업에 대해 웹 검색 및 페이지 전체 내용 읽기를 통해 핵심 정보를 수집하고, 수집된 사실을 항목별로 정리해주세요.

[도구 사용 방법]
- web_search: 검색 쿼리로 관련 URL과 스니펫을 찾습니다
- fetch_url: 검색 결과에서 중요한 URL의 전체 내용을 읽습니다
  → SEC EDGAR 공시, DART 공시, 기업 IR 페이지, 주요 뉴스 기사 등은 반드시 fetch_url로 전체 내용을 읽어서 정확한 수치를 확보하세요

[소스 신뢰도 우선순위]
1순위 — 공식 공시: SEC 10-K/10-Q, DART, 기업 IR 자료, 공식 프레스릴리즈
2순위 — 주요 금융 데이터: Bloomberg, Reuters, Yahoo Finance, Macrotrends
3순위 — 산업 리서치: CB Insights, Gartner, IDC, Statista
4순위 — 주요 언론: Financial Times, WSJ, Forbes, 한국경제, 매일경제
5순위 — 일반 뉴스/블로그: 추정/미확인 레이블 필수

우선순위 높은 소스에서 데이터를 찾지 못한 경우에만 다음 순위로 이동.
수치 데이터(매출, 마진, 점유율 등)는 반드시 1~2순위 소스에서만 확정값으로 사용.
3순위 이하 소스의 수치는 반드시 '(추정)' 레이블 명시.
소스에서 찾을 수 없는 데이터는 null 반환. 절대 임의로 채우지 말 것.

[검색 및 읽기 순서]
1. web_search: "${companyName} SEC 10-K annual report 2024 2025" → 결과 중 SEC EDGAR URL 있으면 fetch_url로 전체 읽기
2. web_search: "${companyName} IR earnings revenue financials" → IR 페이지 URL 있으면 fetch_url로 전체 읽기
3. web_search: "${companyName} market share competitors industry analysis"
4. web_search: "${companyName} business model strategy"
5. web_search: "${companyName} recent news 2025" → 중요 기사 1~2개 fetch_url로 전체 읽기

[수집 항목]
1. 기업 개요 (설립연도, 본사, 사업영역, 주요 제품/서비스, 시가총액, 티커)
2. 최근 3~5년 재무 데이터 (매출, 영업이익, 순이익, FCF, 이익률) — 1~2순위 소스 우선
3. 사업 모델 (수익 구조, 고객 세그먼트, 성장 방식)
4. 밸류체인 위치 (핵심 공급사, 주요 고객사) — 공시 확인된 것만
5. 경쟁 현황 (주요 경쟁사, 시장점유율) — 출처 명시
6. 전략 방향 (최근 M&A, 투자, 신규 사업, 지역 확장)
7. 산업/기술 트렌드
8. 리스크 요소

JSON 불필요. 각 수치에 출처 소스명 병기. 확인 불가 항목은 "확인 필요"로 명시.`;

  return runWithWebSearch(
    systemPrompt,
    `기업명: ${companyName}\n\n위 검색 및 읽기 순서에 따라 정보를 수집해주세요.`,
    'claude-sonnet-4-6',
    10,
    8000,
  );
}

// ── Section call (no web search, uses shared context) ─────────────────────────

async function callSection<T>(context: string, sectionKey: string): Promise<T | null> {
  const t0 = Date.now();
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SECTION_SYSTEM,
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
    const systemPrompt = `당신은 기업 창업자 분석 전문가입니다. 웹 검색으로 창업자/CEO 정보를 수집한 뒤 지정된 JSON 스키마로만 반환합니다.
규칙: 마크다운·코드블록·추가 설명 없이 순수 JSON만 출력. 모든 텍스트는 한국어 (인명·기업명은 원어 유지).
정보가 없는 항목은 반드시 "-" 표시. 비상장사일 경우 재무보다 이 섹션 분량을 더 깊게 조사.`;

    const schema = `아래 스키마의 JSON 객체만 출력:
{"founders":[{"name":"이름","title":"직책","education":"출신학교 또는 '-'","major":"전공 또는 '-'"}],"career_trajectory":[{"period":"기간(예: 2018–현재)","company":"기업명","role":"직책/역할"}],"founding_history":{"type":"1st_time|serial","previous_ventures":[{"name":"기업명","result":"exit|closed|operating","exit_type":"M&A|IPO|null"}]},"reputation":{"sns_style":"SNS 스타일 1줄 또는 '-'","media_exposure":"주요 미디어 노출 1줄 또는 '-'","blind_glassdoor":"Blind/Glassdoor 평판 요약 1줄 또는 '-'"},"network":{"investors":["투자자 이름/기관 최대 5개"],"advisors_board":["어드바이저/보드 최대 5개"],"cofounders":["공동창업자 이름 최대 5개"]},"one_liner":"N회차 창업자, [강점] / [리스크] 형식의 1문장 요약"}
career_trajectory는 최신→과거 순 정렬. founding_history.previous_ventures가 없으면 빈 배열 [].`;

    const raw = await runWithWebSearch(
      systemPrompt,
      `기업명: ${companyName}\n\n아래 순서로 웹 검색하여 창업자/CEO 정보를 수집하세요:\n1. "${companyName} 창업자 CEO 이름 학력 경력" (또는 영문: "${companyName} founder CEO background education")\n2. "${companyName} founder serial entrepreneur exit history"\n3. "${companyName} 투자자 investor board advisor"\n4. "${companyName} CEO SNS LinkedIn media interview"\n5. Blind 또는 Glassdoor에서 "${companyName}" 직원 평가 검색\n\n수집 후 아래 스키마로 반환:\n${schema}`,
      'claude-sonnet-4-6',
      8,
      6000,
    );
    const result = extractJson<FounderV2>(raw, 'founder_v2');
    console.log(`[claude] founder_v2 OK  ${Date.now() - t0}ms`);
    return result;
  } catch (err) {
    console.error(`[claude] founder_v2 FAIL ${Date.now() - t0}ms`, err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function analyzeCompany(
  companyName: string,
  financialContext?: string,
): Promise<AnalysisData> {
  // Step 1: One web-search pass to gather research context
  const t0 = Date.now();
  const researchText = await gatherResearch(companyName);
  console.log(`[claude] gatherResearch done ${Date.now() - t0}ms`);

  const sharedContext = [
    `기업명: ${companyName}`,
    financialContext ? `\n[공시 데이터 — 재무수치 우선 반영]\n${financialContext}` : null,
    `\n[웹 리서치]\n${researchText}`,
  ].filter(Boolean).join('\n');

  // Step 2: 10 sections in parallel — allSettled so one hang/fail doesn't block others
  const SECTION_TIMEOUT = 30_000;
  const FOUNDER_TIMEOUT = 60_000;
  const t1 = Date.now();
  const results = await Promise.allSettled([
    withTimeout(callSection<SummaryV2>(sharedContext, 'summary_v2'),                 SECTION_TIMEOUT, 'summary_v2'),
    withTimeout(callSection<IndustryHistoryV2>(sharedContext, 'industry_history_v2'), SECTION_TIMEOUT, 'industry_history_v2'),
    withTimeout(callSection<TechEvolutionV2>(sharedContext, 'tech_evolution_v2'),     SECTION_TIMEOUT, 'tech_evolution_v2'),
    withTimeout(callSection<ValueChainV2>(sharedContext, 'value_chain_v2'),           SECTION_TIMEOUT, 'value_chain_v2'),
    withTimeout(callSection<BusinessModelV2>(sharedContext, 'business_model_v2'),     SECTION_TIMEOUT, 'business_model_v2'),
    withTimeout(callSection<CompetitorsV2>(sharedContext, 'competitors_v2'),          SECTION_TIMEOUT, 'competitors_v2'),
    withTimeout(callSection<StrategyV2>(sharedContext, 'strategy_v2'),               SECTION_TIMEOUT, 'strategy_v2'),
    withTimeout(callSection<FinancialsV2>(sharedContext, 'financials_v2'),            SECTION_TIMEOUT, 'financials_v2'),
    withTimeout(callSection<AnalysisSources>(sharedContext, 'sources'),               SECTION_TIMEOUT, 'sources'),
    withTimeout(callFounderSection(companyName),                                      FOUNDER_TIMEOUT, 'founder_v2'),
  ]);
  console.log(`[claude] parallel sections done ${Date.now() - t1}ms`);

  function settled<T>(r: PromiseSettledResult<T | null>, fallback: T): T {
    return r.status === 'fulfilled' && r.value !== null ? r.value : fallback;
  }

  const [r0, r1, r2, r3, r4, r5, r6, r7, r8, r9] = results;
  return {
    summary_v2:          settled(r0, { ...DEFAULT_ANALYSIS_DATA.summary_v2, company: companyName }),
    industry_history_v2: settled(r1, DEFAULT_ANALYSIS_DATA.industry_history_v2),
    tech_evolution_v2:   settled(r2, DEFAULT_ANALYSIS_DATA.tech_evolution_v2),
    value_chain_v2:      settled(r3, DEFAULT_ANALYSIS_DATA.value_chain_v2),
    business_model_v2:   settled(r4, DEFAULT_ANALYSIS_DATA.business_model_v2),
    competitors_v2:      settled(r5, DEFAULT_ANALYSIS_DATA.competitors_v2),
    strategy_v2:         settled(r6, DEFAULT_ANALYSIS_DATA.strategy_v2),
    financials_v2:       settled(r7, DEFAULT_ANALYSIS_DATA.financials_v2),
    sources:             settled(r8, DEFAULT_ANALYSIS_DATA.sources),
    founder_v2:          settled(r9, DEFAULT_ANALYSIS_DATA.founder_v2),
  };
}


export async function selectDailyCompany(): Promise<string> {
  const systemPrompt = `당신은 기업 분석 전문가입니다. 오늘 분석하기에 흥미로운 글로벌 또는 한국 기업 하나를 선정하세요.
최신 뉴스, 트렌드, 업계 이슈를 고려하여 선정하고, 기업명만 응답하세요. 설명 없이 기업명만.`;

  const name = await runWithWebSearch(
    systemPrompt,
    `오늘(${new Date().toISOString().slice(0, 10)}) 분석할 만한 흥미로운 기업을 추천해주세요. 기업명만 답하세요.`,
    'claude-sonnet-4-6',
    6,
  );

  return name.trim().split('\n')[0].trim();
}

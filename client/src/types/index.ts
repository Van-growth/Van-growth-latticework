import type { OrgSizeCode, IndustryCode, JobRoleCode, JobLevelCode, PurposeCode, RegionCode } from '@/lib/i18n/profileLabels';

// ── Legacy types (kept for backward-compat with old analyses) ─────────────────

export interface ValueChainPlayer {
  id: string;
  role: string;
  player_name: string;
  description: string;
}

export interface MoatType {
  name: string;
  strength: '강함' | '보통' | '약함';
  basis: string;
}

export interface MoatAnalysis {
  types: MoatType[];
  sustain_conditions: string;
  collapse_scenarios: string;
}

export interface RiskItem {
  category: string;
  description: string;
}

export interface RiskGroup {
  severity: '높음' | '중간' | '낮음';
  items: RiskItem[];
}

export interface RiskAnalysis {
  business: RiskGroup;
  financial: RiskGroup;
  external: RiskGroup;
}

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
  title?: string;
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

export interface DirectCompetitor {
  name: string;
  country: string;
  market_share: string;
  strengths: string[];
  differentiation: string;
}

export interface IndirectCompetitor {
  name: string;
  type: string;
  description: string;
}

export interface CompetitorsAnalysis {
  direct: DirectCompetitor[];
  indirect: IndirectCompetitor[];
}

export interface CorporateStrategy {
  portfolio_direction: string;
  ma_partnership: string;
  regional_expansion: string;
  notes?: string;
}

export interface BusinessStrategy {
  competitive_advantage: string;
  customer_channel: string;
  product_roadmap: string;
  notes?: string;
}

export interface FinancialStrategy {
  capital_raising: string;
  investment_priority: string;
  dividend_buyback: string;
  profitability_target: string;
  notes?: string;
}

export interface StrategyAnalysis {
  corporate: CorporateStrategy;
  business: BusinessStrategy;
  financial: FinancialStrategy;
}

export interface Metric {
  label: string;
  value: string;
  unit?: string;
}

export interface IncomeStatementRow {
  item: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
  yoy?: string;
}

export interface BalanceSheetRow {
  item: string;
  fy2023?: string;
  fy2024?: string;
  fy2025?: string;
}

export interface CashFlow {
  operating: string;
  investing: string;
  financing: string;
  free_cash_flow: string;
  notes?: string;
}

export interface UnitEconomics {
  gross_margin?: string;
  operating_margin?: string;
  net_margin?: string;
  fcf_margin?: string;
  nrr?: string;
}

export interface StructuredFinancials {
  income_statement: IncomeStatementRow[];
  balance_sheet: BalanceSheetRow[];
  cash_flow: CashFlow;
  unit_economics?: UnitEconomics;
}

// ── V2 types (new structured schema) ─────────────────────────────────────────

export interface SummaryV2 {
  company: string;
  ticker: string | null;
  industry: string;
  hq: string;
  value_chain_position: 'upstream' | 'midstream' | 'downstream';
  // revenue_share(매출 비중 %) 필드는 2026-08-15부로 제거 — financials_v2.revenue_lines
  // (EDGAR R.htm 실측)가 유일한 매출 비중 출처, 여긴 이름+정성적 설명만.
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
    // 2026-08 프롬프트 영어 단일화 이전 캐시는 한국어 값, 이후 신규 분석은 영어 값
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
  sources?: Source[];
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
  key_bullets?: string[];
  sources?: Source[];
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
  key_bullets?: string[];
  sources?: Source[];
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
  pricing_power?: 'high' | 'medium' | 'low';
  bottleneck: boolean;
  buyer?: boolean;
  global_leaders: ValueChainLayerLeader[];
}

export interface ValueChainV2 {
  industry: string;
  layers: ValueChainLayer[];
  value_flow: string[];
  subject_position: string[];
  key_bullets?: string[];
  sources?: Source[];
}

// revenue_share(매출 비중 %) 필드는 2026-08-15부로 제거 — financials_v2.revenue_lines가
// 유일한 매출 비중 출처, 여긴 정성적 설명만.
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
  key_bullets?: string[];
  sources?: Source[];
}

export interface DirectCompetitorV2 {
  name: string;
  country: string;
  market_share: string;
  strengths: string[];
  weaknesses: string[];
  vs_subject: string;
}

export interface CompetitorRevenueRankingRow {
  rank: number;
  name: string;
  ticker: string;
  revenue: number;
  isSubject: boolean;
}

export interface CompetitorRevenueRanking {
  sicCode: string;
  totalCompanies: number;
  top: CompetitorRevenueRankingRow[];
  subjectRank: number | null;
  asOf: string;
  sourceIndex?: number;
}

export interface CompetitorsV2 {
  direct: DirectCompetitorV2[];
  indirect: { name: string; threat: string }[];
  substitutes: { name: string; threat: string }[];
  competitive_position: 'leader' | 'challenger' | 'niche' | 'follower';
  key_bullets?: string[];
  sources?: Source[];
  // EDGAR 기업 전용 — industryBenchmarkService가 순수 계산 후 병합(Claude 미생성)
  revenue_ranking?: CompetitorRevenueRanking | null;
}

export interface CrossIndustryNudgeV1 {
  industry_pain: {
    title: string;
    description: string[];
    financial_impact_question: string;
  };
  // 2026-08-17 신규 — industry_pain과 cross_industry_example을 잇는 연결 인사이트.
  // optional — 이 필드 이전에 생성된 캐시 데이터는 없을 수 있음(sources/key_bullets와 동일 취급).
  connection_insight?: string;
  cross_industry_example: {
    source_industry: string;
    case_name: string;
    solution_description: string;
  };
  key_bullets?: string[];
  sources?: Source[];
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
  key_bullets?: string[];
  sources?: Source[];
}

// fy{year} 컬럼은 회사마다 보유 연도 수·범위가 다르다(신규 상장사는 짧고, 오래된 기업은
// 최대 5개) — 고정된 fy2021~fy2025 리터럴 대신 인덱스 시그니처로 가변 연도를 수용한다.
// 실제 렌더링 시 어느 fy{year} 키가 존재하는지는 getFinancialYearCols()로 조회한다.
export interface FinancialsV2Row {
  item: string;
  yoy?: string;
  [yearKey: string]: string | undefined;
}

export interface FinancialsV2BSRow {
  item: string;
  [yearKey: string]: string | undefined;
}

export interface FinancialsV2 {
  // 은행 재무제표 템플릿(2026-08-20) 적용 여부 — 서버가 isGenuineBankData() 게이트를
  // 통과했을 때만 'bank'로 기록(오분류 방지, 상세는 서버 claude.ts 참고).
  industry_category?: 'bank' | 'general';
  income_statement: FinancialsV2Row[];
  // 회사가 실제 10-K에서 라인 구분해 공시한 매출만(서버가 R.htm에서 직접 파싱, Claude 미생성) —
  // 라인 구분이 없는 회사는 undefined, EDGAR 전용(DART는 스코프 밖). 2026-08-15 신설.
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
  key_bullets?: string[];
  sources?: Source[];
  // EDGAR 기업 전용 — industryBenchmarkService가 순수 계산 후 병합(Claude 미생성)
  industry_benchmark?: IndustryBenchmarkResult | null;
  // EDGAR 기업 전용, SEC 전수 벌크 데이터 기반 — server/src/lib/secIndustryBenchmark.ts가
  // 순수 계산 후 병합(Claude 미생성, interpretation 한 줄만 별도의 작은 Claude 호출)
  sec_benchmark_comparison?: SecBenchmarkComparison | null;
}

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
  maxN?: number;
  items?: SecBenchmarkComparisonItem[];
}

export interface IndustryBenchmarkMetric {
  key: 'equity_ratio' | 'debt_ratio' | 'operating_margin' | 'revenue_growth';
  label: string;
  companyValue: number;
  industryAvg: number;
  sampleSize: number;
  verdict: '우수' | '평이' | '열위';
  sentence: string;
}

export interface IndustryBenchmarkResult {
  sicCode: string;
  sicDescription?: string;
  metrics: IndustryBenchmarkMetric[];
  asOf: string;
  sourceIndex?: number;
}

// ── Founder V2 ────────────────────────────────────────────────────────────────

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
  sources?: Source[];
}

// ── Growth Scenario (몬테카를로, 프리미엄 전용) ─────────────────────────────────

export interface GrowthScenarioV2 {
  // 상장사 자체 시계열(high) 시 존재, 섹터 벤치마크(low) 폴백 시 null
  series: { year: number; revenue: number }[] | null;
  stats: { mean: number; stdDev: number; dataPoints: number } | { mean: number; stdDev: number; sampleSize: number };
  simulation: {
    p10: number[];
    p50: number[];
    p90: number[];
    histogram: number[];
    finalYearDistribution: number[];
  };
  currency: 'KRW' | 'USD';
  source: 'EDGAR' | 'DART' | 'SECTOR_BENCHMARK';
  sectorTag?: string;
  confidenceLevel: 'high' | 'low';
  narrative?: string | null;
}

// ── Common ────────────────────────────────────────────────────────────────────

export interface AnalysisSummary {
  id: string;
  companyName: string;
  summary: string;
  createdAt: string;
  isFavorited: boolean;
}

export interface UserProfile {
  company_name: string | null;
  org_size: OrgSizeCode | null;
  industry: IndustryCode | null;
  job_role: JobRoleCode | null;
  job_level: JobLevelCode | null;
  purpose: PurposeCode[] | null;
  purpose_other: string | null;
  region: RegionCode | null;
  onboarding_completed_at: string | null;
  icp_product: string | null;
  icp_target_industry: string | null;
  icp_target_role: string | null;
  nickname: string | null;
}

export interface CompanyListing {
  source: 'EDGAR' | 'DART';
  identifier: string;
  ticker: string | null;
}

export interface CompanySuggestion {
  name: string;
  listings: CompanyListing[];
  companyId?: string;
}

export interface CompanyResolveResponse {
  companyId: string;
  cached: boolean;
  lastAnalyzedAt: string | null;
  analysisId: string | null;
}

export type DataSource = 'dart' | 'edgar' | 'web_search';

export interface AnalysisDetail {
  id: string;
  companyName: string;
  language?: 'ko' | 'en';
  isFavorited?: boolean;
  // Legacy fields
  summary: string;
  metrics?: Metric[];
  strengths?: string[];
  risks?: string[];
  industry_history: string;
  tech_evolution: string;
  value_chain_overview: string;
  business_model: string;
  moat_analysis: MoatAnalysis | null;
  risk_analysis: RiskAnalysis | null;
  competitors: CompetitorsAnalysis | null;
  strategy: StrategyAnalysis | null;
  financials: string;
  financials_structured?: StructuredFinancials;
  // V2 fields
  summary_v2?: SummaryV2;
  industry_history_v2?: IndustryHistoryV2;
  tech_evolution_v2?: TechEvolutionV2;
  value_chain_v2?: ValueChainV2;
  business_model_v2?: BusinessModelV2;
  competitors_v2?: CompetitorsV2;
  cross_industry_nudge_v1?: CrossIndustryNudgeV1;
  strategy_v2?: StrategyV2;
  financials_v2?: FinancialsV2;
  founder_v2?: FounderV2;
  growth_scenario_v2?: GrowthScenarioV2 | null;
  // Meta
  sources: AnalysisSources;
  dataSource?: DataSource;
  // 분석 요청 시 입력받은 목적(2026-08-16, 온보딩 저장값 아님) — 서버 buildDonePayload()/
  // GET /api/analyses/:id 양쪽에서 채워짐. purpose_category가 없던 과거 분석은 둘 다 null.
  purposeCategory?: string | null;
  purposeDetail?: string | null;
  // 2026-08-17 사전 확인 다이얼로그에서 정리된 목적(표시 전용) — 있으면 웹/PDF 표시에서
  // purposeDetail 대신 이걸 우선 사용. 이 필드 이전에 생성된 분석은 null(원문 폴백).
  purposeDetailFormatted?: string | null;
  createdAt: string;
  cached?: boolean;
  is_shared?: boolean;
  share_token?: string | null;
  valuechainPlayers: ValueChainPlayer[];
}

export interface AnalyzeResponse extends AnalysisDetail {
  analysisId: string;
}

// 관리자 유저 대시보드(2026-08-22) — GET /api/admin/users, GET /api/admin/users/stats
// 응답 shape. 이 앱의 다른 도메인 타입과 달리 리포트 콘텐츠가 아니라 운영 도구 전용이라
// 언어 필드가 없다(대시보드 자체가 한국어 고정).
export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  lastAnalysisAt: string | null;
  companyName: string | null;
  orgSize: string | null;
  industry: string | null;
  jobRole: string | null;
  jobLevel: string | null;
  region: string | null;
  purpose: string[];
  purposeOther: string | null;
  isPremium: boolean;
  allowPrivateSearch: boolean;
  analysisCount: number;
}

export interface AdminUserStatsTrendPoint {
  bucket: string;
  count: number;
}

export interface AdminUserStats {
  total: number;
  premiumCount: number;
  freeCount: number;
  privateSearchCount: number;
  newThisMonth: number;
  zeroAnalysisCount: number;
  zeroAnalysisRate: number;
  purposeCounts: Record<string, number>;
  trend: AdminUserStatsTrendPoint[];
  period: 'week' | 'month' | 'quarter' | 'half' | 'year';
}

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

export interface Source {
  url: string;
  title: string;
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
  products: { name: string; revenue_share: number }[];
  key_metrics: { label: string; value: string; trend: 'up' | 'down' | 'flat' }[];
  top_customers: string[];
  key_markets: { country: string; revenue_share: number }[];
  one_line: string;
  bull_case: string;
  bear_case: string;
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
}

// ── Common ────────────────────────────────────────────────────────────────────

export interface LinkedInDraft {
  id: string;
  draft_number: number;
  content: string;
}

export interface AnalysisSummary {
  id: string;
  companyName: string;
  summary: string;
  createdAt: string;
}

export type DataSource = 'dart' | 'edgar' | 'web_search';

export interface AnalysisDetail {
  id: string;
  companyName: string;
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
  strategy_v2?: StrategyV2;
  financials_v2?: FinancialsV2;
  // Meta
  sources: AnalysisSources;
  dataSource?: DataSource;
  createdAt: string;
  is_shared?: boolean;
  share_token?: string | null;
  valuechainPlayers: ValueChainPlayer[];
  linkedinDrafts: LinkedInDraft[];
}

export interface AnalyzeResponse extends AnalysisDetail {
  analysisId: string;
}

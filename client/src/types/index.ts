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

export interface StructuredFinancials {
  income_statement: IncomeStatementRow[];
  balance_sheet: BalanceSheetRow[];
  cash_flow: CashFlow;
}

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
  sources: AnalysisSources;
  dataSource?: DataSource;
  createdAt: string;
  valuechainPlayers: ValueChainPlayer[];
  linkedinDrafts: LinkedInDraft[];
}

export interface AnalyzeResponse extends AnalysisDetail {
  analysisId: string;
  value_chain_players: Omit<ValueChainPlayer, 'id'>[];
  linkedinDrafts: LinkedInDraft[];
}

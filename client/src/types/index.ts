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
  financials?: Source[];
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

export interface AnalysisDetail {
  id: string;
  companyName: string;
  summary: string;
  industry_history: string;
  tech_evolution: string;
  value_chain_overview: string;
  business_model: string;
  moat_analysis: MoatAnalysis | null;
  risk_analysis: RiskAnalysis | null;
  financials: string;
  sources: AnalysisSources;
  createdAt: string;
  valuechainPlayers: ValueChainPlayer[];
  linkedinDrafts: LinkedInDraft[];
}

export interface AnalyzeResponse extends AnalysisDetail {
  analysisId: string;
  value_chain_players: Omit<ValueChainPlayer, 'id'>[];
  linkedinDrafts: LinkedInDraft[];
}

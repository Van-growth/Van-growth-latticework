export interface ValueChainPlayer {
  id: string;
  role: string;
  player_name: string;
  description: string;
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
  financials: string;
  createdAt: string;
  valuechainPlayers: ValueChainPlayer[];
  linkedinDrafts: LinkedInDraft[];
}

export interface AnalyzeResponse extends AnalysisDetail {
  analysisId: string;
  value_chain_players: Omit<ValueChainPlayer, 'id'>[];
  linkedinDrafts: LinkedInDraft[];
}

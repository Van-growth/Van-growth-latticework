-- 전 테이블 RLS 활성화, 정책 0개 (anon/authenticated 완전 차단).
-- 전제조건: server/src/lib/supabase.ts가 SUPABASE_SERVICE_ROLE_KEY로 전환 완료
-- (service_role은 RLS를 무조건 우회하므로 백엔드 기능에는 영향 없음).
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cik_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corp_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financials_v2_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linkedin_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_chain_players ENABLE ROW LEVEL SECURITY;

'use client';

import { useState, useEffect, useRef, useMemo, FormEvent, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, Link, X, RefreshCw, Target } from 'lucide-react';
import AnalysisCard from './AnalysisCard';
import LoginPromptModal from './LoginPromptModal';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';
import { AnalysisDetail, AnalyzeResponse, CompanySuggestion, CompanyListing, CompanyResolveResponse } from '@/types';
import { getClientId } from '@/lib/clientId';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { trackEvent } from '@/lib/analytics';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

// 로그인 유도 모달에서 "구글로 계속하기"를 누른 시점에 선택했던 회사를 저장 —
// signInWithGoogle()이 전체 페이지가 새로고침되는 OAuth 리다이렉트라 React state로는
// 못 살리므로, 로그인 후 마운트 시 이 키를 읽어 자동으로 resolve를 이어간다.
const PENDING_SELECTION_KEY = 'pending_company_selection';

// /industries 페이지에서 회사를 클릭하면 이 키에 선택값을 저장하고 "/"로 이동한다 —
// 페이지 이동으로 React state가 끊기므로 sessionStorage로 넘긴다(위 PENDING_SELECTION_KEY와
// 동일한 브릿지 패턴, client/src/app/industries/page.tsx 참고).
const PENDING_INDUSTRY_SELECTION_KEY = 'pending_industry_company_selection';

// 최상위 내비게이션이 1단 구조(기업분석/산업별 보기/히스토리/설정/로그아웃, 2026-08-17)로
// 재편되며 "기업분석" 탭 개념 자체가 사라졌다 — 이 컴포넌트는 이제 그 자체가 기업분석
// 홈(검색+목적입력+리포트 플로우)이다. 산업별 보기는 /industries 라우트로, 최근 조회/
// 즐겨찾기는 /history 라우트로 각각 독립.
const PURPOSE_CATEGORIES = ['ma', 'investment', 'partnership', 'customer', 'other'] as const;
type PurposeCategory = (typeof PURPOSE_CATEGORIES)[number];

function daysAgo(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function normalizeResponse(data: AnalyzeResponse): AnalysisDetail {
  return {
    ...data,
    id: data.analysisId ?? data.id,
    valuechainPlayers: data.valuechainPlayers ?? [],
  };
}

function emptyBase(name: string): AnalysisDetail {
  return {
    id: '',
    companyName: name,
    summary: '',
    industry_history: '',
    tech_evolution: '',
    value_chain_overview: '',
    business_model: '',
    financials: '',
    metrics: [],
    strengths: [],
    risks: [],
    moat_analysis: null,
    risk_analysis: null,
    competitors: null,
    strategy: null,
    sources: {},
    valuechainPlayers: [],
    createdAt: new Date().toISOString(),
  };
}

function AnalysisLoadingScreen({ companyName, isFirstLookup }: { companyName: string; isFirstLookup: boolean }) {
  const { language } = useLanguage();
  const t = getUiStrings(language).home;
  const messages = useMemo(() => [
    ...t.scanMessages,
    t.finishingUp(companyName),
  ], [t, companyName]);

  const [idx, setIdx]   = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    let tidout: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setShow(false);
      tidout = setTimeout(() => { setIdx(i => (i + 1) % messages.length); setShow(true); }, 400);
    }, 3000);
    return () => { clearInterval(id); clearTimeout(tidout); };
  }, [messages.length]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-28 px-8 min-h-[420px]">
      {/* Scanning magnifier — 64px icon on a track */}
      <div className="relative mb-14" style={{ width: 212, height: 64, overflow: 'hidden' }}>
        {/* track line */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-navy-100 rounded-full" />
        {/* moving magnifier */}
        <div className="anim-scan-lr absolute top-0 left-0">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="26" cy="26" r="17" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" />
            <line x1="39" y1="39" x2="55" y2="55" stroke="#3B82F6" strokeWidth="4.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Rotating message */}
      <p
        className="text-sm font-medium text-gray-500 text-center min-h-[20px] transition-opacity duration-400"
        style={{ opacity: show ? 1 : 0 }}
      >
        {messages[idx]}
      </p>

      {isFirstLookup && (
        <p className="text-xs text-navy-600 bg-navy-50 border border-navy-100 rounded-full px-3 py-1 mt-3">
          {t.firstLookupHint}
        </p>
      )}

      {/* Bouncing dots — CSS class 기반 (inline animation 미작동 방지) */}
      <div className="flex gap-2.5 mt-8 items-end h-6">
        <span className="w-2.5 h-2.5 rounded-full bg-navy-400 dot-b1 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-navy-500 dot-b2 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-navy-400 dot-b3 inline-block" />
      </div>
    </div>
  );
}

export default function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const { setAnalysisData, setCompletedBatches, completedBatches } = useAnalysis();
  const { session, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const t = getUiStrings(language).home;

  const [companyName, setCompanyName] = useState('');
  // 분석 요청마다 매번 입력받는 목적 — 온보딩 저장값 아님, 요청 시점 body에만 실린다.
  const [purposeCategory, setPurposeCategory] = useState<PurposeCategory | null>(null);
  const [purposeDetail, setPurposeDetail] = useState('');
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  // 2글자 이상 입력 후 typeahead가 0건으로 실제 응답한 상태 — 관리자 전용 "직접 입력"
  // 폴백 노출 조건(타이핑 중 깜빡임 방지용, showDropdown/suggestions.length만으로는
  // 디바운스 응답 전 프레임과 구분이 안 됨)
  const [searchedEmpty, setSearchedEmpty] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const suppressAutocompleteRef = useRef(false);
  // typeahead에서 클릭 → /api/companies/resolve로 확정된 엔티티. 자유 텍스트 제출은
  // 이게 없으면 막힌다 — disambiguation은 반드시 드롭다운 클릭으로만 완료됨.
  const [selectedCompany, setSelectedCompany] = useState<{ name: string; companyId: string; listings: CompanyListing[] } | null>(null);
  const [resolveResult, setResolveResult] = useState<CompanyResolveResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  // 비로그인 상태에서 드롭다운을 클릭한 경우 — resolve를 바로 부르는 대신 이 값을
  // 채워서 LoginPromptModal을 띄운다. 로그인은 페이지 전체가 리로드되는 OAuth
  // 리다이렉트라 이 React state 자체는 로그인 후 못 살림 — "구글로 계속하기" 클릭
  // 시점에 sessionStorage(PENDING_SELECTION_KEY)에 저장해두고, 로그인 후 마운트되는
  // effect에서 다시 읽어와 자동으로 resolve를 이어간다.
  const [pendingSuggestion, setPendingSuggestion] = useState<CompanySuggestion | null>(null);
  const [result, setResult] = useState<AnalysisDetail | null>(null);
  const [displayData, setDisplayData] = useState<AnalysisDetail | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingId, setFetchingId] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isShared, setIsShared] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [toast, setToast] = useState('');
  const [reanalyzingTabs, setReanalyzingTabs] = useState<Set<string>>(new Set());
  const [isFirstLookup, setIsFirstLookup] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ message: string; nextAvailableAt: string | null; usedCount: number } | null>(null);
  const [usage, setUsage] = useState<{ isPremium: boolean; isAdmin: boolean; usedCount: number; limit: number | null } | null>(null);

  const loadedIdRef = useRef<string | null>(null);
  const streamingRef = useRef<AnalysisDetail | null>(null);
  // 배치1 완료 시점에 SSE로 받는 analysisId — 스트림 연결이 끊겨도 이 값만 있으면
  // GET /api/analyses/:id 폴링으로 진행 상황을 이어볼 수 있다(배치별 즉시 DB 저장 재사용).
  const analysisIdRef = useRef<string | null>(null);
  // 'done' 처리(정상 스트림 또는 폴링/포그라운드 복귀 캐치업 중 어느 경로로든)가
  // 한 번 끝났음을 표시 — 중복 완료 처리 및 이미 끝난 뒤의 불필요한 폴링을 막는다.
  const analysisDoneRef = useRef(false);

  async function refreshUsage() {
    // 무료 분석 카운트는 로그인 유저 기준으로만 동작 — 비로그인 상태면 조회 자체를 스킵.
    if (!session) { setUsage(null); return; }
    try {
      const res = await fetch(`${API_URL}/api/analyze/usage`, {
        headers: buildAuthHeaders(null, session.access_token),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsage({ isPremium: data.isPremium, isAdmin: !!data.isAdmin, usedCount: data.usedCount, limit: data.limit });
    } catch {
      // 카운터 조회 실패는 조용히 무시 — 분석 자체를 막지 않음
    }
  }

  // 로그인/로그아웃으로 premium 판정이 바뀌면 카운터도 다시 조회
  useEffect(() => { refreshUsage(); }, [session]);

  // 로그인 유도 모달에서 로그인하고 돌아온 경우 — sessionStorage에 저장해둔 선택을
  // 자동으로 이어서 resolve(처음부터 다시 검색 안 해도 되게). session이 아직 없으면
  // (로그아웃 상태로 마운트) 그냥 둔다 — 다음에 실제로 로그인했을 때 이 effect가
  // 다시 돌면서 처리된다.
  useEffect(() => {
    if (!session) return;
    const raw = sessionStorage.getItem(PENDING_SELECTION_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_SELECTION_KEY);
    try {
      const s = JSON.parse(raw) as CompanySuggestion;
      if (s?.name) handleSelectSuggestion(s);
    } catch {
      // 저장된 값이 깨졌으면 조용히 무시 — 유저가 다시 검색하면 그만
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // /industries에서 회사를 클릭하고 "/"로 돌아온 경우 — sessionStorage에 저장해둔
  // 선택을 자동으로 이어서 resolve. 로그인 여부와 무관하게 마운트 시 1회만 확인.
  useEffect(() => {
    const raw = sessionStorage.getItem(PENDING_INDUSTRY_SELECTION_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_INDUSTRY_SELECTION_KEY);
    try {
      const s = JSON.parse(raw) as CompanySuggestion;
      if (s?.name) handleSelectSuggestion(s);
    } catch {
      // 저장된 값이 깨졌으면 조용히 무시 — 유저가 다시 검색하면 그만
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (result) {
      setIsShared(result.is_shared ?? false);
      setShareToken(result.share_token ?? null);
    }
  }, [result]);

  // 모바일 백그라운드 복귀 시 진행 중인 분석 상태를 즉시 재조회 — iOS Safari 등 모바일
  // 브라우저는 백그라운드 전환 시 fetch 스트림을 명시적 에러 없이 그냥 멈춰버리는 경우가
  // 있어(연결이 끊겼다는 신호 자체가 안 옴), 에러/타임아웃을 기다리는 대신 포그라운드
  // 복귀 이벤트를 감지해 능동적으로 한 번 캐치업한다.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!loading || analysisDoneRef.current) return;
      const id = analysisIdRef.current;
      if (!id) return;
      fetchAndMergeStatus(id, companyName.trim()).catch(() => {
        // 캐치업 실패는 조용히 무시 — 원래 스트림이나 이후 폴링이 계속 시도한다
      });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleShare() {
    if (!result?.id || sharing) return;
    if (!session) { signInWithGoogle(); return; }
    setSharing(true);
    try {
      const res = await fetch(`${API_URL}/api/analyses/${result.id}/share`, {
        method: 'POST',
        headers: buildAuthHeaders(null, session.access_token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShareToken(data.share_token);
      setIsShared(true);
      const url = `${window.location.origin}/share/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      showToast(t.linkCopied);
    } catch {
      showToast(t.shareCreateFailed);
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    showToast(t.linkCopied);
  }

  async function handleRevoke() {
    if (!result?.id) return;
    if (!session) { signInWithGoogle(); return; }
    try {
      await fetch(`${API_URL}/api/analyses/${result.id}/share`, {
        method: 'DELETE',
        headers: buildAuthHeaders(null, session.access_token),
      });
      setIsShared(false);
      setShareToken(null);
      showToast(t.shareRevoked);
    } catch {
      showToast(t.shareRevokeFailed);
    }
  }

  useEffect(() => {
    if (!urlId) return;
    if (loadedIdRef.current === urlId) return;

    setFetchingId(true);
    setError(null);
    const clientId = getClientId();
    fetch(`${API_URL}/api/analyses/${urlId}`, {
      headers: buildAuthHeaders(clientId, session?.access_token),
    })
      .then(r => r.json())
      .then((data: AnalysisDetail) => {
        setResult(data);
        setAnalysisData(data);
        setCompletedBatches(new Set([1, 2, 3, 4, 5, 6, 40]));
        loadedIdRef.current = urlId;
      })
      .catch(() => setError(t.loadResultFailed))
      .finally(() => setFetchingId(false));
  }, [urlId, setAnalysisData, session]);

  const REANALYZE_FIELD: Record<string, keyof AnalysisDetail> = {
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

  async function handleReanalyzeTab(tab: string) {
    // result(전체 스트림의 최종 'done' 이벤트에서만 채워짐) 대신 analysisIdRef를 우선 사용 —
    // 배치1 완료 시점부터 이미 채워져 있어, 스트리밍 도중(아직 result가 null인 상태)에
    // 산업역사/기술변화 탭을 열어 온디맨드 생성이 트리거돼도 여기서 조용히 no-op되지 않는다.
    // 예전엔 result?.id로만 체크해서, 스트리밍 중 자동생성이 씹히면 AnalysisCard의
    // autoGenTriggered ref가 이미 "시도함"으로 기록돼버려 새로고침 전까진 영구히 재시도가
    // 안 됐다(체크마크가 잘못된 배치 번호로 일찍 ✓ 떠서 유저가 스트리밍 중에 클릭하기 쉬웠던
    // 것과 맞물린 버그 — AnalysisCard.tsx hasTabData 수정과 짝을 이루는 수정).
    const targetId = analysisIdRef.current ?? result?.id;
    const targetName = result?.companyName || companyName.trim();
    if (!targetId || !targetName) return;
    if (!session) { signInWithGoogle(); return; }
    setReanalyzingTabs(prev => new Set([...prev, tab]));
    try {
      // 생성 실패(웹서치 일시 오류 등) 시 한 번만 재시도 — 그래도 실패하면 기존 수동
      // "↻ 다시 분석" 버튼으로 유저가 다시 시도할 수 있다(이 함수를 그대로 재호출하는 별도 경로).
      let data: unknown = null;
      for (let attempt = 0; attempt < 2 && !data; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 2000));
        const resp = await fetch(`${API_URL}/api/analyze/reanalyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
          body: JSON.stringify({ analysisId: targetId, companyName: targetName, section: tab }),
        });
        if (resp.ok) {
          ({ data } = await resp.json());
        }
      }
      const field = REANALYZE_FIELD[tab];
      if (field && data) {
        // 스트리밍 도중이면 result가 아직 null일 수 있음 — streamingRef/displayData에 먼저
        // 반영해 즉시 화면에 뜨게 하고, result가 이미 있으면(스트리밍 종료 후) 그것도 갱신.
        streamingRef.current = { ...(streamingRef.current ?? emptyBase(targetName)), [field]: data };
        setDisplayData({ ...streamingRef.current });
        if (result) {
          const updated = { ...result, [field]: data };
          setResult(updated);
          setAnalysisData(updated);
        }
      }
    } catch (err) {
      console.error('[reanalyze]', tab, err);
    } finally {
      setReanalyzingTabs(prev => { const s = new Set(prev); s.delete(tab); return s; });
    }
  }

  // 배치별로 즉시 DB 저장되는 기존 구조를 그대로 활용 — 이미 있는 GET /api/analyses/:id로
  // 현재까지 완료된 배치를 가져와 화면 상태에 병합한다. 완료 여부(b1~b5 모두 참)를 반환.
  async function fetchAndMergeStatus(analysisId: string, name: string): Promise<boolean> {
    const clientId = getClientId();
    const res = await fetch(`${API_URL}/api/analyses/${analysisId}`, {
      headers: buildAuthHeaders(clientId, session?.access_token),
    });
    if (!res.ok) return false;
    const data = await res.json() as AnalysisDetail;

    streamingRef.current = { ...(streamingRef.current ?? emptyBase(name)), ...data };
    setDisplayData({ ...streamingRef.current });

    const b1 = !!data.summary_v2;
    const b2 = !!(data.business_model_v2 && data.competitors_v2 && data.cross_industry_nudge_v1);
    const b3 = !!(data.value_chain_v2 && data.strategy_v2 && data.financials_v2);
    const b4 = !!data.founder_v2;
    const b5 = !!(data.industry_history_v2 && data.tech_evolution_v2);
    const allDone = b1 && b2 && b3 && b4 && b5;

    const next = new Set<number>([-1]);
    if (b1) next.add(1);
    if (b2) next.add(2);
    if (b3) { next.add(3); next.add(40); }
    if (b4) next.add(4);
    if (b5) next.add(5);
    if (data.growth_scenario_v2) next.add(6);
    setCompletedBatches(prev => new Set([...prev, ...next]));
    setProgress({ completed: [b1, b2, b3, b4, b5].filter(Boolean).length, total: 5 });

    if (allDone && !analysisDoneRef.current) {
      analysisDoneRef.current = true;
      setIsCached(false);
      loadedIdRef.current = data.id;
      setResult(data);
      setAnalysisData(data);
      setCompletedBatches(new Set([-1, 1, 2, 3, 4, 5, 6, 40]));
      if (data.id) router.replace(`/?id=${data.id}`);
      refreshUsage();
    }
    return allDone;
  }

  // SSE 연결이 끊긴 뒤(모바일 백그라운드 전환/네트워크 전환 등) 서버는 배치 처리를 계속
  // 진행하므로, 에러로 끝내는 대신 3~5초 간격으로 상태를 다시 조회해 이어본다.
  // 최대 5분까지만 재시도 — 그래도 안 끝나면 그때는 실제 에러로 표시.
  async function pollUntilDone(analysisId: string, name: string) {
    const deadline = Date.now() + 5 * 60 * 1000;
    while (!analysisDoneRef.current && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000));
      try {
        const done = await fetchAndMergeStatus(analysisId, name);
        if (done) return;
      } catch {
        // 아직 네트워크가 불안정 — 다음 라운드에서 재시도
      }
    }
    if (!analysisDoneRef.current) {
      setError(t.connectionUnstable);
    }
  }

  async function startAnalysis(name: string, forceRefresh: boolean, companyId?: string) {
    trackEvent('search_executed', { companyName: name, forceRefresh });
    setLoading(true);
    setError(null);
    setResult(null);
    setDisplayData(null);
    setProgress(null);
    setIsCached(false);
    setIsFirstLookup(false);
    setRateLimitInfo(null);
    setSelectedCompany(null);
    setResolveResult(null);
    setCompletedBatches(new Set([-1])); // sentinel: streaming started, no batch done yet → all tabs show SectionGenerating
    streamingRef.current = null;
    analysisIdRef.current = null;
    analysisDoneRef.current = false;

    try {
      const clientId = getClientId();
      const res = await fetch(`${API_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(clientId, session?.access_token),
        },
        body: JSON.stringify({
          companyName: name, forceRefresh, companyId, language,
          purposeCategory: purposeCategory ?? undefined,
          purposeDetail: purposeDetail.trim() || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as { error?: string }).error || t.analysisError);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: '))  dataStr  = line.slice(6);
          }
          if (!dataStr) continue;

          try {
            const payload = JSON.parse(dataStr);

            if (eventType === 'meta') {
              setIsFirstLookup(!!payload.isFirstLookup);

            } else if (eventType === 'rate_limited') {
              setRateLimitInfo({ message: payload.message, nextAvailableAt: payload.nextAvailableAt ?? null, usedCount: payload.usedCount ?? 2 });
              refreshUsage();

            } else if (eventType === 'fin_preview') {
              const previewData = payload as Partial<AnalysisDetail>;
              if (!streamingRef.current) {
                streamingRef.current = Object.assign(emptyBase(name), previewData);
              } else {
                streamingRef.current = { ...streamingRef.current, ...previewData } as AnalysisDetail;
              }
              setDisplayData({ ...streamingRef.current });
              setCompletedBatches(prev => new Set([...prev, 40]));

            } else if (eventType === 'batch') {
              const batchNum = payload.batch as number;
              const batchData = payload.data as Partial<AnalysisDetail>;
              if (payload.analysisId) analysisIdRef.current = payload.analysisId as string;
              if (!streamingRef.current) {
                streamingRef.current = Object.assign(emptyBase(name), batchData);
              } else {
                streamingRef.current = { ...streamingRef.current, ...batchData } as AnalysisDetail;
              }
              setDisplayData({ ...streamingRef.current });
              // batch 3 also unlocks financials tab (batch 40) in case fin_preview wasn't sent
              const extra = batchNum === 3 ? [40] : [];
              setCompletedBatches(prev => new Set([...prev, batchNum, ...extra]));

              setProgress({ completed: payload.completed, total: payload.total });

            } else if (eventType === 'done') {
              // industry_history_v2/tech_evolution_v2(Pain Diagnosis)는 2026-08-16부터
              // 배치5로 서버 analyzeCompany()가 직접 채우므로, 다른 섹션과 동일하게
              // normalized 값을 그대로 신뢰한다(구 온디맨드 시절의 streamingRef 폴백 병합
              // 특례는 더 이상 필요 없음).
              const merged: AnalysisDetail = normalizeResponse(payload as AnalyzeResponse);
              analysisDoneRef.current = true;
              setIsCached(payload.cached === true);
              loadedIdRef.current = merged.id;
              setResult(merged);
              setAnalysisData(merged);
              streamingRef.current = merged;
              setCompletedBatches(new Set([-1, 1, 2, 3, 4, 5, 6, 40])); // keep -1 so isStreaming stays true → tab ✓ icons persist
              if (merged.id) router.replace(`/?id=${merged.id}`);
              refreshUsage();
              trackEvent('report_generated', { companyName: merged.companyName, cached: payload.cached === true });

            } else if (eventType === 'error') {
              setError(payload.message || t.analysisError);
            }
          } catch {
            // malformed SSE line, skip
          }
        }
      }
    } catch (err) {
      // 모바일 백그라운드 전환/네트워크 전환 등으로 연결이 끊긴 경우 — 서버는 배치별로
      // 이미 DB에 저장하며 계속 진행 중이므로, analysisId를 안다면(배치1 이상 완료됨)
      // 즉시 에러 대신 상태 폴링으로 이어본다. analysisId를 아예 모르면(배치1 이전에
      // 끊김) 이어볼 방법이 없어 기존처럼 에러 처리.
      console.error('[analyze/stream] connection lost', err);
      if (!analysisDoneRef.current && analysisIdRef.current) {
        await pollUntilDone(analysisIdRef.current, name);
      } else if (!analysisDoneRef.current) {
        setError(t.serverUnreachable);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  // 자유 텍스트 그대로 제출 차단 — 드롭다운에서 클릭해 resolve까지 끝난 선택
  // (selectedCompany)이 없거나, 이미 캐시가 있는 회사(그땐 바로보기/재분석하기
  // 버튼으로만 진행)면 제출을 막는다.
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading || resolving) return;
    if (!session) { signInWithGoogle(); return; }
    if (!selectedCompany || selectedCompany.name !== companyName.trim() || resolveResult?.cached) return;
    await startAnalysis(selectedCompany.name, false, selectedCompany.companyId);
  }

  async function handleForceRefresh(companyId?: string, name?: string) {
    const targetName = name ?? companyName.trim();
    if (!targetName || loading) return;
    if (!session) { signInWithGoogle(); return; }
    await startAnalysis(targetName, true, companyId);
  }

  function handleRequestFreeTrial() {
    const userEmail = session?.user?.email ?? t.emailUnavailable;
    const requestedAt = new Date().toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
    const limit = usage?.limit ?? 2;
    const usedCount = rateLimitInfo?.usedCount ?? limit;
    const lastCompany = companyName.trim();

    const subject = t.freeTrialSubject(userEmail);
    const body = [
      t.freeTrialUserLine(userEmail),
      t.freeTrialRequestedAtLine(requestedAt),
      t.freeTrialUsageLine(usedCount, limit),
      ...(lastCompany ? [t.freeTrialLastCompanyLine(lastCompany)] : []),
    ].join('\n');

    window.location.href = `mailto:sg.van.p@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  // corp_master(DART)+cik_master(EDGAR) 전체 기반 typeahead — 300ms 디바운스,
  // 2글자 미만은 요청 자체를 안 보냄. 이미 분석한 기업뿐 아니라 전체 상장/등록
  // 기업 유니버스에서 검색된다(다중상장 회사는 배지 2개로 병합돼서 옴).
  useEffect(() => {
    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      return;
    }
    const q = companyName.trim();
    setSearchedEmpty(false);
    if (q.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/companies/typeahead?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const { results } = await res.json() as { results: CompanySuggestion[] };
        setSuggestions(results);
        setShowDropdown(results.length > 0);
        setActiveSuggestion(-1);
        setSearchedEmpty(results.length === 0);
      } catch {
        // 자동완성은 best-effort — 실패해도 목록에서 다시 검색해 선택하면 됨
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [companyName]);

  // 드롭다운 클릭 = disambiguation 완료. 서버에 resolve 요청해서 companies/
  // company_listings에 lazy upsert하고, 이 회사의 기존 분석 캐시 유무를 받아온다 —
  // 그 결과(cached true/false) 하나로만 아래 렌더링이 분기된다(유저가 고르는 토글 아님).
  async function handleSelectSuggestion(s: CompanySuggestion) {
    // /api/companies/resolve는 /api/analyze/stream과 동일하게 로그인이 필요함 —
    // 비로그인 상태면 resolve 호출 자체를 하지 않고 앱 내 로그인 유도 모달만 띄운다
    // (2026-07-16, 로그인 없이 캐시된 분석 전체를 열람할 수 있던 문제 수정 +
    // 맥락 없이 바로 구글 로그인 페이지로 리다이렉트하던 UX 개선).
    if (!session) {
      setShowDropdown(false);
      setPendingSuggestion(s);
      return;
    }

    suppressAutocompleteRef.current = true;
    setCompanyName(s.name);
    setShowDropdown(false);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSelectedCompany(null);
    setResolveResult(null);
    setResolving(true);
    try {
      const res = await fetch(`${API_URL}/api/companies/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(null, session.access_token),
        },
        body: JSON.stringify({ name: s.name, listings: s.listings, language }),
      });
      if (res.status === 401) { setPendingSuggestion(s); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as CompanyResolveResponse;
      setSelectedCompany({ name: s.name, companyId: data.companyId, listings: s.listings });
      setResolveResult(data);
    } catch {
      showToast(t.companyInfoCheckFailed);
    } finally {
      setResolving(false);
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveSuggestion(-1);
    }
  }

  // Phase 1: batch 1 (summary) not yet done → show loading screen
  // Phase 2: batch 1 done → show card (summary real, others show SectionGenerating)
  const phase1 = loading && completedBatches.has(-1) && !completedBatches.has(1);
  const showCard = result ?? (loading && completedBatches.has(1) ? (displayData ?? emptyBase(companyName.trim())) : null);


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">{t.heroTitle}</h1>
        <p className="text-gray-500">{t.heroSubtitle}</p>
      </div>

      {/* 검색창 + 목적 입력을 하나의 응집된 카드로 묶음(2026-08-17 UX 피드백) —
          검색-목적-상세가 시각적으로 한 블록임을 보여준다. */}
      <div className="max-w-2xl mx-auto mb-8 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setSelectedCompany(null); setResolveResult(null); }}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => setShowDropdown(false)}
              placeholder={t.searchPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-navy-400 text-gray-900 placeholder-gray-400"
              disabled={loading}
              autoComplete="off"
              role="combobox"
              aria-expanded={showDropdown}
              aria-autocomplete="list"
              aria-controls="company-suggestions"
            />
            {showDropdown && suggestions.length > 0 && !loading && (
              <ul id="company-suggestions" role="listbox" className="absolute left-0 right-0 z-20 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden py-1">
                {suggestions.map((s, i) => (
                  <li key={s.name}>
                    <button
                      type="button"
                      onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(s); }}
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${i === activeSuggestion ? 'bg-navy-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className="text-sm text-gray-900 truncate">{s.name}</span>
                      <span className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                        {s.listings.map(l => (
                          <span key={l.source}>{l.source === 'EDGAR' ? '🇺🇸' : '🇰🇷'} {l.ticker ?? '—'}</span>
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchedEmpty && !selectedCompany && usage?.isAdmin && !loading && (
              <div className="absolute left-0 right-0 z-20 mt-1.5 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden py-1">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelectSuggestion({ name: companyName.trim(), listings: [] }); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-navy-700 hover:bg-navy-50 transition-colors"
                >
                  {t.adminFreeTextOption(companyName.trim())}
                </button>
              </div>
            )}
          </div>
          {selectedCompany && resolveResult && !resolveResult.cached ? (
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-navy-600 text-white font-medium shadow-sm hover:bg-navy-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? t.analyzing : t.startNew}
            </button>
          ) : (
            <button
              type="submit"
              disabled
              title={t.selectFromListTitle}
              className="px-6 py-3 rounded-xl bg-gray-200 text-gray-400 font-medium shadow-sm cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {resolving ? t.checking : t.analyze}
            </button>
          )}
        </div>
      </form>

      {/* 목적 입력 — 분석 요청마다 매번 입력받는다(온보딩 저장값 아님). 각 섹션 프롬프트
          컨텍스트에 해석 레이어로만 주입(주입 배관만, 톤 분기 로직은 다음 단계). 검색창과
          같은 카드 안에 두고 구분선만으로 나눔(2026-08-17 UX 피드백 — 시각적 강조 강화). */}
      <div className="mt-5 pt-5 border-t border-gray-100">
        <div className="flex items-center gap-1.5 mb-3">
          <Target size={16} className="text-navy-600" />
          <p className="text-sm font-semibold text-gray-900">{t.purposeSectionTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label={t.purposeSectionTitle}>
          {PURPOSE_CATEGORIES.map(cat => {
            const label = { ma: t.purposeMa, investment: t.purposeInvestment, partnership: t.purposePartnership, customer: t.purposeCustomer, other: t.purposeOther }[cat];
            const active = purposeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={loading}
                onClick={() => setPurposeCategory(prev => prev === cat ? null : cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border-2 transition-colors disabled:opacity-50 ${
                  active
                    ? 'bg-navy-600 border-navy-600 text-white shadow-sm'
                    : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-navy-300 hover:bg-navy-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <textarea
          value={purposeDetail}
          onChange={e => setPurposeDetail(e.target.value)}
          disabled={loading}
          placeholder={t.purposeDetailPlaceholder}
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:bg-white text-sm text-gray-900 placeholder-gray-400 resize-none disabled:opacity-50"
        />
      </div>
      </div>

      {/* 캐시 있음 — 서버 응답(resolveResult.cached)에 따라서만 보여짐, 유저가 고르는 토글 아님 */}
      {selectedCompany && resolveResult?.cached && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-navy-50 border border-navy-100 rounded-2xl px-5 py-4 mb-6 max-w-2xl mx-auto">
          <span className="text-sm text-navy-800">
            {t.lastAnalyzedLabel(selectedCompany.name, daysAgo(resolveResult.lastAnalyzedAt))}
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => resolveResult.analysisId && router.push(`/?id=${resolveResult.analysisId}`)}
              className="px-4 py-2 rounded-xl bg-navy-600 text-white text-xs font-medium hover:bg-navy-700 transition-colors whitespace-nowrap"
            >
              {t.viewNow}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleForceRefresh(selectedCompany.companyId, selectedCompany.name)}
              className="px-4 py-2 rounded-xl border border-navy-300 bg-white text-navy-700 text-xs font-medium hover:bg-navy-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {t.reanalyze}
            </button>
          </div>
        </div>
      )}

      {/* 무료 분석 횟수 카운터 (로그인 유저 전용) / 비로그인 안내 */}
      {session && usage ? (
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
            {usage.isPremium
              ? t.premiumUnlimited
              : t.freeUsageCount(usage.usedCount, usage.limit ?? 2)}
          </span>
        </div>
      ) : !session ? (
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
            {t.loginForFreeAnalyses}
          </span>
        </div>
      ) : null}

      {/* Phase 2 progress bar — only shows after batch 1 completes */}
      {loading && progress && completedBatches.has(1) && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{t.batchProgress(progress.completed, progress.total)}</span>
            <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase 1: full loading screen before summary arrives */}
      {phase1 && !error && (
        <AnalysisLoadingScreen companyName={companyName.trim() || t.defaultCompanyName} isFirstLookup={isFirstLookup} />
      )}

      {/* Rate limit block — 무료 분석 횟수 소진 */}
      {rateLimitInfo && (
        <div className="bg-risk-bg border border-risk-border rounded-2xl p-5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-risk">{rateLimitInfo.message}</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-risk-border bg-white text-risk text-xs font-medium hover:bg-risk-bg transition-colors whitespace-nowrap"
              onClick={handleRequestFreeTrial}
            >
              {t.requestFreeTrial}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-navy-600 text-white text-xs font-medium hover:bg-navy-700 transition-colors whitespace-nowrap"
              onClick={() => showToast(t.premiumComingSoon)}
            >
              {t.upgradeUnlimited}
            </button>
          </div>
        </div>
      )}

      {fetchingId && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          {t.loadingResult}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-risk-bg border border-risk-border rounded-2xl p-5 text-risk text-sm">
          {error}
        </div>
      )}

      {/* Result (final or streaming partial) */}
      {showCard && !fetchingId && (
        <div>
          {/* Cache banner */}
          {result && isCached && (
            <div className="flex items-center justify-between bg-navy-50 border border-navy-100 rounded-xl px-4 py-2.5 mb-3">
              <span className="text-xs text-navy-700">
                {t.previousResultBanner(new Date(result.createdAt).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }))}
              </span>
              <button
                onClick={() => handleForceRefresh()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-800 font-medium disabled:opacity-50"
              >
                <RefreshCw size={12} />
                {t.reanalyzeNew}
              </button>
            </div>
          )}

          {/* Share bar — only when analysis is saved (has real ID) */}
          {result && (
            <div className="flex items-center justify-end gap-2 mb-3">
              {isShared ? (
                <>
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    {t.sharingActive}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 text-xs text-navy-600 hover:text-navy-800 bg-navy-50 hover:bg-navy-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Link size={12} />
                    {t.copyLink}
                  </button>
                  <button
                    onClick={handleRevoke}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <X size={12} />
                    {t.unshare}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  <Share2 size={12} />
                  {sharing ? t.creatingShare : t.share}
                </button>
              )}
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
              {toast}
            </div>
          )}

          {/* 2026-08-17부터 AnalysisCard가 탭 전환 없는 sticky 그리드+스크롤 문서로
              바뀌면서 기업분석/pain 진단 두 그룹이 항상 함께 이어져 보인다. */}
          <AnalysisCard data={showCard} reanalyzingTabs={reanalyzingTabs} onReanalyze={handleReanalyzeTab} isPremium={usage?.isPremium ?? false} />
        </div>
      )}

      {pendingSuggestion && (
        <LoginPromptModal
          companyName={pendingSuggestion.name}
          onClose={() => setPendingSuggestion(null)}
          onContinue={() => {
            sessionStorage.setItem(PENDING_SELECTION_KEY, JSON.stringify(pendingSuggestion));
            signInWithGoogle();
          }}
        />
      )}
    </div>
  );
}

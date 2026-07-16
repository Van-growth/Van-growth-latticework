'use client';

import { useState, useEffect, useRef, useMemo, FormEvent, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Share2, Link, X, RefreshCw } from 'lucide-react';
import AnalysisCard from './AnalysisCard';
import LoginPromptModal from './LoginPromptModal';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
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

const SCAN_MESSAGES = [
  'SEC 공시 문서 분석 중...',
  '10-K 497페이지 정독 중...',
  '밸류체인 끝까지 추적 중...',
  '경쟁사 포지셔닝 파악 중...',
  '재무 데이터 교차 검증 중...',
  '창업자 히스토리 조사 중...',
  '산업 구조 매핑 중...',
];

function AnalysisLoadingScreen({ companyName, isFirstLookup }: { companyName: string; isFirstLookup: boolean }) {
  const messages = useMemo(() => [
    ...SCAN_MESSAGES,
    `${companyName} 분석 마무리 중...`,
  ], [companyName]);

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
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-100 rounded-full" />
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
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-3 py-1 mt-3">
          처음 조회하는 기업이라 조금 더 걸려요
        </p>
      )}

      {/* Bouncing dots — CSS class 기반 (inline animation 미작동 방지) */}
      <div className="flex gap-2.5 mt-8 items-end h-6">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-b1 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 dot-b2 inline-block" />
        <span className="w-2.5 h-2.5 rounded-full bg-blue-400 dot-b3 inline-block" />
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

  const [companyName, setCompanyName] = useState('');
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
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
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [reanalyzingTabs, setReanalyzingTabs] = useState<Set<string>>(new Set());
  const [isFirstLookup, setIsFirstLookup] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ message: string; nextAvailableAt: string | null; usedCount: number } | null>(null);
  const [usage, setUsage] = useState<{ isPremium: boolean; usedCount: number; limit: number | null } | null>(null);

  const loadedIdRef = useRef<string | null>(null);
  const streamingRef = useRef<AnalysisDetail | null>(null);

  async function refreshUsage() {
    // 무료 분석 카운트는 로그인 유저 기준으로만 동작 — 비로그인 상태면 조회 자체를 스킵.
    if (!session) { setUsage(null); return; }
    try {
      const res = await fetch(`${API_URL}/api/analyze/usage`, {
        headers: buildAuthHeaders(null, session.access_token),
      });
      if (!res.ok) return;
      const data = await res.json();
      setUsage({ isPremium: data.isPremium, usedCount: data.usedCount, limit: data.limit });
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

  useEffect(() => {
    if (result) {
      setIsShared(result.is_shared ?? false);
      setShareToken(result.share_token ?? null);
    }
  }, [result]);

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
      showToast('링크 복사됨!');
    } catch {
      showToast('공유 링크 생성 실패');
    } finally {
      setSharing(false);
    }
  }

  async function handleCopyLink() {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    showToast('링크 복사됨!');
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
      showToast('공유가 해제되었습니다.');
    } catch {
      showToast('공유 해제 실패');
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
      .catch(() => setError('분석 결과를 불러오지 못했습니다.'))
      .finally(() => setFetchingId(false));
  }, [urlId, setAnalysisData, session]);

  const REANALYZE_FIELD: Record<string, keyof AnalysisDetail> = {
    summary:        'summary_v2',
    industry:       'industry_history_v2',
    business_model: 'business_model_v2',
    competitors:    'competitors_v2',
    tech:           'tech_evolution_v2',
    value_chain:    'value_chain_v2',
    strategy:       'strategy_v2',
    financials:     'financials_v2',
    founder:        'founder_v2',
  };

  async function handleReanalyzeTab(tab: string) {
    if (!result?.id) return;
    if (!session) { signInWithGoogle(); return; }
    setReanalyzingTabs(prev => new Set([...prev, tab]));
    try {
      const resp = await fetch(`${API_URL}/api/analyze/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({ analysisId: result.id, companyName: result.companyName, section: tab }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const { data } = await resp.json();
      const field = REANALYZE_FIELD[tab];
      if (field && data) {
        const updated = { ...result, [field]: data };
        setResult(updated);
        setAnalysisData(updated);
        setDisplayData(updated);
      }
    } catch (err) {
      console.error('[reanalyze]', tab, err);
    } finally {
      setReanalyzingTabs(prev => { const s = new Set(prev); s.delete(tab); return s; });
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
    setCompletedBatches(new Set([-1])); // sentinel: streaming started, no batch done yet → all tabs show skeleton
    streamingRef.current = null;

    try {
      const clientId = getClientId();
      const res = await fetch(`${API_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(clientId, session?.access_token),
        },
        body: JSON.stringify({ companyName: name, forceRefresh, companyId }),
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        setError((errData as { error?: string }).error || '분석 중 오류가 발생했습니다.');
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
              if (!streamingRef.current) {
                streamingRef.current = Object.assign(emptyBase(name), batchData);
              } else {
                streamingRef.current = { ...streamingRef.current, ...batchData } as AnalysisDetail;
              }
              setDisplayData({ ...streamingRef.current });
              // batch 4 also unlocks financials tab (batch 40) in case fin_preview wasn't sent
              const extra = batchNum === 4 ? [40] : [];
              setCompletedBatches(prev => new Set([...prev, batchNum, ...extra]));

              setProgress({ completed: payload.completed, total: payload.total });

            } else if (eventType === 'done') {
              const normalized = normalizeResponse(payload as AnalyzeResponse);
              setIsCached(payload.cached === true);
              loadedIdRef.current = normalized.id;
              setResult(normalized);
              setAnalysisData(normalized);
              setCompletedBatches(new Set([-1, 1, 2, 3, 4, 5, 6, 40])); // keep -1 so isStreaming stays true → tab ✓ icons persist
              if (normalized.id) router.replace(`/?id=${normalized.id}`);
              refreshUsage();
              trackEvent('report_generated', { companyName: normalized.companyName, cached: payload.cached === true });

            } else if (eventType === 'error') {
              setError(payload.message || '분석 중 오류가 발생했습니다.');
            }
          } catch {
            // malformed SSE line, skip
          }
        }
      }
    } catch {
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
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
    const userEmail = session?.user?.email ?? '(이메일 확인 불가)';
    const requestedAt = new Date().toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
    const limit = usage?.limit ?? 2;
    const usedCount = rateLimitInfo?.usedCount ?? limit;
    const lastCompany = companyName.trim();

    const subject = `[1min] 무료 이용권 요청 - ${userEmail}`;
    const body = [
      `유저 이메일: ${userEmail}`,
      `요청 일시: ${requestedAt}`,
      `사용한 무료 분석 횟수: ${usedCount}/${limit}`,
      ...(lastCompany ? [`마지막 검색 시도 기업: ${lastCompany}`] : []),
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
        body: JSON.stringify({ name: s.name, listings: s.listings }),
      });
      if (res.status === 401) { setPendingSuggestion(s); return; }
      if (!res.ok) throw new Error();
      const data = await res.json() as CompanyResolveResponse;
      setSelectedCompany({ name: s.name, companyId: data.companyId, listings: s.listings });
      setResolveResult(data);
    } catch {
      showToast('기업 정보를 확인하지 못했습니다. 다시 시도해주세요.');
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
  // Phase 2: batch 1 done → show card (summary real, others skeleton)
  const phase1 = loading && completedBatches.has(-1) && !completedBatches.has(1);
  const showCard = result ?? (loading && completedBatches.has(1) ? (displayData ?? emptyBase(companyName.trim())) : null);

  // Nudge banner: visible during streaming after batch 1 completes
  const isStreaming = completedBatches.has(-1);
  const nudgeItems = [
    { label: '산업분석', done: completedBatches.has(2) },
    { label: '재무',     done: completedBatches.has(40) || completedBatches.has(4) },
    { label: '경쟁사',   done: completedBatches.has(2) },
    { label: '전략',     done: completedBatches.has(3) },
    { label: '창업자',   done: completedBatches.has(5) },
  ];
  const allNudgeDone = nudgeItems.every(it => it.done);
  const showNudge = isStreaming && completedBatches.has(1) && !nudgeDismissed;

  // Reset dismissed state when a new analysis begins, auto-dismiss 3s after all done
  useEffect(() => {
    if (isStreaming && !completedBatches.has(1)) setNudgeDismissed(false);
  }, [isStreaming, completedBatches]);

  useEffect(() => {
    if (!allNudgeDone || nudgeDismissed) return;
    const t = setTimeout(() => setNudgeDismissed(true), 3000);
    return () => clearTimeout(t);
  }, [allNudgeDone, nudgeDismissed]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">기업 심층 분석</h1>
        <p className="text-gray-500">산업역사, 기술변화, 밸류체인, BM, 재무를 한번에</p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <div className="relative flex-1">
            <input
              type="text"
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setSelectedCompany(null); setResolveResult(null); }}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => setShowDropdown(false)}
              placeholder="기업명 입력 (예: 삼성전자, Apple, NVIDIA)"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
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
                      className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${i === activeSuggestion ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
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
          </div>
          {selectedCompany && resolveResult && !resolveResult.cached ? (
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? '분석 중...' : '새 분석 시작'}
            </button>
          ) : (
            <button
              type="submit"
              disabled
              title="검색 목록에서 기업을 선택하세요"
              className="px-6 py-3 rounded-xl bg-gray-200 text-gray-400 font-medium shadow-sm cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {resolving ? '확인 중...' : '분석하기'}
            </button>
          )}
        </div>
      </form>

      {/* 캐시 있음 — 서버 응답(resolveResult.cached)에 따라서만 보여짐, 유저가 고르는 토글 아님 */}
      {selectedCompany && resolveResult?.cached && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-6 max-w-2xl mx-auto">
          <span className="text-sm text-blue-800">
            {selectedCompany.name} — 최근 분석 {daysAgo(resolveResult.lastAnalyzedAt)}일 전
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => resolveResult.analysisId && router.push(`/?id=${resolveResult.analysisId}`)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
            >
              바로 보기
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleForceRefresh(selectedCompany.companyId, selectedCompany.name)}
              className="px-4 py-2 rounded-xl border border-blue-300 bg-white text-blue-700 text-xs font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              재분석하기
            </button>
          </div>
        </div>
      )}

      {/* 무료 분석 횟수 카운터 (로그인 유저 전용) / 비로그인 안내 */}
      {session && usage ? (
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
            {usage.isPremium
              ? '프리미엄 · 무제한 분석'
              : `최근 7일 무료 분석 ${usage.usedCount}/${usage.limit}회 사용`}
          </span>
        </div>
      ) : !session ? (
        <div className="flex justify-center mb-6">
          <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-full px-3 py-1">
            로그인 후 무료 2회 분석 가능
          </span>
        </div>
      ) : null}

      {/* Phase 2 progress bar — only shows after batch 1 completes */}
      {loading && progress && completedBatches.has(1) && (
        <div className="max-w-2xl mx-auto mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>분석 중 배치 {progress.completed} / {progress.total} 완료</span>
            <span>{Math.round((progress.completed / progress.total) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((progress.completed / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase 1: full loading screen before summary arrives */}
      {phase1 && !error && (
        <AnalysisLoadingScreen companyName={companyName.trim() || '기업'} isFirstLookup={isFirstLookup} />
      )}

      {/* Rate limit block — 무료 분석 횟수 소진 */}
      {rateLimitInfo && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-amber-800">{rateLimitInfo.message}</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-amber-300 bg-white text-amber-700 text-xs font-medium hover:bg-amber-50 transition-colors whitespace-nowrap"
              onClick={handleRequestFreeTrial}
            >
              무료 이용권 요청하기
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
              onClick={() => showToast('프리미엄 플랜 준비 중입니다')}
            >
              프리미엄으로 무제한 이용하기
            </button>
          </div>
        </div>
      )}

      {fetchingId && !loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          불러오는 중...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Result (final or streaming partial) */}
      {showCard && !fetchingId && (
        <div>
          {/* Cache banner */}
          {result && isCached && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 mb-3">
              <span className="text-xs text-amber-700">
                이전 분석 결과입니다 ({new Date(result.createdAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })})
              </span>
              <button
                onClick={() => handleForceRefresh()}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
              >
                <RefreshCw size={12} />
                새로 분석하기
              </button>
            </div>
          )}

          {/* Share bar — only when analysis is saved (has real ID) */}
          {result && (
            <div className="flex items-center justify-end gap-2 mb-3">
              {isShared ? (
                <>
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    공유 중
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Link size={12} />
                    링크 복사
                  </button>
                  <button
                    onClick={handleRevoke}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <X size={12} />
                    공유 해제
                  </button>
                </>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                >
                  <Share2 size={12} />
                  {sharing ? '생성 중...' : '공유'}
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

          <AnalysisCard data={showCard} reanalyzingTabs={reanalyzingTabs} onReanalyze={handleReanalyzeTab} isPremium={usage?.isPremium ?? false} />
        </div>
      )}

      {/* Nudge banner — fixed bottom, appears in phase 2 while streaming */}
      {showNudge && (
        <div className="fixed bottom-0 inset-x-0 z-40 flex justify-center pb-3 px-4 pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-3 shadow-lg border rounded-full px-4 py-2 transition-all duration-500 text-[11px] ${
            allNudgeDone
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white/95 backdrop-blur-sm border-gray-200'
          }`}>
            {allNudgeDone ? (
              <span className="font-medium text-emerald-700 flex items-center gap-1.5">
                <span className="anim-fadein inline-block">✓</span>
                분석 완료
              </span>
            ) : (
              <>
                <span className="text-gray-400 shrink-0 font-medium">분석 중</span>
                <span className="w-px h-3 bg-gray-200 shrink-0" />
                <div className="flex items-center gap-2.5">
                  {nudgeItems.map(item => (
                    <span key={item.label} className={`flex items-center gap-0.5 transition-colors duration-300 ${item.done ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {item.done
                        ? <span className="anim-fadein inline-block font-bold mr-0.5">✓</span>
                        : <span className="w-1 h-1 rounded-full bg-current opacity-50 mr-0.5 animate-pulse" />
                      }
                      {item.label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
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

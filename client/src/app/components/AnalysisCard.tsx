'use client';

import { useState, useEffect, memo, useCallback, useMemo, useTransition } from 'react';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { trackEvent } from '@/lib/analytics';
import dynamic from 'next/dynamic';
import {
  BarChart2, Zap, GitBranch, Users, DollarSign, Target,
  BookOpen, ExternalLink, Building2, Clock, Briefcase, User, RefreshCw,
  TrendingUp, Lock, Copy, Check, Lightbulb,
} from 'lucide-react';
const ExportPdfButton = dynamic(() => import('./ExportPdfButton'), { ssr: false, loading: () => null });
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';
import {
  AnalysisDetail,
  Metric,
  MoatAnalysis,
  RiskAnalysis,
  CompetitorsAnalysis,
  DirectCompetitor,
  StrategyAnalysis,
  StructuredFinancials,
  DataSource,
  Source,
  SourceLevel,
  SummaryV2,
  IndustryHistoryV2,
  TechEvolutionV2,
  ValueChainV2,
  BusinessModelV2,
  CompetitorsV2,
  CrossIndustryNudgeV1,
  StrategyV2,
  FinancialsV2,
  FinancialsV2Row,
  FounderV2,
  GrowthScenarioV2,
  SecBenchmarkComparison,
} from '@/types';
import { isPlaceholder, countFinancialsReliability } from '@/lib/financialsReliability';

// ── Country flag map ─────────────────────────────────────────────────────────

const COUNTRY_FLAG: Record<string, string> = {
  '미국': '🇺🇸', '한국': '🇰🇷', '대한민국': '🇰🇷', '중국': '🇨🇳', '일본': '🇯🇵',
  '독일': '🇩🇪', '프랑스': '🇫🇷', '영국': '🇬🇧', '인도': '🇮🇳', '캐나다': '🇨🇦',
  '호주': '🇦🇺', '이탈리아': '🇮🇹', '스페인': '🇪🇸', '네덜란드': '🇳🇱', '스웨덴': '🇸🇪',
  '스위스': '🇨🇭', '노르웨이': '🇳🇴', '덴마크': '🇩🇰', '핀란드': '🇫🇮', '오스트리아': '🇦🇹',
  '벨기에': '🇧🇪', '포르투갈': '🇵🇹', '아일랜드': '🇮🇪', '폴란드': '🇵🇱', '체코': '🇨🇿',
  '헝가리': '🇭🇺', '루마니아': '🇷🇴', '그리스': '🇬🇷', '이스라엘': '🇮🇱', '싱가포르': '🇸🇬',
  '대만': '🇹🇼', '홍콩': '🇭🇰', '브라질': '🇧🇷', '멕시코': '🇲🇽', '러시아': '🇷🇺',
  '터키': '🇹🇷', '아랍에미리트': '🇦🇪', '사우디아라비아': '🇸🇦', '인도네시아': '🇮🇩',
  '베트남': '🇻🇳', '태국': '🇹🇭', '말레이시아': '🇲🇾', '필리핀': '🇵🇭',
  // English variants
  'US': '🇺🇸', 'USA': '🇺🇸', 'United States': '🇺🇸', 'America': '🇺🇸',
  'Korea': '🇰🇷', 'South Korea': '🇰🇷',
  // ISO 3166-1 alpha-2 코드 — 스키마상 country 필드 포맷이 강제돼있지 않아
  // Claude가 가끔 국가명 대신 2자리 코드로 반환하는 경우 대비(2026-07-16, 레거시
  // CompetitorCard가 flagOf() 호출 자체를 안 하던 버그와 별개 — 그것도 같이 수정함)
  'KR': '🇰🇷', 'CN': '🇨🇳', 'JP': '🇯🇵', 'DE': '🇩🇪', 'FR': '🇫🇷', 'GB': '🇬🇧', 'IN': '🇮🇳',
  'China': '🇨🇳', 'Japan': '🇯🇵', 'Germany': '🇩🇪', 'France': '🇫🇷',
  'UK': '🇬🇧', 'United Kingdom': '🇬🇧', 'Britain': '🇬🇧', 'India': '🇮🇳',
  'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Italy': '🇮🇹', 'Spain': '🇪🇸',
  'Netherlands': '🇳🇱', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭', 'Norway': '🇳🇴',
  'Denmark': '🇩🇰', 'Finland': '🇫🇮', 'Austria': '🇦🇹', 'Belgium': '🇧🇪',
  'Portugal': '🇵🇹', 'Ireland': '🇮🇪', 'Poland': '🇵🇱', 'Czech Republic': '🇨🇿',
  'Hungary': '🇭🇺', 'Romania': '🇷🇴', 'Greece': '🇬🇷', 'Israel': '🇮🇱',
  'Singapore': '🇸🇬', 'Taiwan': '🇹🇼', 'Hong Kong': '🇭🇰', 'Brazil': '🇧🇷',
  'Mexico': '🇲🇽', 'Russia': '🇷🇺', 'Turkey': '🇹🇷', 'UAE': '🇦🇪',
  'Indonesia': '🇮🇩', 'Vietnam': '🇻🇳', 'Thailand': '🇹🇭', 'Malaysia': '🇲🇾',
  'Philippines': '🇵🇭',
};

function flagOf(country: string): string {
  if (!country) return '';
  // try exact match, then first word match
  return COUNTRY_FLAG[country.trim()] ?? COUNTRY_FLAG[country.trim().split(/[,/ ]/)[0]] ?? '';
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Tag({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    gray:    'bg-gray-100 text-gray-600',
    blue:    'bg-blue-50 text-blue-700',
    green:   'bg-green-50 text-green-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    red:     'bg-red-50 text-red-700',
    violet:  'bg-violet-50 text-violet-700',
    purple:  'bg-purple-50 text-purple-700',
    orange:  'bg-orange-50 text-orange-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${map[color] ?? map.gray}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, dotColor = 'bg-gray-300', children, className = '' }: {
  title?: string;
  dotColor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-4 ${className}`}>
      {title && (
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${dotColor}`} />
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function DataValue({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  const str = text ?? '—';
  if (isPlaceholder(str)) {
    return <span className={`text-gray-400 ${className}`}>—</span>;
  }
  if (str === '확인 필요' || str === '공개 없음' || str === 'Not disclosed') {
    return <span className={`text-gray-400 italic ${className}`}>{str}</span>;
  }
  // "해당없음"/"Not applicable" — 조회 실패("확인 필요"/"Not disclosed")가 아니라 애초에 존재하지
  // 않는 데이터. 지표 자체가 구조상 미보고(예: 지주회사·보험사의 영업이익)이거나, 그 연도의
  // 재무제표 자체가 원천 공시에 없는 경우(예: 설립/상장 이전 연도) 둘 다 포함. 기울임 없이 구분
  // 표시. 2026-08 프롬프트 영어 단일화 이후 신규 분석은 영어 마커, 기존 캐시는 한국어 마커를
  // 그대로 유지하므로 둘 다 매칭한다.
  if (str === '해당없음' || str === 'Not applicable') {
    return <span className={`text-gray-400 ${className}`} title="이 지표 또는 연도의 데이터가 원천 공시에 존재하지 않음">{str}</span>;
  }
  const estimateMarker = str.includes('(estimated)') ? '(estimated)' : str.includes('(추정)') ? '(추정)' : null;
  if (estimateMarker) {
    const idx = str.indexOf(estimateMarker);
    return (
      <span className={className}>
        {str.slice(0, idx)}<span className="text-amber-500">{estimateMarker}</span>{str.slice(idx + estimateMarker.length)}
      </span>
    );
  }
  return <span className={className}>{str}</span>;
}

// KPI 값에서 출처명·설명 제거 — "(2025, SEC EDGAR S-1)" → "(2025)"
function cleanMetricValue(v: string): string {
  return v.replace(/\((\d{4}[^,)]*),([^)]*)\)/g, '($1)');
}

// 재무 수치 옆 "(EDGAR)"/"(DART)" 텍스트 → 컬러 점 치환
const FINANCIAL_SOURCE_RE = /\s*\((EDGAR|DART|FMP|DART 공시|EDGAR 공시|SEC EDGAR)\)/gi;
// 서사 텍스트 내 "[SEC EDGAR] …" 형식 앞 태그 제거
const BRACKET_SOURCE_RE = /^\[(?:SEC EDGAR|DART 공시|EDGAR|DART)\]\s*/;

function FinancialValue({ text, dataSource }: { text: string | null | undefined; dataSource?: DataSource }) {
  const str = text ?? '—';
  const match = str.match(FINANCIAL_SOURCE_RE);
  const cleaned = match ? str.replace(FINANCIAL_SOURCE_RE, '').trim() : str;
  const tag = (match?.[0] ?? '').replace(/[()]/g, '').trim().toUpperCase();
  const tagIsEdgar = tag.includes('EDGAR');
  const tagIsDart  = !tagIsEdgar && tag.includes('DART');
  // 데이터가 없는 셀("확인 필요" 등 placeholder)에는 탭 레벨 dataSource로 폴백하지 않음 —
  // 값이 없는데 공식 출처 배지가 붙으면 실제로 확인된 값처럼 오인됨
  const isNoData = cleaned === '확인 필요' || cleaned === '공개 없음' || cleaned === '해당없음' || cleaned === 'Not disclosed' || cleaned === 'Not applicable' || isPlaceholder(cleaned);
  // If value has no explicit tag, fall back to the tab-level dataSource
  const isEdgar = tagIsEdgar || (!match && !isNoData && dataSource === 'edgar');
  const isDart  = tagIsDart  || (!match && !isNoData && dataSource === 'dart');
  return (
    <span className="inline-flex items-center gap-0.5">
      <DataValue text={cleaned} />
      {(isEdgar || isDart) && (
        // EDGAR/DART 둘 다 공식 데이터(L1)라 색상은 동일 — isEdgar/isDart는 툴팁 텍스트에만 사용
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 cursor-help ${LEVEL_DOT.L1}`}
          title={isEdgar ? 'SEC EDGAR 공식 데이터' : 'DART 공식 데이터'}
        />
      )}
    </span>
  );
}

function MetricCard({ value, label, trend, sourceIndex }: { value: string; label: string; trend?: 'up' | 'down' | 'flat'; sourceIndex?: number | null }) {
  const cleaned = cleanMetricValue(value);
  const isUnknown = cleaned === '확인 필요' || cleaned === '공개 없음' || cleaned === '해당없음' || cleaned === 'Not disclosed' || cleaned === 'Not applicable' || isPlaceholder(cleaned);
  const displayValue = isPlaceholder(cleaned) ? '—' : cleaned;
  const trendEl = trend === 'up'
    ? <span className="text-green-500 text-sm font-bold ml-1 leading-none shrink-0">▲</span>
    : trend === 'down'
    ? <span className="text-red-500 text-sm font-bold ml-1 leading-none shrink-0">▼</span>
    : trend === 'flat'
    ? <span className="text-gray-400 text-sm ml-1 leading-none shrink-0">→</span>
    : null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div className="font-semibold text-sm text-gray-900 leading-snug flex items-center min-w-0">
        <span className="break-all min-w-0 flex-1">
          <DataValue text={displayValue} />
        </span>
        {!isUnknown && trendEl}
        {!isUnknown && sourceIndex != null && (
          <sup className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold ml-0.5 align-top mt-0.5 shrink-0">
            {sourceIndex}
          </sup>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'bg-blue-400', height = 'h-2' }: {
  value: number;
  color?: string;
  height?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`w-full ${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function splitCfValue(raw: string): [string, string] {
  const m = raw.match(/^([$₩]?[\d,]+(?:\.\d+)?(?:억|조|B|M|K|T|%|배|원|x)?)(.*)$/);
  if (m && m[1] && m[2].trim()) {
    return [m[1].trim(), m[2].replace(/^\s*[\(\[·,]+\s*|\s*[\)\]]+\s*$/g, '').trim()];
  }
  return [raw, ''];
}

function CfMetricCard({ label, value, dotColor }: { label: string; value: string; dotColor: string }) {
  const stripped = value.replace(FINANCIAL_SOURCE_RE, '').trim();
  const [numPart, descPart] = splitCfValue(stripped);
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-900 leading-snug break-words"><DataValue text={numPart} /></div>
      {descPart && <div className="text-xs text-gray-500 leading-snug mt-0.5 break-words"><DataValue text={descPart} /></div>}
    </div>
  );
}

const LEVEL_BADGE: Record<string, { label: string; cls: string }> = {
  L1: { label: '🟢 공식', cls: 'bg-green-50 text-green-700 border border-green-200' },
  L2: { label: '🟡 참고', cls: 'bg-amber-50 text-amber-600 border border-amber-200' },
  L3: { label: '⚪ 추정', cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

// 출처 종류(EDGAR/DART/웹검색)가 아니라 신뢰도(L1/L2/L3) 기준으로 점 색상 결정 —
// EDGAR/DART는 둘 다 L1이므로 항상 동일한 색으로 렌더링됨
const LEVEL_DOT: Record<SourceLevel, string> = {
  L1: 'bg-green-500',
  L2: 'bg-amber-500',
  L3: 'bg-gray-400',
};

function SourcesList({ sources }: { sources: Source[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={11} className="text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">출처</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sources.map((s, i) => {
          const idx = s.index ?? i + 1;
          const badge = LEVEL_BADGE[s.level] ?? LEVEL_BADGE.L2;
          return (
            <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="shrink-0 font-bold text-gray-700 w-6 text-right mt-0.5">[{idx}]</span>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none mt-0.5 ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="leading-snug flex-1">
                <span className="font-medium text-gray-700">{s.organization}</span>
                {s.date && <span className="text-gray-400 ml-1">{s.date}</span>}
                {' — '}
                <span>{s.content}</span>
                {s.isEstimate && <span className="ml-1 text-amber-600 font-medium">(추정)</span>}
              </span>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 mt-0.5 text-blue-400 hover:text-blue-600">
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Data Source Badge ─────────────────────────────────────────────────────────

// label은 출처 종류별 텍스트 구분용, level은 색상 결정용(EDGAR/DART 둘 다 공식 데이터라 L1로 동일)
const DATA_SOURCE_CONFIG: Record<DataSource, { label: string; level: SourceLevel }> = {
  dart:       { label: 'DART 연동됨',      level: 'L1' },
  edgar:      { label: 'SEC EDGAR 연동됨', level: 'L1' },
  web_search: { label: '웹 검색 기반',      level: 'L3' },
};

function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = DATA_SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE[cfg.level].cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT[cfg.level]}`} />
      {cfg.label}
    </span>
  );
}

// ── Key bullets block ─────────────────────────────────────────────────────────

function KeyBulletsBlock({ bullets }: { bullets?: string[] | null }) {
  if (!bullets?.length) return null;
  return (
    <div className="bg-gray-900 rounded-xl px-5 py-4">
      <ul className="space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="text-white text-sm font-medium leading-snug flex items-start gap-2">
            <span className="text-blue-400 shrink-0 mt-0.5">•</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Cited text (renders [n] markers as superscript badges) ────────────────────

function CitedText({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts = text.split(/(\[\d+\])/g);
  if (parts.length === 1) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) return (
          <sup key={i} className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-bold ml-0.5 align-top mt-0.5">
            {m[1]}
          </sup>
        );
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Legacy Helpers ────────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

function extractMetrics(text: string): Metric[] {
  const lines = splitLines(text);
  const results: Metric[] = [];
  for (const line of lines) {
    const m = line.match(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|%|배|원|x|T)+)/);
    if (m) {
      results.push({
        value: m[1],
        label: line.replace(m[0], '').replace(/[:：\s·\-–]+/g, ' ').trim() || line,
      });
      if (results.length >= 8) break;
    }
  }
  return results;
}

// ── V2 Config Maps ────────────────────────────────────────────────────────────

const HYPE_LEVEL_CFG: Record<string, { label: string; cls: string }> = {
  emerging:   { label: 'Emerging',   cls: 'bg-blue-50 text-blue-600' },
  hype:       { label: 'Peak Hype',  cls: 'bg-amber-50 text-amber-700' },
  trough:     { label: 'Trough',     cls: 'bg-red-50 text-red-600' },
  recovery:   { label: 'Recovery',   cls: 'bg-green-50 text-green-700' },
  mainstream: { label: 'Mainstream', cls: 'bg-gray-100 text-gray-600' },
};

const PRICING_POWER_CFG: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High Pricing Power', cls: 'bg-green-50 text-green-700' },
  medium: { label: 'Medium',             cls: 'bg-amber-50 text-amber-700' },
  low:    { label: 'Low',                cls: 'bg-red-50 text-red-700' },
};

const MOAT_STRENGTH_CFG: Record<string, { label: string; cls: string; barColor: string; width: string }> = {
  strong: { label: 'Strong', cls: 'bg-green-50 text-green-700',  barColor: 'bg-green-400', width: 'w-[90%]' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700',  barColor: 'bg-amber-400', width: 'w-[60%]' },
  weak:   { label: 'Weak',   cls: 'bg-red-50 text-red-700',      barColor: 'bg-red-400',   width: 'w-[30%]' },
};

const GROWTH_MOTION_CFG: Record<string, { label: string; cls: string }> = {
  PLG:    { label: 'Product-Led Growth',  cls: 'bg-purple-100 text-purple-700' },
  SLG:    { label: 'Sales-Led Growth',    cls: 'bg-blue-100 text-blue-700' },
  FLG:    { label: 'Finance-Led Growth',  cls: 'bg-emerald-100 text-emerald-700' },
  hybrid: { label: 'Hybrid',              cls: 'bg-amber-100 text-amber-700' },
};

const COMPETITIVE_POSITION_CFG: Record<string, { label: string; cls: string }> = {
  leader:     { label: 'Market Leader', cls: 'bg-blue-100 text-blue-700' },
  challenger: { label: 'Challenger',    cls: 'bg-orange-100 text-orange-700' },
  niche:      { label: 'Niche Player',  cls: 'bg-violet-100 text-violet-700' },
  follower:   { label: 'Follower',      cls: 'bg-gray-100 text-gray-600' },
};

const VC_POSITION_CFG: Record<string, { label: string; cls: string }> = {
  upstream:   { label: 'Upstream',   cls: 'bg-amber-100 text-amber-700' },
  midstream:  { label: 'Midstream',  cls: 'bg-blue-100 text-blue-700' },
  downstream: { label: 'Downstream', cls: 'bg-green-100 text-green-700' },
};

const BAR_COLORS = ['bg-blue-400', 'bg-indigo-400', 'bg-purple-400', 'bg-violet-400', 'bg-emerald-400'];

// ── V2 Tab: 요약 ──────────────────────────────────────────────────────────────

function SummaryV2Tab({ s, sources, onTabChange }: { s: SummaryV2; sources: Source[] | undefined; onTabChange?: (tab: string) => void }) {
  const vcPos = VC_POSITION_CFG[s.value_chain_position] ?? VC_POSITION_CFG.midstream;
  // When a ticker is available, TradingView replaces the 시가총액 MetricCard
  const filteredMetrics = s.ticker
    ? s.key_metrics.filter(m => !m.label.includes('시가총액'))
    : s.key_metrics;
  return (
    <div className="space-y-4">
      {/* Key bullets headline */}
      {s.key_bullets?.length ? (
        <div className="bg-gray-900 rounded-xl px-5 py-4 flex items-start justify-between gap-3">
          <ul className="space-y-1.5 flex-1">
            {s.key_bullets.map((b, i) => (
              <li key={i} className="text-white text-sm font-medium leading-snug flex items-start gap-2">
                <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full self-start ${vcPos.cls}`}>
            {vcPos.label}
          </span>
        </div>
      ) : null}

      {/* Key metrics — 3-col grid, no truncation */}
      {filteredMetrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filteredMetrics.map((m, i) => (
            <MetricCard key={i} value={m.value} label={m.label} trend={m.trend} sourceIndex={m.source_index} />
          ))}
        </div>
      )}

      {onTabChange && filteredMetrics.length > 0 && (
        <div className="flex justify-end">
          <button onClick={() => onTabChange('financials')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">재무 상세 보기 →</button>
        </div>
      )}

      {/* Products + Markets — 풀 너비 스택 (바 차트 전체 너비 확보) */}
      <div className="space-y-3">
        {s.products.length > 0 && (
          <SectionCard title="주요 제품/서비스" dotColor="bg-blue-400">
            <div className="space-y-2.5">
              {s.products.map((p, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="font-medium text-gray-800">{p.revenue_share}%</span>
                  </div>
                  <ProgressBar value={p.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {s.key_markets.length > 0 && (
          <SectionCard title="주요 시장" dotColor="bg-indigo-400">
            <div className="space-y-2.5">
              {s.key_markets.map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-700">{flagOf(m.country)} {m.country}</span>
                    <span className="font-medium text-gray-800">{m.revenue_share}%</span>
                  </div>
                  <ProgressBar value={m.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {onTabChange && (s.products.length > 0 || s.key_markets.length > 0) && (
        <div className="flex justify-end -mt-1">
          <button onClick={() => onTabChange('business_model')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">비즈니스모델 보기 →</button>
        </div>
      )}

      {/* Top customers + concentration */}
      {(s.top_customers.length > 0 || s.customer_concentration) && (() => {
        const cc = s.customer_concentration;
        // 유효한 고객 집중도: top_n_share가 존재하고 0이 아니며 placeholder가 아닐 때
        const hasValidCc = cc && cc.top_n_share > 0 && !isPlaceholder(String(cc.top_n_share));
        const validCustomers = hasValidCc
          ? cc.customers.filter(c => c.revenue_share > 0 && !isPlaceholder(String(c.revenue_share)))
          : [];
        return (
          <SectionCard title="주요 고객사" dotColor="bg-violet-400">
            {s.top_customers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {s.top_customers.map((c, i) => (
                  <Tag key={i} label={c} color="violet" />
                ))}
              </div>
            )}
            {hasValidCc ? (
              <div className="space-y-2 mt-2">
                <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium ${
                  cc.is_concentrated
                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                    : 'bg-green-50 text-green-700 border border-green-100'
                }`}>
                  <span>{cc.is_concentrated ? '⚠️' : '✅'}</span>
                  <span>
                    상위 {cc.top_n}개 고객이 매출 {cc.top_n_share}% 차지
                    {cc.trend === 'diversifying' && ' — 다변화 진행 중'}
                    {cc.trend === 'concentrating' && ' — 집중도 심화'}
                  </span>
                </div>
                {validCustomers.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {validCustomers.map((c, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-gray-600">{c.name}</span>
                          <span className="font-medium text-gray-700">{c.revenue_share}%</span>
                        </div>
                        <ProgressBar value={c.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              !s.top_customers.length && (
                <p className="text-xs text-gray-400 mt-1">집중도 데이터 없음</p>
              )
            )}
          </SectionCard>
        );
      })()}

      {onTabChange && (s.top_customers.length > 0 || s.customer_concentration) && (
        <div className="flex justify-end">
          <button onClick={() => onTabChange('competitors')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">경쟁사 분석 보기 →</button>
        </div>
      )}

      {/* 성장 모멘텀 / 핵심 리스크 — 둘 다 없으면 섹션 자체 미노출 */}
      {(s.bull_case || s.bear_case) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {s.bull_case && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-2">성장 모멘텀</div>
              <p className="text-sm text-gray-700 leading-relaxed">{s.bull_case}</p>
            </div>
          )}
          {s.bear_case && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-2">핵심 리스크</div>
              <p className="text-sm text-gray-700 leading-relaxed">{s.bear_case}</p>
            </div>
          )}
        </div>
      )}

      {/* 최근 트리거 이벤트 — 이벤트 없으면 섹션 자체 미노출 */}
      {s.trigger_events && s.trigger_events.length > 0 && (
        <SectionCard title="최근 트리거 이벤트" dotColor="bg-amber-400">
          <div className="space-y-3">
            {s.trigger_events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="shrink-0 text-[11px] font-medium text-gray-400 w-20 pt-0.5">{ev.date}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mb-0.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-700">{ev.type}</span>
                    {ev.amount && <span className="text-xs font-medium text-gray-700">{ev.amount}</span>}
                    {ev.counterparty && <span className="text-xs text-gray-400">· {ev.counterparty}</span>}
                  </div>
                  <p className="text-sm text-gray-700 leading-snug"><CitedText text={ev.description} /></p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {onTabChange && (
        <div className="flex justify-end">
          <button onClick={() => onTabChange('strategy')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">전략 보기 →</button>
        </div>
      )}

      <SourcesList sources={sources} />
    </div>
  );
}

// ── Legacy Tab: 요약 ──────────────────────────────────────────────────────────

function SummaryTab({ data }: { data: AnalysisDetail }) {
  const lines = splitLines(data.summary);
  const metrics = (data.metrics && data.metrics.length > 0)
    ? data.metrics.slice(0, 8)
    : extractMetrics(data.summary).slice(0, 8);
  const strengths = (data.strengths && data.strengths.length > 0)
    ? data.strengths
    : lines.filter(l => /강점|경쟁|성장|우위|확대|증가|선두|핵심|차별/.test(l)).slice(0, 5);
  const risks = (data.risks && data.risks.length > 0)
    ? data.risks
    : lines.filter(l => /리스크|약점|우려|감소|하락|손실|부채|불확실|위험/.test(l)).slice(0, 5);

  return (
    <div className="space-y-4">
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {metrics.map((m, i) => (
            <MetricCard key={i} value={m.value} label={m.unit ? `${m.label} (${m.unit})` : m.label} />
          ))}
        </div>
      )}
      <SectionCard title="경영 요약" dotColor="bg-blue-400">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
          ))}
        </div>
      </SectionCard>
      {(strengths.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <SectionCard title="핵심 강점" dotColor="bg-[#16a34a]">
              <div>
                {strengths.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start mb-2">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#16a34a] shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{l}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {risks.length > 0 && (
            <SectionCard title="주요 리스크" dotColor="bg-[#dc2626]">
              <div>
                {risks.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start mb-2">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-[#dc2626] shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{l}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
      <SourcesList sources={data.sources?.summary} />
    </div>
  );
}

// ── V2 Tab: 산업역사 ──────────────────────────────────────────────────────────

const IndustryHistoryV2Tab = memo(function IndustryHistoryV2Tab({ h, sources }: { h: IndustryHistoryV2; sources: Source[] | undefined }) {
  const LIMIT = 3;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? h.timeline : h.timeline.slice(0, LIMIT);
  const hasMore = h.timeline.length > LIMIT;
  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={h.key_bullets} />
      <div>
        {visible.map((item, i) => {
          const isLast = i === visible.length - 1 && (!hasMore || expanded);
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center w-10 shrink-0">
                <div className="w-10 h-10 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center shrink-0">
                  <span className="text-[9px] font-semibold text-blue-800 text-center leading-none px-0.5">{item.period.slice(0, 6)}</span>
                </div>
                {!isLast && <div className="w-0.5 bg-gray-100 flex-1 my-1 min-h-[2rem]" />}
              </div>
              <div className="pb-5 flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">{item.title}</span>
                  <span className="text-[11px] text-blue-600 font-medium">{item.period}</span>
                </div>
                <div className="space-y-1 text-xs text-gray-600 mb-2">
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 text-gray-400 w-14">기술</span>
                    <span className="leading-relaxed">{item.technology}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 text-gray-400 w-14">수요</span>
                    <span className="leading-relaxed">{item.market_need}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="shrink-0 text-gray-400 w-14">의의</span>
                    <span className="leading-relaxed">{item.significance}</span>
                  </div>
                </div>
                {item.key_players.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.key_players.map((p, j) => <Tag key={j} label={p} color="blue" />)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-2 text-xs text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg"
        >
          더 보기 ({h.timeline.length - LIMIT}개 더)
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {h.why_durable && (
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-2">지속 가능성</div>
            <p className="text-sm text-gray-700 leading-relaxed">{h.why_durable}</p>
          </div>
        )}
        {h.chasm_points.length > 0 && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-orange-600 mb-2">캐즘 포인트</div>
            <div className="space-y-1.5">
              {h.chasm_points.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-[4px] w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                  <p className="text-xs text-gray-700 leading-relaxed">{c}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <SourcesList sources={sources} />
    </div>
  );
});

// ── V2 Tab: 기술변화 ──────────────────────────────────────────────────────────

const TechEvolutionV2Tab = memo(function TechEvolutionV2Tab({ t, sources }: { t: TechEvolutionV2; sources: Source[] | undefined }) {
  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={t.key_bullets} />

      {/* Above fold: current stage + next inflection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {t.current_stage && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 mb-2">현재 단계</div>
            <p className="text-sm text-gray-700 leading-relaxed">{t.current_stage}</p>
          </div>
        )}
        {t.next_inflection && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 mb-2">다음 변곡점</div>
            <p className="text-sm text-gray-700 leading-relaxed">{t.next_inflection}</p>
          </div>
        )}
      </div>

      {/* Below fold: full stage history */}
      {t.stages.length > 0 && (
        <ShowMore label="기술 변화 단계 전체 보기">
          <div className="space-y-3">
            {t.stages.map((s, i) => {
              const hype = HYPE_LEVEL_CFG[s.hype_level] ?? HYPE_LEVEL_CFG.mainstream;
              return (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <div className="w-6 h-6 rounded-full bg-purple-50 border-2 border-purple-400 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-purple-800">{s.stage}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{s.title}</span>
                    <span className="text-[11px] text-purple-600 font-medium">{s.period}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${hype.cls}`}>{hype.label}</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">{s.description}</p>
                  <div className="space-y-1.5">
                    {s.key_enablers.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 shrink-0">Enablers</span>
                        {s.key_enablers.map((e, j) => <Tag key={j} label={e} color="purple" />)}
                      </div>
                    )}
                    {s.key_players.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 shrink-0">Players</span>
                        {s.key_players.map((p, j) => <Tag key={j} label={p} color="gray" />)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ShowMore>
      )}

      <SourcesList sources={sources} />
    </div>
  );
});

// ── V2 Tab: 밸류체인 ──────────────────────────────────────────────────────────

const ValueChainV2Tab = memo(function ValueChainV2Tab({ vc, sources }: { vc: ValueChainV2; sources: Source[] | undefined }) {
  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={vc.key_bullets} />

      {/* 업스트림→다운스트림 세로 레이아웃 */}
      <SectionCard title="밸류체인 레이어" dotColor="bg-indigo-400">
        <div className="flex flex-col items-stretch gap-0">
          {vc.layers.map((layer, i) => {
            const pp = layer.pricing_power ? (PRICING_POWER_CFG[layer.pricing_power] ?? PRICING_POWER_CFG.medium) : null;
            const cardCls = layer.is_subject
              ? 'border-blue-400 bg-blue-50 shadow-sm'
              : layer.buyer
              ? 'border-green-200 bg-green-50'
              : 'border-gray-200 bg-white';
            return (
              <div key={i} className="flex flex-col items-center">
                {/* 레이어 카드 */}
                <div className={`w-full rounded-xl border-2 px-4 py-3 ${cardCls}`}>
                  {/* 헤더 행 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${layer.is_subject ? 'text-blue-700' : layer.buyer ? 'text-green-700' : 'text-gray-800'}`}>
                        {layer.name}
                      </span>
                      {layer.is_subject && (
                        <span className="text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 font-medium">분석 대상</span>
                      )}
                      {layer.bottleneck && (
                        <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5 font-medium">Bottleneck</span>
                      )}
                    </div>
                    {layer.buyer
                      ? <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5 font-medium">구매자</span>
                      : pp && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pp.cls}`}>{pp.label}</span>
                    }
                  </div>
                  {/* 설명 + 선도기업 */}
                  <p className="text-xs text-gray-500 leading-relaxed mb-2">{layer.description}</p>
                  {layer.global_leaders.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {layer.global_leaders.map((leader, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">
                          {flagOf(leader.country)}{leader.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* 레이어 간 화살표 */}
                {i < vc.layers.length - 1 && (
                  <div className="flex flex-col items-center my-1 text-gray-300 select-none">
                    <span className="text-xl leading-none">↓</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Below fold: 가격 전가 메커니즘 + 분석 기업 포지션 */}
      <ShowMore label="포지션 상세 보기">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vc.value_flow && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 mb-2">가격 전가 메커니즘</div>
              <p className="text-sm text-gray-700 leading-relaxed">{vc.value_flow}</p>
            </div>
          )}
          {vc.subject_position && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 mb-2">분석 기업 포지션</div>
              <p className="text-sm text-gray-700 leading-relaxed">{vc.subject_position}</p>
            </div>
          )}
        </div>
      </ShowMore>

      <SourcesList sources={sources} />
    </div>
  );
});

// ── Legacy Tab: 밸류체인 ──────────────────────────────────────────────────────

function ValueChainTab({ data }: { data: AnalysisDetail }) {
  const players = data.valuechainPlayers ?? [];
  const companyName = data.companyName?.toLowerCase() ?? '';

  const upstreamRoles: string[] = [];
  const downstreamRoles: string[] = [];
  for (const p of players) {
    const roleLow = (p.role + p.description).toLowerCase();
    const isTarget = p.player_name?.toLowerCase().includes(companyName) ||
      p.description?.toLowerCase().includes('분석 대상') ||
      p.description?.toLowerCase().includes('해당 기업');
    if (!isTarget) {
      if (/원재료|공급|supplier|upstream|광산|채굴|소재|화학/.test(roleLow)) {
        if (!upstreamRoles.includes(p.role)) upstreamRoles.push(p.role);
      } else if (/유통|downstream|최종|소비|고객|판매|리테일/.test(roleLow)) {
        if (!downstreamRoles.includes(p.role)) downstreamRoles.push(p.role);
      }
    }
  }

  const flowNodes = [
    ...(upstreamRoles.length > 0
      ? upstreamRoles.slice(0, 2).map(r => ({ label: r, isTarget: false }))
      : players.length > 0 ? [{ label: 'Upstream', isTarget: false }] : []),
    { label: data.companyName, isTarget: true },
    ...(downstreamRoles.length > 0
      ? downstreamRoles.slice(0, 2).map(r => ({ label: r, isTarget: false }))
      : players.length > 0 ? [{ label: 'Downstream', isTarget: false }] : []),
  ];

  return (
    <div className="space-y-4">
      {data.value_chain_overview && (
        <SectionCard title="밸류체인 개요" dotColor="bg-indigo-400">
          <p className="text-sm text-gray-700 leading-relaxed">{data.value_chain_overview}</p>
        </SectionCard>
      )}
      {players.length > 0 && (
        <SectionCard title="주요 플레이어" dotColor="bg-indigo-400">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {flowNodes.flatMap((node, i) => [
              <div key={`node-${i}`} className={`rounded-lg px-3 py-2 text-xs text-center flex-1 min-w-[80px] ${
                node.isTarget ? 'bg-blue-50 border-2 border-blue-300 text-blue-800 font-medium' : 'bg-gray-50 text-gray-700'
              }`}>{node.label}</div>,
              i < flowNodes.length - 1 ? <span key={`arrow-${i}`} className="text-gray-300 text-sm shrink-0">→</span> : null,
            ])}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p, i) => {
              const isTarget = p.player_name?.toLowerCase().includes(companyName) ||
                p.description?.toLowerCase().includes('분석 대상');
              return (
                <div key={i} className={`rounded-xl border p-4 ${isTarget ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'}`}>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${isTarget ? 'text-blue-500' : 'text-gray-400'}`}>{p.role}</span>
                    {isTarget && <span className="shrink-0 text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 font-semibold">분석 대상</span>}
                  </div>
                  <div className="font-semibold text-gray-900 text-sm mb-1.5">{p.player_name}</div>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
      <SourcesList sources={data.sources?.value_chain} />
    </div>
  );
}

// ── V2 Tab: 비즈니스모델 ──────────────────────────────────────────────────────

const BusinessModelV2Tab = memo(function BusinessModelV2Tab({ bm, sources }: { bm: BusinessModelV2; sources: Source[] | undefined }) {
  const gm = GROWTH_MOTION_CFG[bm.growth_motion] ?? GROWTH_MOTION_CFG.hybrid;
  const ue = bm.unit_economics ?? { gross_margin: 0, operating_margin: 0, net_margin: 0, fcf_margin: 0, nrr: 0 };
  const revenueStreams = bm.revenue_streams ?? [];
  const segments = bm.segments ?? [];
  const moat = bm.moat ?? [];
  const ueMetrics = [
    { label: 'Gross Margin', value: `${ue.gross_margin}%` },
    { label: 'Operating Margin', value: `${ue.operating_margin}%` },
    { label: 'Net Margin', value: `${ue.net_margin}%` },
    { label: 'FCF Margin', value: `${ue.fcf_margin}%` },
    ...(ue.nrr ? [{ label: 'NRR', value: `${ue.nrr}%` }] : []),
  ].filter(m => m.value !== '0%' && !isPlaceholder(m.value));

  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={bm.key_bullets} />

      {/* Revenue Streams 전체 항상 표시 */}
      {revenueStreams.length > 0 && (
        <SectionCard title="Revenue Streams" dotColor="bg-green-400">
          <div className="space-y-3">
            {revenueStreams.map((rs, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700">{rs.name}</span>
                    <Tag label={rs.type} color="gray" />
                  </div>
                  <span className="text-xs font-medium text-gray-800">{rs.revenue_share}%</span>
                </div>
                <ProgressBar value={rs.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                {(rs.operating_margin !== 0 || rs.growth_rate !== 0) && (
                  <div className="flex gap-3 mt-1">
                    {rs.operating_margin !== 0 && (
                      <span className="text-[10px] text-gray-400">OPM {rs.operating_margin}%</span>
                    )}
                    {rs.growth_rate !== 0 && (
                      <span className={`text-[10px] ${rs.growth_rate > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {rs.growth_rate > 0 ? '+' : ''}{rs.growth_rate}% YoY
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Above fold: growth motion — 상세 서술 없으면 카드 자체 미노출 */}
      {bm.growth_motion_detail && (
        <SectionCard title="Growth Motion" dotColor="bg-blue-400">
          <div className="mb-3">
            <span className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full ${gm.cls}`}>
              {gm.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{bm.growth_motion_detail}</p>
        </SectionCard>
      )}

      {/* Below fold: unit economics + segments + moat */}
      <ShowMore label="Unit Economics · 세그먼트 · 경제적 해자 보기">
        <>
          <SectionCard title="Unit Economics" dotColor="bg-blue-400">
            {ueMetrics.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {ueMetrics.map((m, i) => (
                  <MetricCard key={i} label={m.label} value={m.value} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">데이터 없음</p>
            )}
          </SectionCard>

          {segments.length > 0 && (
            <SectionCard title="사업 세그먼트" dotColor="bg-indigo-400">
              <div className="space-y-2.5">
                {segments.map((seg, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700">{seg.name}</span>
                      <span className="font-medium text-gray-800">{seg.revenue_share}%</span>
                    </div>
                    <ProgressBar value={seg.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                    <p className="text-[11px] text-gray-400 mt-0.5">{seg.characteristics}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {moat.length > 0 && (
            <SectionCard title="경제적 해자 (Moat)" dotColor="bg-gray-400">
              <div className="space-y-3">
                {moat.map((m, i) => {
                  const cfg = MOAT_STRENGTH_CFG[m.strength] ?? MOAT_STRENGTH_CFG.medium;
                  return (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-gray-800">{m.type}</span>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                        <div className={`${cfg.width} ${cfg.barColor} h-1.5 rounded-full`} />
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{m.description}</p>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}
        </>
      </ShowMore>

      <SourcesList sources={sources} />
    </div>
  );
});

// ── Legacy Tab: 비즈니스 모델 ─────────────────────────────────────────────────

function MoatBar({ strength }: { strength: string }) {
  const map: Record<string, { width: string; barColor: string }> = {
    '강함': { width: 'w-[90%]', barColor: 'bg-blue-400' },
    '보통': { width: 'w-[60%]', barColor: 'bg-amber-400' },
    '약함': { width: 'w-[30%]', barColor: 'bg-red-400' },
  };
  const cfg = map[strength] ?? map['보통'];
  return (
    <div className="h-1.5 bg-gray-100 rounded-full w-full mt-1">
      <div className={`${cfg.width} ${cfg.barColor} h-1.5 rounded-full transition-all`} />
    </div>
  );
}

function BusinessModelTab({ data }: { data: AnalysisDetail }) {
  const moat = data.moat_analysis as MoatAnalysis | null;
  const risk = data.risk_analysis as RiskAnalysis | null;
  const ls = splitLines(data.business_model);

  const ueData = data.financials_structured?.unit_economics;
  const ueMetrics = ueData ? [
    { label: 'Gross Margin',     value: ueData.gross_margin },
    { label: 'Operating Margin', value: ueData.operating_margin },
    { label: 'Net Margin',       value: ueData.net_margin },
    { label: 'FCF Margin',       value: ueData.fcf_margin },
    ...(ueData.nrr ? [{ label: 'NRR', value: ueData.nrr }] : []),
  ].filter((m): m is { label: string; value: string } => !!m.value && m.value !== '공개 없음') : [];

  const moatBadge: Record<string, string> = {
    '강함': 'bg-green-50 text-green-700',
    '보통': 'bg-amber-50 text-amber-700',
    '약함': 'bg-red-50 text-red-700',
  };
  const severityStyle: Record<string, { bg: string; text: string }> = {
    '높음': { bg: 'bg-red-50',     text: 'text-red-700' },
    '중간': { bg: 'bg-amber-50',   text: 'text-amber-700' },
    '낮음': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  };
  const riskGroups = risk ? ([
    { label: '비즈니스', data: risk.business },
    { label: '재무',     data: risk.financial },
    { label: '외부',     data: risk.external },
  ] as const).filter(g => (g.data?.items?.length ?? 0) > 0) : [];

  return (
    <div className="space-y-4">
      <SectionCard title="비즈니스 모델" dotColor="bg-green-400">
        <div className="space-y-2">
          {ls.map((l, i) => <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>)}
        </div>
      </SectionCard>

      {ueMetrics.length > 0 && (
        <SectionCard title="Unit Economics" dotColor="bg-blue-400">
          <div className="grid grid-cols-2 gap-2">
            {ueMetrics.map((m, i) => <MetricCard key={i} label={m.label} value={m.value} />)}
          </div>
        </SectionCard>
      )}

      {moat && (moat.types?.length > 0 || moat.sustain_conditions || moat.collapse_scenarios) && (
        <SectionCard title="해자 분석 (Economic Moat)" dotColor="bg-gray-500">
          <div className="space-y-4">
            {moat.types?.length > 0 && (
              <div className="space-y-3">
                {moat.types.map((t, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${moatBadge[t.strength] ?? 'bg-gray-100 text-gray-600'}`}>{t.strength}</span>
                    </div>
                    <MoatBar strength={t.strength} />
                    <p className="text-xs text-gray-600 leading-relaxed mt-2">{t.basis}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {moat.sustain_conditions && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">유지 조건</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{moat.sustain_conditions}</p>
                </div>
              )}
              {moat.collapse_scenarios && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-1.5">붕괴 시나리오</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{moat.collapse_scenarios}</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {riskGroups.length > 0 && (
        <SectionCard title="리스크 분석" dotColor="bg-red-400">
          <div className="space-y-4">
            {riskGroups.map(({ label, data: g }) => {
              const sev = severityStyle[g.severity] ?? severityStyle['중간'];
              return (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700">{label} 리스크</span>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${sev.bg} ${sev.text}`}>{g.severity}</span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {g.items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="py-2 pr-3 w-20 shrink-0"><Tag label={item.category} color="gray" /></td>
                          <td className="py-2 text-gray-700 leading-relaxed">{item.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SourcesList sources={data.sources?.business_model} />
    </div>
  );
}

// ── V2 Tab: 경쟁사 ────────────────────────────────────────────────────────────

const CompetitorsV2Tab = memo(function CompetitorsV2Tab({ c, sources, dataSource }: { c: CompetitorsV2; sources: Source[] | undefined; dataSource?: DataSource }) {
  const pos = COMPETITIVE_POSITION_CFG[c.competitive_position] ?? COMPETITIVE_POSITION_CFG.niche;
  const topDirect = c.direct.slice(0, 3);
  const restDirect = c.direct.slice(3);
  const hasMore = restDirect.length > 0 || c.indirect.length > 0 || c.substitutes.length > 0;
  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={c.key_bullets} />
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-400">경쟁 포지션</span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${pos.cls}`}>{pos.label}</span>
      </div>

      {/* Above fold: top 3 direct competitors */}
      {topDirect.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-orange-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topDirect.map((comp, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{comp.name}</span>
                  <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{flagOf(comp.country)} {comp.country}</span>
                </div>
                {comp.market_share && (
                  <div className="text-blue-600 font-medium text-xs">{comp.market_share}</div>
                )}
                {comp.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {comp.strengths.slice(0, 3).map((s, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                        <span className="text-[11px] text-gray-600">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {comp.weaknesses.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {comp.weaknesses.slice(0, 2).map((w, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                        <span className="text-[11px] text-gray-600">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
                {comp.vs_subject && (
                  <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                    <p className="text-[11px] text-blue-700 leading-relaxed">{comp.vs_subject}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dataSource === 'edgar' && c.revenue_ranking && (
        <SectionCard title="매출 순위" dotColor="bg-blue-400">
          <p className="text-[11px] text-gray-400 mb-2">
            <CitedText text={`SIC ${c.revenue_ranking.sicCode} 동종업계, EDGAR ${c.revenue_ranking.totalCompanies}개사 중 매출 상위 ${c.revenue_ranking.top.length}개사${c.revenue_ranking.sourceIndex ? ` [${c.revenue_ranking.sourceIndex}]` : ''}`} />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5 pr-2">순위</th>
                  <th className="text-left font-medium py-1.5 pr-2">기업명</th>
                  <th className="text-right font-medium py-1.5">매출</th>
                </tr>
              </thead>
              <tbody>
                {c.revenue_ranking.top.map((row) => (
                  <tr key={row.ticker} className={row.isSubject ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700'}>
                    <td className="py-1.5 pr-2">{row.rank}</td>
                    <td className="py-1.5 pr-2">{row.name} <span className="text-gray-400 font-normal">({row.ticker})</span></td>
                    <td className="py-1.5 text-right">{fmtGrowthRevenue(row.revenue, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.revenue_ranking.subjectRank != null && (
            <p className="text-[11px] text-gray-500 mt-2">
              조회 대상 기업 순위: {c.revenue_ranking.subjectRank}위 / 총 {c.revenue_ranking.totalCompanies}개사
            </p>
          )}
        </SectionCard>
      )}

      {/* Below fold: remaining direct + indirect + substitutes */}
      {hasMore && (
        <ShowMore label="경쟁사 전체 보기">
          <>
            {restDirect.length > 0 && (
              <SectionCard title="직접 경쟁사 (추가)" dotColor="bg-orange-400">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {restDirect.map((comp, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{comp.name}</span>
                        <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{flagOf(comp.country)} {comp.country}</span>
                      </div>
                      {comp.market_share && <div className="text-blue-600 font-medium text-xs">{comp.market_share}</div>}
                      {comp.vs_subject && (
                        <div className="bg-blue-50 rounded-lg px-3 py-1.5">
                          <p className="text-[11px] text-blue-700 leading-relaxed">{comp.vs_subject}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            {(c.indirect.length > 0 || c.substitutes.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {c.indirect.length > 0 && (
                  <SectionCard title="간접 경쟁사" dotColor="bg-orange-300">
                    <div className="flex flex-wrap gap-2">
                      {c.indirect.map((comp, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="text-xs font-medium text-gray-700 mb-0.5">{comp.name}</div>
                          <div className="text-[11px] text-gray-400">{comp.threat}</div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
                {c.substitutes.length > 0 && (
                  <SectionCard title="대체재" dotColor="bg-amber-400">
                    <div className="flex flex-wrap gap-2">
                      {c.substitutes.map((sub, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="text-xs font-medium text-gray-700 mb-0.5">{sub.name}</div>
                          <div className="text-[11px] text-gray-400">{sub.threat}</div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
              </div>
            )}
          </>
        </ShowMore>
      )}

      <SourcesList sources={sources} />
    </div>
  );
});

// ── Legacy Tab: 경쟁사 ────────────────────────────────────────────────────────

function CompetitorCard({ comp }: { comp: DirectCompetitor }) {
  const [expanded, setExpanded] = useState(false);
  const diff = comp.differentiation ?? '';
  const showToggle = diff.length > 100;
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-900 text-sm">{comp.name}</span>
        {comp.country && <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{flagOf(comp.country)} {comp.country}</span>}
      </div>
      {comp.market_share && <div className="text-blue-600 font-medium text-sm">{comp.market_share}</div>}
      {(comp.strengths?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {comp.strengths.slice(0, 3).map((s, j) => <Tag key={j} label={s} color="green" />)}
        </div>
      )}
      {diff && (
        <>
          <p className={`text-xs text-gray-500 leading-relaxed ${!expanded && showToggle ? 'line-clamp-2' : ''}`}>{diff}</p>
          {showToggle && (
            <button onClick={() => setExpanded(v => !v)} className="text-[11px] text-blue-500 hover:text-blue-700 self-start">
              {expanded ? '접기' : '더보기'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function CompetitorsTab({ data }: { data: AnalysisDetail }) {
  const c = data.competitors as CompetitorsAnalysis | null;
  const direct = c?.direct ?? [];
  const indirect = c?.indirect ?? [];
  if (direct.length === 0 && indirect.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">경쟁사 데이터가 없습니다.</p>;
  }
  return (
    <div className="space-y-4">
      {direct.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-orange-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {direct.map((comp, i) => <CompetitorCard key={i} comp={comp} />)}
          </div>
        </SectionCard>
      )}
      {indirect.length > 0 && (
        <SectionCard title="간접 경쟁사 / 대체재" dotColor="bg-orange-400">
          <div className="flex flex-wrap gap-2">
            {indirect.map((comp, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-xs">
                {comp.name}{comp.type ? ` · ${comp.type}` : ''}
              </span>
            ))}
          </div>
        </SectionCard>
      )}
      <SourcesList sources={data.sources?.competitors} />
    </div>
  );
}

// ── V2 Tab: 크로스인더스트리 넛지 (pain 진단 그룹) ────────────────────────────────

const CrossIndustryNudgeV1Tab = memo(function CrossIndustryNudgeV1Tab(
  { n, sources }: { n: CrossIndustryNudgeV1; sources: Source[] | undefined },
) {
  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={n.key_bullets} />

      <SectionCard title="업종 공통 Pain" dotColor="bg-amber-400">
        <div className="text-sm font-semibold text-gray-800 mb-1.5">{n.industry_pain.title}</div>
        <CitedText text={n.industry_pain.description} className="text-sm text-gray-600 leading-relaxed block mb-2" />
        {n.industry_pain.financial_impact_question && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 leading-relaxed">
            {n.industry_pain.financial_impact_question}
          </div>
        )}
      </SectionCard>

      <SectionCard title="타산업 해결 사례" dotColor="bg-blue-400">
        <div className="flex items-center gap-2 mb-1.5">
          <Tag label={n.cross_industry_example.source_industry} color="blue" />
          <span className="text-sm font-semibold text-gray-800">{n.cross_industry_example.case_name}</span>
        </div>
        <CitedText text={n.cross_industry_example.solution_description} className="text-sm text-gray-600 leading-relaxed block" />
      </SectionCard>

      <SourcesList sources={sources} />
    </div>
  );
});

// ── V2 Tab: 전략 ──────────────────────────────────────────────────────────────

const StrategyV2Tab = memo(function StrategyV2Tab({ s, sources }: { s: StrategyV2; sources: Source[] | undefined }) {
  const sections = [
    {
      label: '기업 전략',
      sub: 'Corporate',
      dotColor: 'bg-violet-400',
      direction: s.corporate.direction,
      bullets: [
        s.corporate.portfolio          && `포트폴리오 — ${s.corporate.portfolio}`,
        s.corporate.ma_partnerships?.length && `M&A/파트너십 — ${s.corporate.ma_partnerships.join(' · ')}`,
        s.corporate.geographic         && `지역 확장 — ${s.corporate.geographic}`,
      ].filter(Boolean) as string[],
    },
    {
      label: '사업 전략',
      sub: 'Business',
      dotColor: 'bg-blue-400',
      direction: s.business.direction,
      bullets: [
        s.business.competitive_advantage && `경쟁 우위 — ${s.business.competitive_advantage}`,
        s.business.go_to_market          && `GTM — ${s.business.go_to_market}`,
        s.business.product_roadmap?.length && `로드맵 — ${s.business.product_roadmap.join(' / ')}`,
      ].filter(Boolean) as string[],
    },
    {
      label: '재무 전략',
      sub: 'Financial',
      dotColor: 'bg-emerald-400',
      direction: s.financial.direction,
      bullets: [
        s.financial.capital_allocation   && `자본 배분 — ${s.financial.capital_allocation}`,
        s.financial.investment_priority   && `투자 우선순위 — ${s.financial.investment_priority}`,
        s.financial.return_target         && `목표 수익성 — ${s.financial.return_target}`,
      ].filter(Boolean) as string[],
    },
  ];

  return (
    <div className="space-y-1">
      <KeyBulletsBlock bullets={s.key_bullets} />

      <div className="flex flex-col items-stretch">
        {sections.map((sec, i) => (
          <div key={sec.label} className="flex flex-col items-center">
            <div className="w-full bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${sec.dotColor}`} />
                {sec.label}
                <span className="text-gray-300 font-normal normal-case tracking-normal">({sec.sub})</span>
              </div>
              {sec.direction && (
                <p className="text-sm font-semibold text-gray-800 leading-snug mb-3 pl-3.5">{sec.direction}</p>
              )}
              {sec.bullets.length > 0 && (
                <div className="space-y-1.5 pl-3.5">
                  {sec.bullets.map((b, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span className="mt-[5px] w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      <p className="text-xs text-gray-600 leading-relaxed">{b}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {i < sections.length - 1 && (
              <div className="flex flex-col items-center py-0.5 select-none">
                <div className="w-px h-3 bg-gray-200" />
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-30">
                  <path d="M5 6L0 0h10L5 6z" fill="#6b7280" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {(s.strategy_coherence || s.ten_year_durability) && (
        <ShowMore label="전략 수렴 · 지속가능성 보기">
          <div className="space-y-3 pb-1">
            {s.strategy_coherence && (
              <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-2">전략 수렴</div>
                <p className="text-sm text-gray-700 leading-relaxed">{s.strategy_coherence}</p>
              </div>
            )}
            {s.ten_year_durability && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-2">10년 지속 가능성</div>
                <p className="text-sm text-gray-700 leading-relaxed">{s.ten_year_durability}</p>
              </div>
            )}
          </div>
        </ShowMore>
      )}

      <div className="pt-2">
        <SourcesList sources={sources} />
      </div>
    </div>
  );
});

// ── Legacy Tab: 전략 ──────────────────────────────────────────────────────────

function HighlightNumbers({ text }: { text: string }) {
  const parts = text.split(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|T|%|배|원|x)+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /\d/.test(p)
          ? <span key={i} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-medium mx-0.5">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function StrategyTab({ data }: { data: AnalysisDetail }) {
  const s = data.strategy as StrategyAnalysis | null;
  if (!s || (!s.corporate && !s.business && !s.financial)) {
    return <p className="text-sm text-gray-500 py-4 text-center">전략 데이터가 없습니다.</p>;
  }

  const sections = [
    {
      label: '기업 전략', dotColor: 'bg-violet-400',
      headline: s.corporate?.portfolio_direction,
      items: s.corporate ? [
        { label: 'M&A / 파트너십', value: s.corporate.ma_partnership },
        { label: '지역 확장', value: s.corporate.regional_expansion },
        ...(s.corporate.notes ? [{ label: '비고', value: s.corporate.notes }] : []),
      ] : [],
    },
    {
      label: '사업 전략', dotColor: 'bg-blue-400',
      headline: s.business?.competitive_advantage,
      items: s.business ? [
        { label: '고객 / 채널', value: s.business.customer_channel },
        { label: '제품 로드맵', value: s.business.product_roadmap },
        ...(s.business.notes ? [{ label: '비고', value: s.business.notes }] : []),
      ] : [],
    },
    {
      label: '재무 전략', dotColor: 'bg-emerald-400',
      headline: s.financial?.investment_priority,
      items: s.financial ? [
        { label: '자본 조달', value: s.financial.capital_raising },
        { label: '배당 / 자사주', value: s.financial.dividend_buyback },
        { label: '목표 수익성', value: s.financial.profitability_target },
        ...(s.financial.notes ? [{ label: '비고', value: s.financial.notes }] : []),
      ] : [],
    },
  ];

  const filledSections = sections.filter(sec => sec.headline || sec.items.some(it => it.value));

  return (
    <div>
      {filledSections.map((sec, si) => {
        const filledItems = sec.items.filter(it => it.value);
        const headlineTrunc = sec.headline
          ? sec.headline.length > 80 ? sec.headline.slice(0, 80) + '…' : sec.headline
          : null;
        return (
          <div key={sec.label}>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${sec.dotColor}`} />
                {sec.label}
              </div>
              {headlineTrunc && (
                <p className="text-sm font-medium text-gray-800 leading-snug mb-3 pl-3.5">
                  <HighlightNumbers text={headlineTrunc} />
                </p>
              )}
              {filledItems.length > 0 && (
                <div>
                  {filledItems.map((item, i) => (
                    <div key={i} className={`flex gap-3 items-start py-2.5 ${i < filledItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <span className="shrink-0 w-24 text-[11px] text-gray-400 pt-0.5 leading-tight">{item.label}</span>
                      <p className="text-sm text-gray-700 leading-relaxed flex-1">
                        <HighlightNumbers text={item.value!} />
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {si < filledSections.length - 1 && (
              <div className="flex justify-center py-2">
                <div className="flex flex-col items-center gap-0.5">
                  <div className="w-px h-3 bg-gray-200" />
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-40">
                    <path d="M5 6L0 0h10L5 6z" fill="#6b7280" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="mt-3"><SourcesList sources={data.sources?.strategy} /></div>
    </div>
  );
}

// ── Scrollable grid table (replaces heavyweight virtualization for short tables) ─

const V_ROW_H = 36;

function VirtualTable({
  rows,
  colTemplate,
  minWidth,
  header,
  renderRow,
  maxVisible = 8,
}: {
  rows: FinancialsV2Row[];
  colTemplate: string;
  minWidth: number;
  header: React.ReactNode;
  renderRow: (row: FinancialsV2Row, index: number) => React.ReactNode;
  maxVisible?: number;
}) {
  const maxH = maxVisible * V_ROW_H;
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: colTemplate };
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>
        <div style={gridStyle} className="border-b border-gray-100 pb-2 sticky top-0 bg-white z-10">
          {header}
        </div>
        <div style={{ maxHeight: maxH, overflowY: rows.length > maxVisible ? 'auto' : 'visible' }}>
          {rows.map((row, index) => (
            <div
              key={index}
              style={{ ...gridStyle, height: V_ROW_H }}
              className="items-center border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
            >
              {renderRow(row, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── V2 Tab: 재무 ──────────────────────────────────────────────────────────────

const IS_COLS_V2: Array<keyof Omit<FinancialsV2Row, 'item' | 'yoy'>> =
  ['fy2021', 'fy2022', 'fy2023', 'fy2024', 'fy2025'];

// 2026-08 프롬프트 영어 단일화 이후 신규 분석은 영어 item 라벨, 기존 캐시는 한국어 라벨을
// 그대로 유지하므로 둘 다 매칭한다.
const IS_BOLD_ITEMS = ['매출', '영업이익', '순이익', 'Revenue', 'Operating Income', 'Net Income'];

// YoY 값 정규화 — ▲/▼로 시작하지 않는 값(확인 필요%, 확인 필요% YoY 등)은 em dash로 표시
function normalizeYoy(v: string | undefined): string {
  if (!v || v === '—') return '—';
  if (v.startsWith('▲') || v.startsWith('▼')) return v;
  return '—';
}

// SEC 산업 벤치마크 막대비교 — 회사 자신의 수치 vs 업종 중앙값(SIC 전체 SEC 제출 기업
// 기반, server/src/lib/secIndustryBenchmark.ts가 서버에서 계산). 숫자를 문장으로 반복하지
// 않고 막대 두 개 + 해석 한 줄로만 보여준다(콘텐츠 포맷 원칙 — KPI/서사 숫자 중복 방지).
function SecBenchmarkBar({ label, value, unit, colorClass, maxAbs }: { label: string; value: number; unit: string; colorClass: string; maxAbs: number }) {
  const decimals = unit === 'x' ? 2 : 1;
  const widthPct = maxAbs > 0 ? Math.min(100, (Math.abs(value) / maxAbs) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-16 text-right shrink-0">{value.toFixed(decimals)}{unit}</span>
    </div>
  );
}

function SecBenchmarkComparisonBlock({ comparison }: { comparison: SecBenchmarkComparison }) {
  if (comparison.status === 'insufficient_sample') {
    return (
      <SectionCard title="동종업계 비교 (SEC)" dotColor="bg-indigo-400">
        <p className="text-xs text-gray-500 leading-relaxed">
          이 업종(SIC {comparison.sicCode})은 공개 동종업계 비교 표본이 적어(최대 {comparison.maxN ?? 0}개사) 벤치마크 비교가 제한적이에요. 재무 상황은 직접 확인하는 게 더 정확할 수 있어요.
        </p>
      </SectionCard>
    );
  }
  if (!comparison.items?.length) return null;
  return (
    <SectionCard title="동종업계 비교 (SEC)" dotColor="bg-indigo-400">
      <div className="space-y-4">
        {comparison.items.map((item, i) => {
          const maxAbs = Math.max(Math.abs(item.companyValue), Math.abs(item.median)) || 1;
          return (
            <div key={i} className={i > 0 ? 'pt-4 border-t border-gray-100' : ''}>
              <div className="text-xs font-semibold text-gray-700 mb-2">{item.label}</div>
              <div className="space-y-1.5">
                <SecBenchmarkBar label="이 회사" value={item.companyValue} unit={item.unit} colorClass="bg-blue-500" maxAbs={maxAbs} />
                <SecBenchmarkBar label={`업종 중앙값(n=${item.n})`} value={item.median} unit={item.unit} colorClass="bg-gray-300" maxAbs={maxAbs} />
              </div>
              {item.interpretation && (
                <p className="text-xs text-gray-500 leading-relaxed mt-2">{item.interpretation}</p>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

const FinancialsV2Tab = memo(function FinancialsV2Tab({ f, sources, onRefresh, isRefreshing, dataSource }: {
  f: FinancialsV2;
  sources: Source[] | undefined;
  onRefresh: () => void;
  isRefreshing: boolean;
  dataSource?: DataSource;
}) {
  const yoyCls = (v?: string) => {
    const n = normalizeYoy(v);
    if (n === '—') return 'text-gray-400';
    return n.startsWith('▲') ? 'text-green-600 font-medium' : 'text-red-500 font-medium';
  };


  const cfDots: Record<string, string> = {
    'Operating CF':  'bg-blue-400',
    'Investing CF':  'bg-amber-400',
    'Financing CF':  'bg-gray-400',
    'FCF':           'bg-green-500',
  };

  // 데이터 신뢰도 요약 — 이 탭에 표시되는 필드들 중 (추정) 배지 / 확인 필요(플레이스홀더) 값 카운트
  const { estimatedCount, unknownCount } = useMemo(() => countFinancialsReliability(f), [f]);

  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={f.key_bullets} />
      {(estimatedCount > 0 || unknownCount > 0) && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          ⚠️ 이 리포트에는 추정값 {estimatedCount}건, 확인 필요 데이터 {unknownCount}건이 포함되어 있습니다
        </p>
      )}
      {/* 데이터 출처 뱃지 + Refresh 버튼 */}
      <div className="flex items-center justify-between">
        {dataSource === 'edgar' ? (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L1.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L1}`} />🟢 SEC EDGAR 공식
          </span>
        ) : dataSource === 'dart' ? (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L1.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L1}`} />🟢 DART 공식
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L3.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L3}`} />⚪ 웹 검색 추정치
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? '새로고침 중...' : '데이터 새로고침'}
        </button>
      </div>

      {/* 업종 벤치마크 — EDGAR 기업 전용, 표본 부족 지표는 서버가 이미 배열에서 제외함 */}
      {dataSource === 'edgar' && f.industry_benchmark && (
        <SectionCard title="업종 벤치마크" dotColor="bg-violet-400">
          <div className="space-y-1.5">
            {f.industry_benchmark.metrics.map((m) => (
              <p key={m.key} className="text-sm text-gray-700 leading-relaxed">
                <CitedText text={m.sentence} />
              </p>
            ))}
          </div>
        </SectionCard>
      )}

      {/* SEC 산업 벤치마크 막대비교 — EDGAR 기업 전용, 표본 부족이거나 편차 없는 지표는
          서버가 이미 걸러서 넘김(sec_benchmark_comparison null이면 아예 렌더링 안 됨) */}
      {dataSource === 'edgar' && f.sec_benchmark_comparison && (
        <SecBenchmarkComparisonBlock comparison={f.sec_benchmark_comparison} />
      )}

      {/* Narrative */}
      {f.narrative && (
        <SectionCard title="재무 서사" dotColor="bg-emerald-400">
          <div className="space-y-1.5">
            {splitLines(f.narrative).map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                <CitedText text={l.replace(BRACKET_SOURCE_RE, '')} />
              </p>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Income statement */}
      {f.income_statement.length > 0 && (
        <SectionCard title="손익계산서 (I/S)" dotColor="bg-blue-400">
          <VirtualTable
            rows={f.income_statement}
            colTemplate={`minmax(100px,1.5fr) repeat(${IS_COLS_V2.length},1fr) 80px`}
            minWidth={520}
            maxVisible={10}
            header={
              <>
                <span className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">항목</span>
                {IS_COLS_V2.map(col => (
                  <span key={col} className={`py-2 px-2 text-right text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${col === 'fy2024' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {col.replace('fy', 'FY')}
                  </span>
                ))}
                <span className="py-2 px-2 text-right text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</span>
              </>
            }
            renderRow={(row: FinancialsV2Row) => {
              const isBold = IS_BOLD_ITEMS.some(b => row.item.includes(b));
              return (
                <>
                  <span className={`py-2.5 pr-3 text-xs truncate ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</span>
                  {IS_COLS_V2.map(col => (
                    <span key={col} className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${isBold && col === 'fy2024' ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                      <FinancialValue text={row[col] ?? '—'} dataSource={dataSource} />
                    </span>
                  ))}
                  <span className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${yoyCls(row.yoy)}`}><DataValue text={normalizeYoy(row.yoy)} /></span>
                </>
              );
            }}
          />
        </SectionCard>
      )}

      {/* Below fold: Balance sheet, Cash flow, Key risks */}
      <ShowMore label="재무상태표 · 현금흐름 보기">
        <>
          {f.balance_sheet.length > 0 && (
            <SectionCard title="재무상태표 (B/S)" dotColor="bg-indigo-400">
              <VirtualTable
                rows={f.balance_sheet}
                colTemplate="minmax(130px,1.5fr) 1fr 1fr 1fr"
                minWidth={380}
                maxVisible={10}
                header={
                  <>
                    <span className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">항목</span>
                    {(['fy2023', 'fy2024', 'fy2025'] as const).map(col => (
                      <span key={col} className={`py-2 px-2 text-right text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${col === 'fy2024' ? 'text-gray-600' : 'text-gray-400'}`}>
                        {col.replace('fy', 'FY')}
                      </span>
                    ))}
                  </>
                }
                renderRow={(row: FinancialsV2Row) => {
                  const isBold = ['총자산', '총부채', '자본총계', 'Total Assets', 'Total Liabilities', 'Total Equity'].includes(row.item);
                  return (
                    <>
                      <span className={`py-2.5 pr-3 text-xs truncate ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</span>
                      <span className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap"><FinancialValue text={row.fy2023 ?? '—'} dataSource={dataSource} /></span>
                      <span className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${isBold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}><FinancialValue text={row.fy2024 ?? '—'} dataSource={dataSource} /></span>
                      <span className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap"><FinancialValue text={row.fy2025 ?? '—'} dataSource={dataSource} /></span>
                    </>
                  );
                }}
              />
            </SectionCard>
          )}

          {(f.cash_flow.operating || f.cash_flow.fcf) && (
            <SectionCard title="현금흐름 (C/F)" dotColor="bg-green-400">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { label: 'Operating CF', value: f.cash_flow.operating },
                  { label: 'Investing CF', value: f.cash_flow.investing },
                  { label: 'Financing CF', value: f.cash_flow.financing },
                  { label: 'FCF',          value: f.cash_flow.fcf },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <CfMetricCard key={label} label={label} value={value || '—'} dotColor={cfDots[label] ?? 'bg-gray-400'} />
                ))}
              </div>
              {f.cash_flow.notes && (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{f.cash_flow.notes}</p>
              )}
            </SectionCard>
          )}

          {f.key_risks.length > 0 && (
            <SectionCard title="핵심 리스크" dotColor="bg-red-400">
              <div className="space-y-1.5">
                {f.key_risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{r}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      </ShowMore>

      <SourcesList sources={sources} />
    </div>
  );
});

// ── Legacy Tab: 재무 ──────────────────────────────────────────────────────────

function FinancialsTab({ data }: { data: AnalysisDetail }) {
  const fs = data.financials_structured as StructuredFinancials | null | undefined;
  const hasStructured = !!(
    fs &&
    ((fs.income_statement?.length ?? 0) > 0 ||
     (fs.balance_sheet?.length ?? 0) > 0 ||
     fs.cash_flow?.operating)
  );

  const rawLines = splitLines(data.financials);
  const IS_COLS = ['FY2023', 'FY2024', 'FY2025'];
  const IS_MEDIUM_ITEMS = ['매출', '매출총이익', '영업이익', '순이익'];
  const BS_SECTION_HEADERS = ['총자산', '총부채', '자본총계'];

  const yoyCls = (v?: string) => {
    if (!v || v === '—') return 'text-gray-400';
    return v.startsWith('▲') ? 'text-green-600 font-medium' : v.startsWith('▼') ? 'text-red-500 font-medium' : 'text-gray-500';
  };

  const cfDots: Record<string, string> = {
    '영업활동 CF': 'bg-blue-400', '투자활동 CF': 'bg-amber-400',
    '재무활동 CF': 'bg-gray-400', 'Free Cash Flow': 'bg-green-500',
  };

  return (
    <div className="space-y-4">
      {data.financials && (
        <SectionCard title="재무 서사" dotColor="bg-emerald-400">
          <div className="space-y-1.5">
            {splitLines(data.financials).map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {hasStructured ? (
        <>
          {(fs!.income_statement?.length ?? 0) > 0 && (
            <SectionCard title="손익계산서 (I/S)" dotColor="bg-blue-400">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[110px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className={`text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${y === 'FY2024' ? 'text-gray-600' : 'text-gray-400'}`}>{y}</th>
                      ))}
                      <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.income_statement.map((row, i) => {
                      const isMedium = IS_MEDIUM_ITEMS.some(b => row.item.includes(b));
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className={`py-2.5 pr-4 text-xs ${isMedium ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${isMedium ? 'font-medium text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${yoyCls(row.yoy)}`}>{normalizeYoy(row.yoy)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
          {(fs!.balance_sheet?.length ?? 0) > 0 && (
            <SectionCard title="재무상태표 (B/S)" dotColor="bg-indigo-400">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[130px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className={`text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${y === 'FY2024' ? 'text-gray-600' : 'text-gray-400'}`}>{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.balance_sheet.map((row, i) => {
                      const isBold = BS_SECTION_HEADERS.includes(row.item);
                      return (
                        <tr key={i} className={`hover:bg-gray-50/50 ${isBold ? 'bg-gray-50' : ''}`}>
                          <td className={`py-2.5 pr-4 text-xs ${isBold ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${isBold ? 'font-medium text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
          {fs!.cash_flow && (
            <SectionCard title="현금흐름 (C/F)" dotColor="bg-green-400">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  { label: '영업활동 CF',    value: fs!.cash_flow.operating },
                  { label: '투자활동 CF',    value: fs!.cash_flow.investing },
                  { label: '재무활동 CF',    value: fs!.cash_flow.financing },
                  { label: 'Free Cash Flow', value: fs!.cash_flow.free_cash_flow },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <CfMetricCard key={label} label={label} value={value || '—'} dotColor={cfDots[label] ?? 'bg-gray-400'} />
                ))}
              </div>
              {fs!.cash_flow.notes && (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{fs!.cash_flow.notes}</p>
              )}
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard title="재무 현황" dotColor="bg-emerald-400">
          <div className="space-y-2">
            {rawLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>
      )}

      <SourcesList sources={data.sources?.financials} />
    </div>
  );
}

// ── V2 Tab: 창업자 ────────────────────────────────────────────────────────────

const RESULT_CFG: Record<string, { label: string; cls: string }> = {
  exit:      { label: 'Exit',    cls: 'bg-green-50 text-green-700' },
  closed:    { label: '폐업',    cls: 'bg-red-50 text-red-600' },
  operating: { label: '운영 중', cls: 'bg-blue-50 text-blue-700' },
};

const EXIT_TYPE_CFG: Record<string, { label: string; cls: string }> = {
  'M&A': { label: 'M&A',  cls: 'bg-purple-50 text-purple-700' },
  'IPO': { label: 'IPO',  cls: 'bg-emerald-50 text-emerald-700' },
};

const FounderV2Tab = memo(function FounderV2Tab({ f }: { f: FounderV2 }) {
  const isSerial = f.founding_history.type === 'serial';
  return (
    <div className="space-y-4">
      {/* Key bullets */}
      <KeyBulletsBlock bullets={f.key_bullets} />

      {/* Founder profiles */}
      {f.founders.length > 0 && (
        <SectionCard title="기본 정보" dotColor="bg-blue-400">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {f.founders.map((fd, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">{fd.name}</span>
                  {fd.title && fd.title !== '-' && (
                    <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-medium">{fd.title}</span>
                  )}
                </div>
                {fd.education && fd.education !== '-' && (
                  <div className="flex gap-2 text-xs text-gray-600">
                    <span className="text-gray-400 shrink-0 w-10">학교</span>
                    <span>{fd.education}</span>
                  </div>
                )}
                {fd.major && fd.major !== '-' && (
                  <div className="flex gap-2 text-xs text-gray-600">
                    <span className="text-gray-400 shrink-0 w-10">전공</span>
                    <span>{fd.major}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Career trajectory */}
      {f.career_trajectory.length > 0 && (
        <SectionCard title="커리어 궤적" dotColor="bg-indigo-400">
          <div>
            {[...f.career_trajectory]
              .sort((a, b) => {
                const yr = (s: string) => parseInt(s.match(/\d{4}/)?.[0] ?? '9999', 10);
                return yr(a.period) - yr(b.period);
              })
              .map((item, i, arr) => {
              const isLast = i === arr.length - 1;
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 border-2 border-indigo-300 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-indigo-800 text-center leading-none px-0.5">{item.period.slice(0, 6)}</span>
                    </div>
                    {!isLast && <div className="w-0.5 bg-gray-100 flex-1 my-1 min-h-[2rem]" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0 pt-1">
                    <div className="text-sm font-semibold text-gray-800">{item.company}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Below fold: founding history + reputation + network */}
      <ShowMore label="창업 이력 · 평판 · 네트워크 보기">
        <>
          <SectionCard title="창업 이력" dotColor="bg-violet-400">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${isSerial ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                {isSerial ? 'Serial Founder' : '1st Time Founder'}
              </span>
            </div>
            {f.founding_history.previous_ventures.length > 0 ? (
              <div className="space-y-2">
                {f.founding_history.previous_ventures.map((v, i) => {
                  const res = RESULT_CFG[v.result] ?? RESULT_CFG.operating;
                  const exitType = v.exit_type ? EXIT_TYPE_CFG[v.exit_type] : null;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-xs font-medium text-gray-800 flex-1">{v.name}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${res.cls}`}>{res.label}</span>
                      {exitType && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${exitType.cls}`}>{exitType.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400">이전 창업 이력 없음</p>
            )}
          </SectionCard>

          {(f.reputation.sns_style !== '-' || f.reputation.media_exposure !== '-' || f.reputation.blind_glassdoor !== '-') && (
            <SectionCard title="평판 & 퍼블릭 시그널" dotColor="bg-amber-400">
              <div className="space-y-2">
                {f.reputation.sns_style !== '-' && (
                  <div className="flex gap-3 items-start py-2 border-b border-gray-50">
                    <span className="shrink-0 w-20 text-[11px] text-gray-400 pt-0.5">SNS 스타일</span>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{f.reputation.sns_style}</p>
                  </div>
                )}
                {f.reputation.media_exposure !== '-' && (
                  <div className="flex gap-3 items-start py-2 border-b border-gray-50">
                    <span className="shrink-0 w-20 text-[11px] text-gray-400 pt-0.5">미디어 노출</span>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{f.reputation.media_exposure}</p>
                  </div>
                )}
                {f.reputation.blind_glassdoor !== '-' && (
                  <div className="flex gap-3 items-start py-2">
                    <span className="shrink-0 w-20 text-[11px] text-gray-400 pt-0.5">Blind / GD</span>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{f.reputation.blind_glassdoor}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {(f.network.investors.length > 0 || f.network.advisors_board.length > 0 || f.network.cofounders.length > 0) && (
            <SectionCard title="네트워크" dotColor="bg-emerald-400">
              <div className="space-y-3">
                {f.network.cofounders.length > 0 && (
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1.5">공동창업팀</div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.network.cofounders.map((c, i) => <Tag key={i} label={c} color="emerald" />)}
                    </div>
                  </div>
                )}
                {f.network.investors.length > 0 && (
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1.5">투자자</div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.network.investors.map((inv, i) => <Tag key={i} label={inv} color="blue" />)}
                    </div>
                  </div>
                )}
                {f.network.advisors_board.length > 0 && (
                  <div>
                    <div className="text-[11px] text-gray-400 mb-1.5">어드바이저 / 보드</div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.network.advisors_board.map((a, i) => <Tag key={i} label={a} color="gray" />)}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          )}
        </>
      </ShowMore>
    </div>
  );
});

// ── ShowMore wrapper ──────────────────────────────────────────────────────────

function ShowMore({ children, label = '더 보기' }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && children}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full py-2 text-xs text-blue-500 hover:text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center justify-center gap-1.5 mt-1"
      >
        {open ? '접기 ↑' : `${label} ↓`}
      </button>
    </>
  );
}

// ── Skeleton components ───────────────────────────────────────────────────────

function Sk({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`skeleton ${w} ${h}`} />;
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <Sk h="h-14" />
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3].map(i => <Sk key={i} h="h-16" />)}
      </div>
      <Sk h="h-24" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Sk h="h-20" />
        <Sk h="h-20" />
      </div>
    </div>
  );
}

function CardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <Sk h="h-14" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => <Sk key={i} h="h-32" />)}
      </div>
      <Sk h="h-20" />
    </div>
  );
}

// 온디맨드 섹션 생성 중 표시 — 배치 스트리밍 스켈레톤(CardsSkeleton 등)과 달리
// "지금 이 요청으로 생성 중"임을 명시적으로 알림 (financials 새로고침과 동일한 패턴).
// 예상 소요시간 안내 — 웹서치 2회 + Claude 생성이 포함돼 실제로 90~106초(3개 기업 실측
// 평균 industry_history 103s/tech_evolution 95s) 걸림. "pain 진단 시작" 버튼(2026-08)은
// 이 두 섹션을 동시에 병렬 생성하므로 서버 타임아웃도 10분으로 넉넉하게 잡아뒀다 — 안내
// 없이 스피너만 있으면 실패한 것처럼 보여 "로딩만 계속 돈다"는 오인으로 이어지기 쉬움.
function SectionGenerating({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
      <RefreshCw size={20} className="animate-spin" />
      <span className="text-sm">{label} 생성 중... (최대 10분 정도 소요될 수 있어요)</span>
    </div>
  );
}

// "pain 진단 시작" CTA — industry_history_v2/tech_evolution_v2는 탭 열람만으론 생성되지
// 않고(2026-08, 기존 탭별 자동생성 방식 대체), 이 버튼 클릭 1번으로 두 섹션이 함께 생성된다.
function PainDiagnosisStart({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Lightbulb size={20} className="text-amber-400" />
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
        산업 역사와 기술 변화를 함께 진단해요.<br />약 7~10분 소요될 수 있어요.
      </p>
      <button
        onClick={onStart}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
      >
        pain 진단 시작
      </button>
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  const tpl = `2fr ${Array(cols - 1).fill('1fr').join(' ')}`;
  return (
    <div className="space-y-4">
      <Sk h="h-14" />
      <div style={{ display: 'grid', gridTemplateColumns: tpl, gap: '8px' }}>
        {Array.from({ length: cols }).map((_, i) => <Sk key={i} h="h-3" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'grid', gridTemplateColumns: tpl, gap: '8px' }}>
          {Array.from({ length: cols }).map((_, i) => <Sk key={i} h="h-4" />)}
        </div>
      ))}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
        {[0,1,2,3].map(i => <Sk key={i} h="h-16" />)}
      </div>
    </div>
  );
}

function FounderSkeleton() {
  return (
    <div className="space-y-4">
      <Sk h="h-14" />
      <div className="grid grid-cols-2 gap-3">
        <Sk h="h-24" />
        <Sk h="h-24" />
      </div>
      {[0,1,2,3].map(i => (
        <div key={i} className="flex gap-4">
          <Sk w="w-10 shrink-0" h="h-10" />
          <div className="flex-1 space-y-1.5 pt-1">
            <Sk w="w-1/2" />
            <Sk w="w-1/3" h="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Growth Scenario (몬테카를로, 프리미엄 전용) ─────────────────────────────────

function fmtGrowthRevenue(v: number, currency: 'KRW' | 'USD'): string {
  const abs = Math.abs(v);
  if (currency === 'KRW') {
    if (abs >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조원`;
    if (abs >= 100_000_000)       return `${(v / 100_000_000).toFixed(0)}억원`;
    return `${Math.round(v).toLocaleString()}원`;
  }
  const b = abs / 1_000_000_000;
  return b >= 1 ? `${(v / 1_000_000_000).toFixed(1)}B USD` : `${(v / 1_000_000).toFixed(0)}M USD`;
}

const SCENARIO_LABEL = { p10: '보수적 시나리오', p50: '예상 시나리오', p90: '낙관적 시나리오' } as const;

function GrowthScenarioV2Tab({ g }: { g: GrowthScenarioV2 }) {
  const years = g.simulation.p50.length;
  const stats = g.stats;
  // 구버전 캐시(growth_scenario_v2에 confidenceLevel 필드가 없던 시절 저장분) 호환 —
  // 필드가 없으면 stats 모양(sampleSize 유무)으로 유추
  const isHigh = g.confidenceLevel ? g.confidenceLevel === 'high' : !('sampleSize' in stats);
  const sampleLabel = 'sampleSize' in stats
    ? `${g.sectorTag ?? '섹터'} 동종업계 벤치마크 ${stats.sampleSize}개사`
    : `자체 공식 재무 시계열 ${stats.dataPoints + 1}개년`;

  const lineData = Array.from({ length: years }, (_, i) => ({
    year: `Year+${i + 1}`,
    p10: g.simulation.p10[i],
    p50: g.simulation.p50[i],
    p90: g.simulation.p90[i],
  }));
  const histData = g.simulation.histogram.map((count, i) => ({ bin: i, count }));

  return (
    <div className="space-y-6">
      {/* 핵심 요약 블록 — 신뢰도 배지 + 해석 문장 */}
      <div className="bg-black text-white rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isHigh ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
            {isHigh ? '🟢 공식' : '🟡 참고'}
          </span>
          <span className="text-[11px] text-gray-400">{sampleLabel} 기반</span>
        </div>
        <p className="text-sm leading-relaxed">
          {g.narrative ?? '몬테카를로 시뮬레이션(1만회) 기반 매출 성장 시나리오입니다.'}
        </p>
      </div>

      {!isHigh && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          이 기업의 공식 재무 데이터가 부족해 동종업계 벤치마크 기반 추정치를 사용했어요. 실제 편차는 더 클 수 있습니다.
        </p>
      )}

      {/* 라인 + 신뢰구간 밴드 차트 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">연도별 매출 시나리오</h4>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={lineData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tickFormatter={(v: number) => fmtGrowthRevenue(v, g.currency)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
              {/* recharts Tooltip은 기본 itemSorter가 'name'이라 항목을 이름 알파벳/가나다순으로
                  정렬한다 — "낙관적"(ㄴ) → "보수적"(ㅂ) → "예상"(ㅇ) 순으로 값 크기와 무관하게
                  뒤죽박죽 표시되던 원인. 값(value) 내림차순으로 명시해 낙관(최댓값) → 예상(중간값)
                  → 보수(최솟값) 순 — 차트에 그려지는 선의 상하 위치와 일치시킨다. */}
              <Tooltip
                formatter={(value) => fmtGrowthRevenue(Number(value), g.currency)}
                itemSorter={(item) => -Number(item.value)}
              />
              <Line type="monotone" dataKey="p90" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: '#93c5fd' }} name={SCENARIO_LABEL.p90} />
              <Line type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#2563eb' }} name={SCENARIO_LABEL.p50} />
              <Line type="monotone" dataKey="p10" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3, fill: '#93c5fd' }} name={SCENARIO_LABEL.p10} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />{SCENARIO_LABEL.p50}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-200 inline-block" />{SCENARIO_LABEL.p10} ~ {SCENARIO_LABEL.p90} 범위</span>
        </div>
      </div>

      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 text-xs border-b border-gray-200">
              <th className="text-left py-2">연차</th>
              <th className="text-right py-2">{SCENARIO_LABEL.p10}</th>
              <th className="text-right py-2">{SCENARIO_LABEL.p50}</th>
              <th className="text-right py-2">{SCENARIO_LABEL.p90}</th>
            </tr>
          </thead>
          <tbody>
            {lineData.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 text-gray-600">{row.year}</td>
                <td className="py-2 text-right text-gray-500">{fmtGrowthRevenue(g.simulation.p10[i], g.currency)}</td>
                <td className="py-2 text-right font-medium text-gray-900">{fmtGrowthRevenue(g.simulation.p50[i], g.currency)}</td>
                <td className="py-2 text-right text-gray-500">{fmtGrowthRevenue(g.simulation.p90[i], g.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">최종 연도 매출 분포</h4>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="count" fill="#93c5fd" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        {isHigh ? '🟢 공식' : '🟡 참고'} — {sampleLabel} 기반 통계적 시뮬레이션이며, 실제 미래 실적을 보장하지 않습니다.
      </p>
    </div>
  );
}

function GrowthScenarioLocked() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Lock size={28} className="text-gray-300" />
      <p className="text-sm text-gray-500">성장 시나리오는 프리미엄 전용 기능이에요</p>
      <button
        type="button"
        className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
      >
        프리미엄으로 업그레이드
      </button>
    </div>
  );
}

// ── Markdown export (복사 기능) ─────────────────────────────────────────────────

function mdJoin(parts: (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => !!p).join('\n\n');
}

function mdList(items: (string | false | null | undefined)[]): string {
  return items.filter((i): i is string => !!i).map(i => `- ${i}`).join('\n');
}

function mdSourcesBlock(sources: Source[] | undefined): string {
  if (!sources?.length) return '';
  const lines = sources.map((s, i) => {
    const idx = s.index ?? i + 1;
    return `[${idx}] ${s.organization}${s.date ? ` — ${s.date}` : ''}: ${s.content}${s.isEstimate ? ' (추정)' : ''}`;
  });
  return `**출처**\n${lines.join('\n')}`;
}

function summaryToMd(s: SummaryV2, sources: Source[] | undefined): string {
  const cc = s.customer_concentration;
  const body = mdJoin([
    s.oneLiner,
    s.key_bullets?.length ? `**핵심 요약**\n${mdList(s.key_bullets)}` : '',
    s.key_metrics.length ? `**핵심 지표**\n${mdList(s.key_metrics.map(m => `${m.label}: ${m.value}`))}` : '',
    s.products.length ? `**주요 제품/서비스**\n${mdList(s.products.map(p => `${p.name} — ${p.revenue_share}%`))}` : '',
    s.key_markets.length ? `**주요 시장**\n${mdList(s.key_markets.map(m => `${m.country} — ${m.revenue_share}%`))}` : '',
    s.top_customers.length ? `**주요 고객사**: ${s.top_customers.join(', ')}` : '',
    cc && cc.top_n_share > 0 ? `상위 ${cc.top_n}개 고객이 매출 ${cc.top_n_share}% 차지${cc.trend === 'diversifying' ? ' (다변화 진행 중)' : cc.trend === 'concentrating' ? ' (집중도 심화)' : ''}` : '',
    s.bull_case ? `**성장 모멘텀**: ${s.bull_case}` : '',
    s.bear_case ? `**핵심 리스크**: ${s.bear_case}` : '',
    s.trigger_events?.length ? `**최근 트리거 이벤트**\n${mdList(s.trigger_events.map(ev =>
      `${ev.date} [${ev.type}]${ev.amount ? ` ${ev.amount}` : ''}${ev.counterparty ? ` · ${ev.counterparty}` : ''} — ${ev.description}`
    ))}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 요약\n\n${body}` : '';
}

function industryHistoryToMd(h: IndustryHistoryV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    h.key_bullets?.length ? `**핵심 요약**\n${mdList(h.key_bullets)}` : '',
    h.timeline.length ? `**타임라인**\n${mdList(h.timeline.map(t =>
      `${t.period} — ${t.title}: ${t.significance}${t.key_players.length ? ` (${t.key_players.join(', ')})` : ''}`
    ))}` : '',
    h.why_durable ? `**지속 가능성**: ${h.why_durable}` : '',
    h.chasm_points.length ? `**캐즘 포인트**\n${mdList(h.chasm_points)}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 산업역사\n\n${body}` : '';
}

function techEvolutionToMd(t: TechEvolutionV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    t.key_bullets?.length ? `**핵심 요약**\n${mdList(t.key_bullets)}` : '',
    t.current_stage ? `**현재 단계**: ${t.current_stage}` : '',
    t.next_inflection ? `**다음 변곡점**: ${t.next_inflection}` : '',
    t.stages.length ? `**단계별 흐름**\n${mdList(t.stages.map(s => `${s.period} — ${s.title}: ${s.description}`))}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 기술변화\n\n${body}` : '';
}

function valueChainToMd(vc: ValueChainV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    vc.key_bullets?.length ? `**핵심 요약**\n${mdList(vc.key_bullets)}` : '',
    vc.layers.length ? `**밸류체인 레이어**\n${mdList(vc.layers.map(l =>
      `${l.name}${l.is_subject ? ' (분석 대상)' : ''}${l.buyer ? ' [구매자]' : l.pricing_power ? ` [가격결정력: ${l.pricing_power}]` : ''}${l.bottleneck ? ' [Bottleneck]' : ''} — ${l.description}`
    ))}` : '',
    vc.value_flow ? `**가격 전가 메커니즘**: ${vc.value_flow}` : '',
    vc.subject_position ? `**분석 기업 포지션**: ${vc.subject_position}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 밸류체인\n\n${body}` : '';
}

function businessModelToMd(bm: BusinessModelV2, sources: Source[] | undefined): string {
  const ue = bm.unit_economics;
  const body = mdJoin([
    bm.key_bullets?.length ? `**핵심 요약**\n${mdList(bm.key_bullets)}` : '',
    bm.growth_motion_detail ? `**Growth Motion (${bm.growth_motion})**: ${bm.growth_motion_detail}` : '',
    bm.revenue_streams.length ? `**Revenue Streams**\n${mdList(bm.revenue_streams.map(rs => `${rs.name} (${rs.type}) — ${rs.revenue_share}%`))}` : '',
    (ue.gross_margin || ue.operating_margin || ue.net_margin) ? `**Unit Economics**\n${mdList([
      ue.gross_margin ? `Gross Margin: ${ue.gross_margin}%` : '',
      ue.operating_margin ? `Operating Margin: ${ue.operating_margin}%` : '',
      ue.net_margin ? `Net Margin: ${ue.net_margin}%` : '',
      ue.fcf_margin ? `FCF Margin: ${ue.fcf_margin}%` : '',
      ue.nrr ? `NRR: ${ue.nrr}%` : '',
    ])}` : '',
    bm.segments.length ? `**사업 세그먼트**\n${mdList(bm.segments.map(seg => `${seg.name} — ${seg.revenue_share}%: ${seg.characteristics}`))}` : '',
    bm.moat.length ? `**경제적 해자**\n${mdList(bm.moat.map(m => `${m.type} (${m.strength}) — ${m.description}`))}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 비즈니스모델\n\n${body}` : '';
}

function competitorsToMd(c: CompetitorsV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    `**경쟁 포지션**: ${c.competitive_position}`,
    c.key_bullets?.length ? `**핵심 요약**\n${mdList(c.key_bullets)}` : '',
    c.direct.length ? `**직접 경쟁사**\n${mdList(c.direct.map(comp =>
      `${comp.name} (${comp.country})${comp.market_share ? ` — 점유율 ${comp.market_share}` : ''}${comp.vs_subject ? `: ${comp.vs_subject}` : ''}`
    ))}` : '',
    c.indirect.length ? `**간접 경쟁사**\n${mdList(c.indirect.map(x => `${x.name} — ${x.threat}`))}` : '',
    c.substitutes.length ? `**대체재**\n${mdList(c.substitutes.map(x => `${x.name} — ${x.threat}`))}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 경쟁사\n\n${body}` : '';
}

function strategyToMd(st: StrategyV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    st.key_bullets?.length ? `**핵심 요약**\n${mdList(st.key_bullets)}` : '',
    st.corporate.direction ? `**기업 전략**: ${st.corporate.direction}` : '',
    st.business.direction ? `**사업 전략**: ${st.business.direction}` : '',
    st.financial.direction ? `**재무 전략**: ${st.financial.direction}` : '',
    st.strategy_coherence ? `**전략 수렴**: ${st.strategy_coherence}` : '',
    st.ten_year_durability ? `**10년 지속 가능성**: ${st.ten_year_durability}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 전략\n\n${body}` : '';
}

function financialsToMd(f: FinancialsV2, sources: Source[] | undefined): string {
  const isRows = f.income_statement.filter(r => IS_COLS_V2.some(c => r[c]));
  const bsRows = f.balance_sheet.filter(r => r.fy2023 || r.fy2024 || r.fy2025);
  const body = mdJoin([
    f.key_bullets?.length ? `**핵심 요약**\n${mdList(f.key_bullets)}` : '',
    f.narrative ? `**재무 서사**: ${f.narrative}` : '',
    isRows.length ? `**손익계산서 (I/S)**\n| 항목 | FY2021 | FY2022 | FY2023 | FY2024 | FY2025 | YoY |\n|---|---|---|---|---|---|---|\n${
      isRows.map(r => `| ${r.item} | ${r.fy2021 ?? '—'} | ${r.fy2022 ?? '—'} | ${r.fy2023 ?? '—'} | ${r.fy2024 ?? '—'} | ${r.fy2025 ?? '—'} | ${r.yoy ?? '—'} |`).join('\n')
    }` : '',
    bsRows.length ? `**재무상태표 (B/S)**\n| 항목 | FY2023 | FY2024 | FY2025 |\n|---|---|---|---|\n${
      bsRows.map(r => `| ${r.item} | ${r.fy2023 ?? '—'} | ${r.fy2024 ?? '—'} | ${r.fy2025 ?? '—'} |`).join('\n')
    }` : '',
    (f.cash_flow.operating || f.cash_flow.fcf) ? `**현금흐름**\n${mdList([
      f.cash_flow.operating ? `Operating CF: ${f.cash_flow.operating}` : '',
      f.cash_flow.investing ? `Investing CF: ${f.cash_flow.investing}` : '',
      f.cash_flow.financing ? `Financing CF: ${f.cash_flow.financing}` : '',
      f.cash_flow.fcf ? `FCF: ${f.cash_flow.fcf}` : '',
    ])}` : '',
    f.key_risks.length ? `**핵심 리스크**\n${mdList(f.key_risks)}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 재무\n\n${body}` : '';
}

function founderToMd(fo: FounderV2): string {
  const body = mdJoin([
    fo.key_bullets?.length ? `**핵심 요약**\n${mdList(fo.key_bullets)}` : '',
    fo.founders.length ? `**기본 정보**\n${mdList(fo.founders.map(fd => `${fd.name}${fd.title && fd.title !== '-' ? ` (${fd.title})` : ''}${fd.education && fd.education !== '-' ? ` — ${fd.education}` : ''}`))}` : '',
    fo.career_trajectory.length ? `**커리어 궤적**\n${mdList(fo.career_trajectory.map(c => `${c.period} — ${c.company} (${c.role})`))}` : '',
    fo.founding_history.previous_ventures.length ? `**창업 이력** (${fo.founding_history.type === 'serial' ? 'Serial Founder' : '1st Time Founder'})\n${mdList(fo.founding_history.previous_ventures.map(v => `${v.name} — ${v.result}${v.exit_type ? ` (${v.exit_type})` : ''}`))}` : '',
    mdSourcesBlock(fo.sources),
  ]);
  return body ? `## 창업자\n\n${body}` : '';
}

function growthScenarioToMd(g: GrowthScenarioV2): string {
  const years = g.simulation.p50.length;
  const body = mdJoin([
    g.narrative ?? '',
    `| 연차 | 보수적(P10) | 예상(P50) | 낙관적(P90) |\n|---|---|---|---|\n${
      Array.from({ length: years }, (_, i) =>
        `| Year+${i + 1} | ${g.simulation.p10[i]} | ${g.simulation.p50[i]} | ${g.simulation.p90[i]} |`
      ).join('\n')
    }`,
  ]);
  return body ? `## 성장 시나리오\n\n${body}` : '';
}

function analysisToMd(data: AnalysisDetail): string {
  const parts: string[] = [
    `# ${data.companyName}`,
    `분석일: ${new Date(data.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}`,
  ];
  if (data.summary_v2) parts.push(summaryToMd(data.summary_v2, data.summary_v2.sources ?? data.sources?.summary));
  if (data.industry_history_v2) parts.push(industryHistoryToMd(data.industry_history_v2, data.industry_history_v2.sources ?? data.sources?.industry_history));
  if (data.tech_evolution_v2) parts.push(techEvolutionToMd(data.tech_evolution_v2, data.tech_evolution_v2.sources ?? data.sources?.tech_evolution));
  if (data.value_chain_v2) parts.push(valueChainToMd(data.value_chain_v2, data.value_chain_v2.sources ?? data.sources?.value_chain));
  if (data.business_model_v2) parts.push(businessModelToMd(data.business_model_v2, data.business_model_v2.sources ?? data.sources?.business_model));
  if (data.competitors_v2) parts.push(competitorsToMd(data.competitors_v2, data.competitors_v2.sources ?? data.sources?.competitors));
  if (data.strategy_v2) parts.push(strategyToMd(data.strategy_v2, data.strategy_v2.sources ?? data.sources?.strategy));
  if (data.financials_v2) parts.push(financialsToMd(data.financials_v2, data.financials_v2.sources ?? data.sources?.financials));
  if (data.founder_v2) parts.push(founderToMd(data.founder_v2));
  if (data.growth_scenario_v2) parts.push(growthScenarioToMd(data.growth_scenario_v2));
  return parts.filter(Boolean).join('\n\n---\n\n');
}

function CopyButton({ getMarkdown, label = '복사', shortLabel }: { getMarkdown: () => string; label?: string; shortLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    const md = getMarkdown();
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한 거부 등 — 조용히 무시
    }
  }, [getMarkdown]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors shrink-0"
    >
      {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
      {shortLabel ? (
        <>
          <span className="hidden sm:inline">{copied ? '복사됨' : label}</span>
          <span className="sm:hidden">{copied ? '복사됨' : shortLabel}</span>
        </>
      ) : (
        copied ? '복사됨' : label
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

// 사이드바 2그룹 분리(2026-08) — "기업분석"은 기존 8개 탭 그대로, "pain 진단"은
// 크로스인더스트리 넛지(신규, 배치2) + 산업역사/기술역사(온디맨드, "pain 진단 시작" 버튼)로
// 구성된다. 그룹은 표시 순서/헤더 렌더링에만 쓰이고 TabKey 자체는 그대로 flat union.
const TAB_GROUPS = [
  { key: 'company', label: '기업분석' },
  { key: 'pain',    label: 'pain 진단' },
] as const;

const TABS = [
  { key: 'summary',              group: 'company', label: '요약',         icon: Briefcase,  tooltip: '이 회사가 뭐 하는 곳인지 한눈에 확인할 수 있어요' },
  { key: 'value_chain',          group: 'company', label: '밸류체인',     icon: GitBranch,  tooltip: '이 회사가 산업 내 어디에 위치하는지 확인할 수 있어요' },
  { key: 'business_model',       group: 'company', label: '비즈니스모델', icon: DollarSign, tooltip: '어떻게 돈을 버는지 확인할 수 있어요' },
  { key: 'competitors',          group: 'company', label: '경쟁사',       icon: Users,      tooltip: '주요 경쟁사와 차별점을 확인할 수 있어요' },
  { key: 'strategy',             group: 'company', label: '전략',         icon: Target,     tooltip: '앞으로의 성장 전략을 확인할 수 있어요' },
  { key: 'financials',           group: 'company', label: '재무',         icon: BarChart2,  tooltip: '매출, 이익, 현금흐름 등 재무 데이터를 확인할 수 있어요' },
  { key: 'founder',              group: 'company', label: '창업자',       icon: User,       tooltip: '창업자 배경과 이력을 확인할 수 있어요' },
  { key: 'growth_scenario',      group: 'company', label: '성장 시나리오', icon: TrendingUp, tooltip: '몬테카를로 시뮬레이션 기반 매출 성장 시나리오를 확인할 수 있어요 (프리미엄)' },
  { key: 'cross_industry_nudge', group: 'pain',    label: '넛지',         icon: Lightbulb,  tooltip: '이 업종의 공통 pain과 타산업 해결 사례를 확인할 수 있어요' },
  { key: 'industry_history',     group: 'pain',    label: '산업역사',     icon: Clock,      tooltip: '이 산업이 어떻게 발전해왔는지 확인할 수 있어요' },
  { key: 'tech_evolution',       group: 'pain',    label: '기술변화',     icon: Zap,        tooltip: '현재 기술 트렌드와 앞으로의 방향을 확인할 수 있어요' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// 콘텐츠 패널의 초기 스켈레톤(CardsSkeleton/TableSkeleton 등) 표시 여부 판정 전용
// (아래 batchDone()에서만 사용). 탭 바 체크마크(✓)는 이 값을 안 쓰고 hasTabData()로
// 판정한다 — 혼동 금지.
//
// industry_history/tech_evolution은 2026-08부터 배치와 완전히 무관해졌다("pain 진단 시작"
// 버튼 전용 온디맨드) — 아래 숫자는 이제 어떤 스켈레톤 판정에도 쓰이지 않는 vestigial 값(타입
// 완결성 때문에 Record<TabKey, number>에 키는 남겨둠). 실제 렌더링은 하단 tab content에서
// batchDone을 아예 거치지 않고 data 존재/isReanalyzing만으로 분기한다.
const TAB_BATCH: Record<TabKey, number> = {
  summary:              1,
  business_model:       2,
  competitors:          2,
  cross_industry_nudge: 2,
  value_chain:          3,
  strategy:             3,
  financials:           40,
  founder:              4,
  growth_scenario:      6,
  industry_history:     0,
  tech_evolution:       0,
};

// 최상위 3단 탭(Company Intelligence/Pain Diagnosis/AE Skills, 2026-08)에서 활성 그룹이
// 바뀔 때 그 그룹의 첫 탭을 골라주는 헬퍼 — activeGroup이 없으면(ShareContent 등 기존
// 호출부) 항상 'summary'로 폴백해 기존 동작 그대로 유지.
function firstTabOfGroup(group?: 'company' | 'pain'): TabKey {
  return (group ? TABS.find(t => t.group === group)?.key : undefined) ?? 'summary';
}

// 탭 바 체크마크(✓) 전용 — TAB_BATCH(위 주석 참고, 스켈레톤 표시용일 뿐 실제 완료 순서와
// 무관)와는 완전히 별개 판정 경로다. 체크마크는 반드시 "그 탭 데이터가 실제로
// 존재하는가"만으로 판정한다 — 예전엔 TAB_BATCH를 재사용해서 industry_history/
// tech_evolution 탭이 아직 생성되지도 않았는데 배치2/3 완료 즉시 ✓가 뜨는 버그가 있었다.
function hasTabData(key: TabKey, data: AnalysisDetail, financialsV2: FinancialsV2 | undefined): boolean {
  switch (key) {
    case 'summary':              return !!data.summary_v2;
    case 'industry_history':     return !!data.industry_history_v2;
    case 'tech_evolution':       return !!data.tech_evolution_v2;
    case 'value_chain':          return !!data.value_chain_v2;
    case 'business_model':       return !!data.business_model_v2;
    case 'competitors':          return !!data.competitors_v2;
    case 'cross_industry_nudge': return !!data.cross_industry_nudge_v1;
    case 'strategy':             return !!data.strategy_v2;
    case 'financials':           return !!financialsV2;
    case 'founder':              return !!data.founder_v2;
    case 'growth_scenario':      return !!data.growth_scenario_v2;
    default:                     return false;
  }
}

// 관리자 전용 기능 노출 대상(PDF 내보내기 등) — 추가 시 이 배열에 이메일만 추가.
const ADMIN_EMAILS = ['sg.van.p@gmail.com'];

function AnalysisCardInner({ data, reanalyzingTabs, onReanalyze, onPainDiagnosisStart, isPremium, activeGroup }: {
  data: AnalysisDetail;
  reanalyzingTabs?: Set<string>;
  onReanalyze?: (tab: string) => void;
  // "pain 진단 시작" 버튼 전용 — industry_history_v2/tech_evolution_v2를 한 번에 생성
  // (2026-08, POST /api/analyze/:id/pain-diagnosis). onReanalyze와 별도 prop인 이유:
  // onReanalyze는 섹션 하나만 재생성하는 범용 경로라 두 섹션 동시 생성을 표현할 수 없다.
  onPainDiagnosisStart?: () => void;
  isPremium?: boolean;
  // 최상위 3단 탭(2026-08, HomeContent.tsx)이 "Company Intelligence"/"Pain Diagnosis" 중
  // 무엇을 골랐는지 — 지정되면 그 그룹의 탭만 필터링해서 보여준다. undefined면(ShareContent
  // 등 기존 호출부) 기존처럼 두 그룹 다 표시 — 하위호환, 새 사이드바 컴포넌트 안 만듦.
  activeGroup?: 'company' | 'pain';
}) {
  const { user, session, signInWithGoogle } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const [tab, setTab] = useState<TabKey>(() => firstTabOfGroup(activeGroup));
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { completedBatches } = useAnalysis();
  // batchDone: true when not streaming OR when that batch has completed
  const batchDone = (n: number) => completedBatches.size === 0 || completedBatches.has(n);
  // isReanalyzing: that tab is being reanalyzed right now
  const isReanalyzing = (t: string) => reanalyzingTabs?.has(t) ?? false;
  // reanalyzeBtn: small text-link shown when v2 data is missing
  const reanalyzeBtn = (t: string) => onReanalyze && !isReanalyzing(t) ? (
    <div className="text-right mb-2">
      <button
        onClick={() => onReanalyze(t)}
        className="text-[11px] text-gray-400 hover:text-blue-500 hover:underline transition-colors"
      >
        ↻ 이 섹션 다시 분석
      </button>
    </div>
  ) : null;

  // Task 1: 분석 시작 시 (activeGroup의) 요약격 탭으로 자동 이동
  useEffect(() => {
    if (completedBatches.size === 1 && completedBatches.has(-1)) {
      startTransition(() => setTab(firstTabOfGroup(activeGroup)));
    }
  }, [completedBatches, activeGroup]);

  // 최상위 3단 탭에서 activeGroup이 바뀌면(Company Intelligence ↔ Pain Diagnosis 전환)
  // 지금 보고 있던 탭이 새 그룹에 없을 수 있으므로 그 그룹의 첫 탭으로 자동 전환.
  useEffect(() => {
    if (!activeGroup) return;
    setTab(prev => TABS.find(t => t.key === prev)?.group === activeGroup ? prev : firstTabOfGroup(activeGroup));
  }, [activeGroup]);

  // industry_history_v2/tech_evolution_v2는 탭을 여는 것만으로 더 이상 자동 생성되지
  // 않는다(2026-08 — 예전엔 탭 오픈 시 자동 트리거였으나, "pain 진단 시작" 버튼 클릭이
  // 유일한 트리거로 바뀜). painDiagnosisStarted는 이번 화면 방문에서 버튼을 눌렀는지만
  // 추적 — 누른 뒤에도 데이터가 없으면(실패) CTA 대신 기존 "↻ 다시 분석" 폴백을 보여준다.
  const [painDiagnosisStarted, setPainDiagnosisStarted] = useState(false);
  const handlePainDiagnosisClick = () => {
    setPainDiagnosisStarted(true);
    onPainDiagnosisStart?.();
  };

  const [financialsV2Local, setFinancialsV2Local] = useState<FinancialsV2 | undefined>(data.financials_v2);
  const [refreshingFinancials, setRefreshingFinancials] = useState(false);

  // data.financials_v2는 스트리밍 도중 fin_preview(프리뷰) → batch3(확정본) 순으로 갱신되는데,
  // useState 초기값은 마운트 시점 한 번만 캡처되고 이후 prop 변경엔 재동기화되지 않는 게
  // 기본 React 동작이다 — 이 로컬 state를 그대로 두면 재무 탭이 프리뷰에 고착되거나(마운트
  // 시점에 fin_preview가 이미 왔던 경우), fin_preview가 없는 기업은 batch4가 와도 계속
  // undefined로 남는다(마운트 시점 값 그대로). prop이 갱신될 때마다 재동기화해서 반영한다 —
  // handleRefreshFinancials의 수동 새로고침은 prop을 건드리지 않으므로 이 effect와 충돌 없음.
  useEffect(() => {
    setFinancialsV2Local(data.financials_v2);
  }, [data.financials_v2]);

  const handleRefreshFinancials = useCallback(async () => {
    if (!session) { signInWithGoogle(); return; }
    setRefreshingFinancials(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/analyses/${data.id}/refresh-financials`, {
        method: 'POST',
        headers: buildAuthHeaders(null, session.access_token),
      });
      if (res.ok) {
        const { financials_v2 } = await res.json();
        setFinancialsV2Local(financials_v2);
      }
    } catch {
      // silently ignore network errors
    } finally {
      setRefreshingFinancials(false);
    }
  }, [data.id, session, signInWithGoogle]);

  const ticker = data.summary_v2?.ticker ?? null;

  // "이 탭 복사" — 현재 활성 탭의 데이터만 골라 섹션별 복사와 동일한 변환 함수로 마크다운 생성
  const getActiveTabMarkdown = useCallback((): string => {
    switch (tab) {
      case 'summary':          return data.summary_v2 ? summaryToMd(data.summary_v2, data.summary_v2.sources ?? data.sources?.summary) : '';
      case 'industry_history': return data.industry_history_v2 ? industryHistoryToMd(data.industry_history_v2, data.industry_history_v2.sources ?? data.sources?.industry_history) : '';
      case 'tech_evolution':   return data.tech_evolution_v2 ? techEvolutionToMd(data.tech_evolution_v2, data.tech_evolution_v2.sources ?? data.sources?.tech_evolution) : '';
      case 'value_chain':      return data.value_chain_v2 ? valueChainToMd(data.value_chain_v2, data.value_chain_v2.sources ?? data.sources?.value_chain) : '';
      case 'business_model':   return data.business_model_v2 ? businessModelToMd(data.business_model_v2, data.business_model_v2.sources ?? data.sources?.business_model) : '';
      case 'competitors':      return data.competitors_v2 ? competitorsToMd(data.competitors_v2, data.competitors_v2.sources ?? data.sources?.competitors) : '';
      case 'strategy':         return data.strategy_v2 ? strategyToMd(data.strategy_v2, data.strategy_v2.sources ?? data.sources?.strategy) : '';
      case 'financials':       return financialsV2Local ? financialsToMd(financialsV2Local, financialsV2Local.sources ?? data.sources?.financials) : '';
      case 'founder':          return data.founder_v2 ? founderToMd(data.founder_v2) : '';
      case 'growth_scenario':  return data.growth_scenario_v2 ? growthScenarioToMd(data.growth_scenario_v2) : '';
      default:                 return '';
    }
  }, [tab, data, financialsV2Local]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} className="text-gray-400" />
              <h2 className="text-2xl font-semibold text-gray-900 leading-none">{data.companyName}</h2>
            </div>
            <p className="text-xs text-gray-400 ml-6">
              {new Date(data.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CopyButton getMarkdown={() => analysisToMd(data)} label="전체 복사" />
            <CopyButton getMarkdown={getActiveTabMarkdown} label="이 탭 복사" shortLabel="탭 복사" />
            {isAdmin && <ExportPdfButton data={data} />}
            <DataSourceBadge source={data.dataSource ?? 'web_search'} />
          </div>
        </div>
      </div>

      {/* Tab bar — 2026-08부터 기업분석/pain 진단 2그룹으로 분리, 그룹 라벨만 추가되고
          개별 탭 버튼 로직(체크마크/스피너 등)은 그대로. activeGroup이 지정되면(최상위
          3단 탭, HomeContent.tsx) 그 그룹만 필터링해서 보여주고 그룹 라벨은 생략 —
          상단 탭이 이미 그룹을 나타내므로 중복. undefined면(ShareContent 등) 기존처럼
          두 그룹 다 보여줌 */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-white px-2">
        {(activeGroup ? TAB_GROUPS.filter(g => g.key === activeGroup) : TAB_GROUPS).map((g, gi) => (
          <div key={g.key} className={`flex items-stretch shrink-0 ${gi > 0 ? 'border-l border-gray-100 ml-1 pl-1' : ''}`}>
            {!activeGroup && (
              <div className="flex items-center shrink-0 px-2">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-300 whitespace-nowrap">{g.label}</span>
              </div>
            )}
            {TABS.filter(t => t.group === g.key).map(t => {
              const Icon = t.icon;
              const active = tab === t.key;
              const isStreaming = completedBatches.has(-1);
              const batch1Done = completedBatches.has(1);
              // tabDone: 배치 번호가 아니라 해당 탭 데이터가 실제로 존재하는지로만 판정 —
              // industry_history/tech_evolution은 온디맨드라 배치 번호 자체가 없다.
              const tabDone = hasTabData(t.key, data, financialsV2Local);
              // waiting: streaming, batch1 not done, non-summary tab (batches haven't notified yet)
              const isWaiting    = isStreaming && !batch1Done && t.key !== 'summary';
              // in-progress: streaming, batch1 done (or is summary tab), this tab not done
              const isInProgress = isStreaming && !tabDone && !isWaiting;
              // done: streaming and this tab's batch has arrived
              const isDoneNow    = isStreaming && tabDone;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    trackEvent('tab_clicked', { tab: t.key });
                    if (t.key === 'financials') trackEvent('financials_tab_reached', { companyName: data.companyName });
                    startTransition(() => setTab(t.key));
                  }}
                  onMouseEnter={() => setHoveredTooltip(t.tooltip)}
                  onMouseLeave={() => setHoveredTooltip(null)}
                  className={`shrink-0 flex items-center gap-1 py-3 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={12} />
                  {t.label}
                  {t.key === 'growth_scenario' && !isPremium && (
                    <span className="text-[9px] font-bold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1 py-[1px] ml-0.5 leading-none">
                      PRO
                    </span>
                  )}
                  {isWaiting && (
                    <span className="flex gap-[2px] items-center ml-0.5" aria-hidden>
                      {[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}
                    </span>
                  )}
                  {isInProgress && (
                    <span className="w-2 h-2 shrink-0 border border-current border-t-transparent rounded-full animate-spin opacity-40 ml-0.5" />
                  )}
                  {isDoneNow && (
                    <span key={`done-${t.key}`} className="text-emerald-500 text-[10px] font-bold anim-fadein leading-none ml-0.5">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Tab tooltip strip — desktop only */}
      <div className="hidden md:block h-7 bg-white border-b border-gray-100 px-4 flex items-center">
        {hoveredTooltip && (
          <span className="text-[11px] text-gray-400 leading-none">{hoveredTooltip}</span>
        )}
      </div>

      {/* Tab content — only active tab is mounted */}
      <div className="p-5 bg-gray-50 min-h-[300px]">
        {tab === 'summary' && (
          !batchDone(TAB_BATCH.summary) ? <SummarySkeleton /> :
          data.summary_v2
            ? <SummaryV2Tab s={data.summary_v2} sources={data.summary_v2.sources ?? data.sources?.summary} onTabChange={key => startTransition(() => setTab(key as TabKey))} />
            : <SummaryTab data={data} />
        )}
        {tab === 'cross_industry_nudge' && (
          (isReanalyzing('nudge') || !batchDone(TAB_BATCH.cross_industry_nudge)) ? <CardsSkeleton count={2} /> :
          data.cross_industry_nudge_v1
            ? <CrossIndustryNudgeV1Tab n={data.cross_industry_nudge_v1} sources={data.cross_industry_nudge_v1.sources} />
            : <>{reanalyzeBtn('nudge')}<p className="text-sm text-gray-500 py-4 text-center">넛지 데이터가 없습니다.</p></>
        )}
        {/* industry_history/tech_evolution: 2026-08부터 배치와 무관 — "pain 진단 시작" 버튼
            클릭 1번으로 둘 다 동시 생성된다. batchDone 게이트 없이 data 존재/reanalyzing
            상태로만 분기(카드 자체가 batch1 완료 후에만 마운트되므로 별도 스켈레톤 불필요). */}
        {tab === 'industry_history' && (
          data.industry_history_v2
            ? <IndustryHistoryV2Tab h={data.industry_history_v2} sources={data.industry_history_v2.sources ?? data.sources?.industry_history} />
            : (isReanalyzing('industry') || isReanalyzing('tech'))
              ? <SectionGenerating label="산업 역사" />
              : !onPainDiagnosisStart
                // 히스토리/공유 링크 등 읽기 전용 화면 — 버튼을 눌러도 아무 요청도 안 나가면서
                // "결과를 불러오지 못했다"는 오해성 실패 메시지만 뜨는 걸 방지(2026-08-12 발견).
                ? <p className="text-sm text-gray-500 py-16 text-center">아직 생성되지 않은 섹션입니다.</p>
                : painDiagnosisStarted
                  ? <>{reanalyzeBtn('industry')}<p className="text-sm text-gray-500 py-4 text-center">진단 결과를 불러오지 못했어요.</p></>
                  : <PainDiagnosisStart onStart={handlePainDiagnosisClick} />
        )}
        {tab === 'tech_evolution' && (
          data.tech_evolution_v2
            ? <TechEvolutionV2Tab t={data.tech_evolution_v2} sources={data.tech_evolution_v2.sources ?? data.sources?.tech_evolution} />
            : (isReanalyzing('industry') || isReanalyzing('tech'))
              ? <SectionGenerating label="기술 변화" />
              : !onPainDiagnosisStart
                ? <p className="text-sm text-gray-500 py-16 text-center">아직 생성되지 않은 섹션입니다.</p>
                : painDiagnosisStarted
                  ? <>{reanalyzeBtn('tech')}<p className="text-sm text-gray-500 py-4 text-center">진단 결과를 불러오지 못했어요.</p></>
                  : <PainDiagnosisStart onStart={handlePainDiagnosisClick} />
        )}
        {tab === 'value_chain' && (
          (isReanalyzing('value_chain') || !batchDone(TAB_BATCH.value_chain)) ? <CardsSkeleton count={4} /> :
          data.value_chain_v2
            ? <ValueChainV2Tab vc={data.value_chain_v2} sources={data.value_chain_v2.sources ?? data.sources?.value_chain} />
            : <>{reanalyzeBtn('value_chain')}<ValueChainTab data={data} /></>
        )}
        {tab === 'business_model' && (
          (isReanalyzing('business_model') || !batchDone(TAB_BATCH.business_model)) ? <CardsSkeleton count={3} /> :
          data.business_model_v2
            ? <BusinessModelV2Tab bm={data.business_model_v2} sources={data.business_model_v2.sources ?? data.sources?.business_model} />
            : <>{reanalyzeBtn('business_model')}<BusinessModelTab data={data} /></>
        )}
        {tab === 'competitors' && (
          (isReanalyzing('competitors') || !batchDone(TAB_BATCH.competitors)) ? <CardsSkeleton count={4} /> :
          data.competitors_v2
            ? <CompetitorsV2Tab c={data.competitors_v2} sources={data.competitors_v2.sources ?? data.sources?.competitors} dataSource={data.dataSource} />
            : <>{reanalyzeBtn('competitors')}<CompetitorsTab data={data} /></>
        )}
        {tab === 'strategy' && (
          (isReanalyzing('strategy') || !batchDone(TAB_BATCH.strategy)) ? <CardsSkeleton count={3} /> :
          data.strategy_v2
            ? <StrategyV2Tab s={data.strategy_v2} sources={data.strategy_v2.sources ?? data.sources?.strategy} />
            : <>{reanalyzeBtn('strategy')}<StrategyTab data={data} /></>
        )}
        {tab === 'financials' && (
          (isReanalyzing('financials') || !batchDone(TAB_BATCH.financials)) ? <TableSkeleton rows={5} cols={7} /> :
          financialsV2Local
            ? <FinancialsV2Tab
                f={financialsV2Local}
                sources={financialsV2Local.sources ?? data.sources?.financials}
                onRefresh={handleRefreshFinancials}
                isRefreshing={refreshingFinancials}
                dataSource={data.dataSource}
              />
            : <>{reanalyzeBtn('financials')}<FinancialsTab data={data} /></>
        )}
        {tab === 'founder' && (
          (isReanalyzing('founder') || !batchDone(TAB_BATCH.founder)) ? <FounderSkeleton /> :
          data.founder_v2
            ? <FounderV2Tab f={data.founder_v2} />
            : <>{reanalyzeBtn('founder')}<p className="text-sm text-gray-500 py-4 text-center">창업자 데이터가 없습니다.</p></>
        )}
        {tab === 'growth_scenario' && (
          !isPremium ? <GrowthScenarioLocked /> :
          !batchDone(TAB_BATCH.growth_scenario) ? <CardsSkeleton count={3} /> :
          data.growth_scenario_v2
            ? <GrowthScenarioV2Tab g={data.growth_scenario_v2} />
            : <p className="text-sm text-gray-500 py-4 text-center">최소 3개년 공식 재무 시계열이 확보된 기업만 지원돼요.</p>
        )}
      </div>
    </div>
  );
}

const AnalysisCard = memo(AnalysisCardInner);
export default AnalysisCard;

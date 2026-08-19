'use client';

import { useState, useEffect, memo, useCallback, useMemo, useTransition } from 'react';
import { useAnalysis } from '@/app/context/AnalysisContext';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { trackEvent } from '@/lib/analytics';
import { calcCagr, fmtCagr, fmtGrowthRevenue } from '@/lib/growthScenario';
import dynamic from 'next/dynamic';
import {
  BarChart2, Zap, GitBranch, Users, DollarSign, Target,
  BookOpen, ExternalLink, Building2, Clock, Briefcase, User, RefreshCw,
  TrendingUp, Lock, Copy, Check, Lightbulb, Star, ArrowUp, ArrowDown,
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
import { isPlaceholder, countFinancialsReliability, getFinancialYearCols } from '@/lib/financialsReliability';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

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

// AnalysisPdf.tsx의 동명 헬퍼와 동일 매핑, uiT.home.purposeMa 등 이미 있는 문자열을
// 그대로 재사용(새 문자열 불필요) — 2026-08-17 웹 표지 목적 표시 신규 계기.
function purposeCategoryLabel(category: string, uiT: ReturnType<typeof getUiStrings>): string {
  const map: Record<string, string> = {
    ma: uiT.home.purposeMa,
    investment: uiT.home.purposeInvestment,
    partnership: uiT.home.purposePartnership,
    customer: uiT.home.purposeCustomer,
  };
  return map[category] ?? uiT.home.purposeOther;
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Tag({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600',
    navy: 'bg-navy-50 text-navy-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${map[color] ?? map.gray}`}>
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
        <div className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-2">
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
        {str.slice(0, idx)}<span className="text-source-reference">{estimateMarker}</span>{str.slice(idx + estimateMarker.length)}
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
    ? <span className="text-navy-600 text-base font-bold ml-1 leading-none shrink-0">▲</span>
    : trend === 'down'
    ? <span className="text-risk text-base font-bold ml-1 leading-none shrink-0">▼</span>
    : trend === 'flat'
    ? <span className="text-gray-400 text-base ml-1 leading-none shrink-0">→</span>
    : null;
  return (
    <div className="bg-gray-50 rounded-lg p-3 min-w-0">
      <div className="text-sm text-gray-400 mb-1 leading-tight">{label}</div>
      <div className="font-semibold text-base text-gray-900 leading-snug flex items-center min-w-0">
        <span className="break-all min-w-0 flex-1">
          <DataValue text={displayValue} />
        </span>
        {!isUnknown && trendEl}
        {!isUnknown && sourceIndex != null && (
          <sup className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded bg-navy-100 text-navy-700 text-[11px] font-bold ml-0.5 align-top mt-0.5 shrink-0">
            {sourceIndex}
          </sup>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'bg-navy-400', height = 'h-2' }: {
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
        <span className="text-sm text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="text-base font-medium text-gray-900 leading-snug break-words"><DataValue text={numPart} /></div>
      {descPart && <div className="text-sm text-gray-500 leading-snug mt-0.5 break-words"><DataValue text={descPart} /></div>}
    </div>
  );
}

const LEVEL_BADGE: Record<string, { label: string; cls: string }> = {
  L1: { label: '🟢 공식', cls: 'bg-source-official-bg text-source-official border border-source-official-border' },
  L2: { label: '🟡 참고', cls: 'bg-source-reference-bg text-source-reference border border-source-reference-border' },
  L3: { label: '⚪ 추정', cls: 'bg-source-estimate-bg text-source-estimate border border-source-estimate-border' },
};

// 출처 종류(EDGAR/DART/웹검색)가 아니라 신뢰도(L1/L2/L3) 기준으로 점 색상 결정 —
// EDGAR/DART는 둘 다 L1이므로 항상 동일한 색으로 렌더링됨
const LEVEL_DOT: Record<SourceLevel, string> = {
  L1: 'bg-source-official',
  L2: 'bg-source-reference',
  L3: 'bg-source-estimate',
};

function SourcesList({ sources }: { sources: Source[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={11} className="text-gray-400" />
        <span className="text-sm font-semibold uppercase tracking-widest text-gray-400">출처</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {sources.map((s, i) => {
          const idx = s.index ?? i + 1;
          const badge = LEVEL_BADGE[s.level] ?? LEVEL_BADGE.L2;
          return (
            <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="shrink-0 font-bold text-gray-700 w-6 text-right mt-0.5">[{idx}]</span>
              <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold leading-none mt-0.5 ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="leading-snug flex-1">
                <span className="font-medium text-gray-700">{s.organization}</span>
                {s.date && <span className="text-gray-400 ml-1">{s.date}</span>}
                {' — '}
                <span>{s.content}</span>
                {s.isEstimate && <span className="ml-1 text-source-reference font-medium">(추정)</span>}
              </span>
              {s.url && (
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 mt-0.5 text-navy-400 hover:text-navy-600">
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
// web_search 라벨은 2026-08-16(작업 D)에 "웹 검색 기반" → "SEC/DART 데이터 없음"으로 변경 —
// EDGAR/DART 둘 다 미공시 기업은 이제 재무 탭에 웹서치 자유서술을 아예 안 보여주므로(financials
// 전용 EmptySectionState), "웹 검색 기반"이라는 기존 문구는 "그래도 웹서치로 채워진 데이터가
// 있다"는 오해를 줄 수 있었다. (참고: 이 컴포넌트는 dart/edgar 라벨도 원래부터 하드코딩
// 한국어라 언어 토글 미적용 상태 — 이번 변경으로 새로 생긴 격차 아님, 기존 패턴 유지.)
const DATA_SOURCE_CONFIG: Record<DataSource, { label: string; level: SourceLevel }> = {
  dart:       { label: 'DART 연동됨',        level: 'L1' },
  edgar:      { label: 'SEC EDGAR 연동됨',   level: 'L1' },
  web_search: { label: 'SEC/DART 데이터 없음', level: 'L3' },
};

function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = DATA_SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium px-2.5 py-1 rounded-full shrink-0 ${LEVEL_BADGE[cfg.level].cls}`}>
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
          <li key={i} className="text-white text-base font-medium leading-snug flex items-start gap-2">
            <span className="text-navy-400 shrink-0 mt-0.5">•</span>
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
          <sup key={i} className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-0.5 rounded bg-navy-100 text-navy-700 text-[11px] font-bold ml-0.5 align-top mt-0.5">
            {m[1]}
          </sup>
        );
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ── Bullet list (콘텐츠 포맷 원칙 — 종합 해석은 기본이 불릿, 문단은 예외) ────────────

function BulletList({ items, dotCls = 'bg-gray-400', textCls = 'text-base text-gray-700' }: {
  items: string[] | undefined | null;
  dotCls?: string;
  textCls?: string;
}) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-[6px] w-1.5 h-1.5 rounded-full shrink-0 ${dotCls}`} />
          <CitedText text={item} className={`${textCls} leading-relaxed`} />
        </div>
      ))}
    </div>
  );
}

function BulletCallout({ title, items, boxCls, titleCls, dotCls }: {
  title: string;
  items: string[] | undefined | null;
  boxCls: string;
  titleCls: string;
  dotCls: string;
}) {
  if (!items?.length) return null;
  return (
    <div className={`rounded-xl p-4 ${boxCls}`}>
      <div className={`text-sm font-semibold uppercase tracking-widest mb-2 ${titleCls}`}>{title}</div>
      <BulletList items={items} dotCls={dotCls} />
    </div>
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
  emerging:   { label: 'Emerging',   cls: 'bg-navy-50 text-navy-600' },
  hype:       { label: 'Peak Hype',  cls: 'bg-navy-100 text-navy-700' },
  trough:     { label: 'Trough',     cls: 'bg-gray-100 text-gray-500' },
  recovery:   { label: 'Recovery',   cls: 'bg-navy-50 text-navy-600' },
  mainstream: { label: 'Mainstream', cls: 'bg-gray-100 text-gray-600' },
};

const PRICING_POWER_CFG: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High Pricing Power', cls: 'bg-navy-100 text-navy-700' },
  medium: { label: 'Medium',             cls: 'bg-navy-50 text-navy-600' },
  low:    { label: 'Low',                cls: 'bg-gray-100 text-gray-500' },
};

const MOAT_STRENGTH_CFG: Record<string, { label: string; cls: string; barColor: string; width: string }> = {
  strong: { label: 'Strong', cls: 'bg-navy-100 text-navy-700', barColor: 'bg-navy-600', width: 'w-[90%]' },
  medium: { label: 'Medium', cls: 'bg-navy-50 text-navy-600',  barColor: 'bg-navy-400', width: 'w-[60%]' },
  weak:   { label: 'Weak',   cls: 'bg-gray-100 text-gray-500', barColor: 'bg-gray-300', width: 'w-[30%]' },
};

const GROWTH_MOTION_CFG: Record<string, { label: string; cls: string }> = {
  PLG:    { label: 'Product-Led Growth',  cls: 'bg-navy-100 text-navy-700' },
  SLG:    { label: 'Sales-Led Growth',    cls: 'bg-navy-100 text-navy-700' },
  FLG:    { label: 'Finance-Led Growth',  cls: 'bg-navy-100 text-navy-700' },
  hybrid: { label: 'Hybrid',              cls: 'bg-navy-100 text-navy-700' },
};

const COMPETITIVE_POSITION_CFG: Record<string, { label: string; cls: string }> = {
  leader:     { label: 'Market Leader', cls: 'bg-navy-100 text-navy-700' },
  challenger: { label: 'Challenger',    cls: 'bg-navy-50 text-navy-600' },
  niche:      { label: 'Niche Player',  cls: 'bg-navy-50 text-navy-600' },
  follower:   { label: 'Follower',      cls: 'bg-gray-100 text-gray-600' },
};

const VC_POSITION_CFG: Record<string, { label: string; cls: string }> = {
  upstream:   { label: 'Upstream',   cls: 'bg-navy-50 text-navy-600' },
  midstream:  { label: 'Midstream',  cls: 'bg-navy-100 text-navy-700' },
  downstream: { label: 'Downstream', cls: 'bg-navy-50 text-navy-600' },
};

const BAR_COLORS = ['bg-navy-700', 'bg-navy-600', 'bg-navy-500', 'bg-navy-400', 'bg-navy-300'];

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
              <li key={i} className="text-white text-base font-medium leading-snug flex items-start gap-2">
                <span className="text-navy-400 shrink-0 mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <span className={`shrink-0 text-sm font-semibold px-2.5 py-1 rounded-full self-start ${vcPos.cls}`}>
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
          <button onClick={() => onTabChange('financials')} className="text-sm text-navy-500 hover:text-navy-700 font-medium">재무 상세 보기 →</button>
        </div>
      )}

      {/* Products + Markets — 풀 너비 스택 (바 차트 전체 너비 확보) */}
      <div className="space-y-3">
        {s.products.length > 0 && (
          <SectionCard title="주요 제품/서비스" dotColor="bg-navy-400">
            {/* 매출 비중(%)은 여기서 더 이상 안 보여준다 — 재무 탭의 "매출 구성"(revenue_lines,
                EDGAR 10-K 실측)만이 유일한 비중 출처. 이름+정성적 설명만 표시. */}
            <ul className="space-y-2">
              {s.products.map((p, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-gray-800">{p.name}</span>
                  {p.description && <span className="text-gray-500"> — {p.description}</span>}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {s.key_markets.length > 0 && (
          <SectionCard title="주요 시장" dotColor="bg-navy-400">
            <div className="space-y-2.5">
              {s.key_markets.map((m, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
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
          <button onClick={() => onTabChange('business_model')} className="text-sm text-navy-500 hover:text-navy-700 font-medium">비즈니스모델 보기 →</button>
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
          <SectionCard title="주요 고객사" dotColor="bg-navy-400">
            {s.top_customers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {s.top_customers.map((c, i) => (
                  <Tag key={i} label={c} color="navy" />
                ))}
              </div>
            )}
            {hasValidCc ? (
              <div className="space-y-2 mt-2">
                <div className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg font-medium ${
                  cc.is_concentrated
                    ? 'bg-risk-bg text-risk border border-risk-border'
                    : 'bg-navy-50 text-navy-700 border border-navy-100'
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
                        <div className="flex justify-between text-sm mb-0.5">
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
                <p className="text-sm text-gray-400 mt-1">집중도 데이터 없음</p>
              )
            )}
          </SectionCard>
        );
      })()}

      {onTabChange && (s.top_customers.length > 0 || s.customer_concentration) && (
        <div className="flex justify-end">
          <button onClick={() => onTabChange('competitors')} className="text-sm text-navy-500 hover:text-navy-700 font-medium">경쟁사 분석 보기 →</button>
        </div>
      )}

      {/* 성장 모멘텀 / 핵심 리스크 — 둘 다 없으면 섹션 자체 미노출 */}
      {(s.bull_case?.length || s.bear_case?.length) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BulletCallout title="성장 모멘텀" items={s.bull_case} boxCls="bg-navy-50 border border-navy-100" titleCls="text-navy-600" dotCls="bg-navy-400" />
          <BulletCallout title="핵심 리스크" items={s.bear_case} boxCls="bg-risk-bg border border-risk-border" titleCls="text-risk" dotCls="bg-risk" />
        </div>
      ) : null}

      {/* 최근 트리거 이벤트 — 이벤트 없으면 섹션 자체 미노출 */}
      {s.trigger_events && s.trigger_events.length > 0 && (
        <SectionCard title="최근 트리거 이벤트" dotColor="bg-navy-400">
          <div className="space-y-3">
            {s.trigger_events.map((ev, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="shrink-0 text-sm font-medium text-gray-400 w-20 pt-0.5">{ev.date}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mb-0.5">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-navy-50 text-navy-700">{ev.type}</span>
                    {ev.amount && <span className="text-sm font-medium text-gray-700">{ev.amount}</span>}
                    {ev.counterparty && <span className="text-sm text-gray-400">· {ev.counterparty}</span>}
                  </div>
                  <p className="text-base text-gray-700 leading-snug"><CitedText text={ev.description} /></p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {onTabChange && (
        <div className="flex justify-end">
          <button onClick={() => onTabChange('strategy')} className="text-sm text-navy-500 hover:text-navy-700 font-medium">전략 보기 →</button>
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
      <SectionCard title="경영 요약" dotColor="bg-navy-400">
        <div className="space-y-2">
          {lines.map((l, i) => (
            <p key={i} className="text-base text-gray-700 leading-relaxed">{l}</p>
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
                    <p className="text-base text-gray-700 leading-relaxed">{l}</p>
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
                    <p className="text-base text-gray-700 leading-relaxed">{l}</p>
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
              <div className="flex flex-col items-center w-12 shrink-0">
                <div className="w-12 h-12 rounded-full bg-navy-50 border-2 border-navy-300 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-navy-800 text-center leading-none px-0.5 whitespace-nowrap">{item.period.slice(0, 6)}</span>
                </div>
                {!isLast && <div className="w-0.5 bg-gray-100 flex-1 my-1 min-h-[2rem]" />}
              </div>
              <div className="pb-5 flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-base font-semibold text-gray-800">{item.title}</span>
                  <span className="text-sm text-navy-600 font-medium">{item.period}</span>
                </div>
                <div className="space-y-1 text-sm text-gray-600 mb-2">
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
                    {item.key_players.map((p, j) => <Tag key={j} label={p} color="navy" />)}
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
          className="w-full py-2 text-sm text-navy-500 hover:text-navy-600 bg-navy-50 hover:bg-navy-100 rounded-lg"
        >
          더 보기 ({h.timeline.length - LIMIT}개 더)
        </button>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BulletCallout title="지속 가능성" items={h.why_durable} boxCls="bg-navy-50 border border-navy-100" titleCls="text-navy-600" dotCls="bg-navy-400" />
        {h.chasm_points.length > 0 && (
          <div className="bg-navy-50 border border-navy-100 rounded-xl p-4">
            <div className="text-sm font-semibold uppercase tracking-widest text-navy-600 mb-2">캐즘 포인트</div>
            <div className="space-y-1.5">
              {h.chasm_points.map((c, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-[4px] w-1.5 h-1.5 rounded-full bg-navy-400 shrink-0" />
                  <p className="text-sm text-gray-700 leading-relaxed">{c}</p>
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
        {t.current_stage?.label && (
          <div className="bg-navy-50 border border-navy-100 rounded-xl p-4">
            <div className="text-sm font-semibold uppercase tracking-widest text-navy-600 mb-2">현재 단계</div>
            <div className="text-base font-semibold text-gray-800 mb-1">{t.current_stage.label}</div>
            {t.current_stage.detail && <p className="text-sm text-gray-600 leading-relaxed">{t.current_stage.detail}</p>}
          </div>
        )}
        {t.next_inflection?.label && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-sm font-semibold uppercase tracking-widest text-gray-600 mb-2">다음 변곡점</div>
            <div className="text-base font-semibold text-gray-800 mb-1">{t.next_inflection.label}</div>
            {t.next_inflection.detail && <p className="text-sm text-gray-600 leading-relaxed">{t.next_inflection.detail}</p>}
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
                    <div className="w-6 h-6 rounded-full bg-navy-50 border-2 border-navy-400 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-navy-800">{s.stage}</span>
                    </div>
                    <span className="text-base font-semibold text-gray-800">{s.title}</span>
                    <span className="text-sm text-navy-600 font-medium">{s.period}</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${hype.cls}`}>{hype.label}</span>
                  </div>
                  <p className="text-base text-gray-600 leading-relaxed mb-2">{s.description}</p>
                  <div className="space-y-1.5">
                    {s.key_enablers.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-400 shrink-0">Enablers</span>
                        {s.key_enablers.map((e, j) => <Tag key={j} label={e} color="navy" />)}
                      </div>
                    )}
                    {s.key_players.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-gray-400 shrink-0">Players</span>
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
      <SectionCard title="밸류체인 레이어" dotColor="bg-navy-400">
        <div className="flex flex-col items-stretch gap-0">
          {vc.layers.map((layer, i) => {
            const pp = layer.pricing_power ? (PRICING_POWER_CFG[layer.pricing_power] ?? PRICING_POWER_CFG.medium) : null;
            const cardCls = layer.is_subject
              ? 'border-navy-400 bg-navy-50 shadow-sm'
              : layer.buyer
              ? 'border-gray-300 bg-gray-50'
              : 'border-gray-200 bg-white';
            return (
              <div key={i} className="flex flex-col items-center">
                {/* 레이어 카드 */}
                <div className={`w-full rounded-xl border-2 px-4 py-3 ${cardCls}`}>
                  {/* 헤더 행 */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-base font-semibold ${layer.is_subject ? 'text-navy-700' : layer.buyer ? 'text-gray-800' : 'text-gray-800'}`}>
                        {layer.name}
                      </span>
                      {layer.is_subject && (
                        <span className="text-xs bg-navy-600 text-white rounded-full px-2 py-0.5 font-medium">분석 대상</span>
                      )}
                      {layer.bottleneck && (
                        <span className="text-xs bg-risk-bg text-risk border border-risk-border rounded-full px-2 py-0.5 font-medium">Bottleneck</span>
                      )}
                    </div>
                    {layer.buyer
                      ? <span className="text-xs bg-navy-100 text-navy-600 rounded-full px-2 py-0.5 font-medium">구매자</span>
                      : pp && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pp.cls}`}>{pp.label}</span>
                    }
                  </div>
                  {/* 설명 + 선도기업 */}
                  <p className="text-sm text-gray-500 leading-relaxed mb-2">{layer.description}</p>
                  {(layer.global_leaders ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(layer.global_leaders ?? []).map((leader, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">
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
          <BulletCallout title="가격 전가 메커니즘" items={vc.value_flow} boxCls="bg-navy-50 border border-navy-100" titleCls="text-navy-600" dotCls="bg-navy-400" />
          <BulletCallout title="분석 기업 포지션" items={vc.subject_position} boxCls="bg-navy-50 border border-navy-100" titleCls="text-navy-600" dotCls="bg-navy-400" />
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
        <SectionCard title="밸류체인 개요" dotColor="bg-navy-400">
          <p className="text-base text-gray-700 leading-relaxed">{data.value_chain_overview}</p>
        </SectionCard>
      )}
      {players.length > 0 && (
        <SectionCard title="주요 플레이어" dotColor="bg-navy-400">
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {flowNodes.flatMap((node, i) => [
              <div key={`node-${i}`} className={`rounded-lg px-3 py-2 text-sm text-center flex-1 min-w-[80px] ${
                node.isTarget ? 'bg-navy-50 border-2 border-navy-300 text-navy-800 font-medium' : 'bg-gray-50 text-gray-700'
              }`}>{node.label}</div>,
              i < flowNodes.length - 1 ? <span key={`arrow-${i}`} className="text-gray-300 text-base shrink-0">→</span> : null,
            ])}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p, i) => {
              const isTarget = p.player_name?.toLowerCase().includes(companyName) ||
                p.description?.toLowerCase().includes('분석 대상');
              return (
                <div key={i} className={`rounded-xl border p-4 ${isTarget ? 'border-navy-200 bg-navy-50' : 'border-gray-100 bg-white'}`}>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className={`text-sm font-semibold uppercase tracking-widest ${isTarget ? 'text-navy-500' : 'text-gray-400'}`}>{p.role}</span>
                    {isTarget && <span className="shrink-0 text-xs bg-navy-600 text-white rounded-full px-2 py-0.5 font-semibold">분석 대상</span>}
                  </div>
                  <div className="font-semibold text-gray-900 text-base mb-1.5">{p.player_name}</div>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.description}</p>
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
  const moat = bm.moat ?? [];
  // Revenue Streams는 이제 자체 description 필드를 갖는다(2026-08-15) — 예전엔 이름이
  // 일치하는 segments[].characteristics를 퍼지 매칭으로 끌어와 보여줬지만, revenue_share(%)와
  // 함께 segments를 화면에서 제거하면서 그 매칭 로직도 같이 정리했다.
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

      {/* Revenue Streams 전체 항상 표시 — 매출 비중(%)은 여기서 더 이상 안 보여준다(재무 탭의
          "매출 구성"만이 유일한 비중 출처, 2026-08-15). operating_margin/growth_rate는 그대로 유지. */}
      {revenueStreams.length > 0 && (
        <SectionCard title="Revenue Streams" dotColor="bg-navy-400">
          <div className="space-y-3">
            {revenueStreams.map((rs, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">{rs.name}</span>
                  <Tag label={rs.type} color="gray" />
                </div>
                {(rs.operating_margin !== 0 || rs.growth_rate !== 0) && (
                  <div className="flex gap-3 mt-1">
                    {rs.operating_margin !== 0 && (
                      <span className="text-xs text-gray-400">OPM {rs.operating_margin}%</span>
                    )}
                    {rs.growth_rate !== 0 && (
                      <span className={`text-xs ${rs.growth_rate > 0 ? 'text-navy-600' : 'text-risk'}`}>
                        {rs.growth_rate > 0 ? '+' : ''}{rs.growth_rate}% YoY
                      </span>
                    )}
                  </div>
                )}
                {rs.description && (
                  <p className="text-sm text-gray-400 mt-1 leading-snug">{rs.description}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Above fold: growth motion — 상세 서술 없으면 카드 자체 미노출 */}
      {bm.growth_motion_detail && (
        <SectionCard title="Growth Motion" dotColor="bg-navy-400">
          <div className="mb-3">
            <span className={`inline-flex items-center text-base font-semibold px-3 py-1.5 rounded-full ${gm.cls}`}>
              {gm.label}
            </span>
          </div>
          <p className="text-base text-gray-600 leading-relaxed">{bm.growth_motion_detail}</p>
        </SectionCard>
      )}

      {/* Below fold: unit economics + moat */}
      <ShowMore label="Unit Economics · 경제적 해자 보기">
        <>
          <SectionCard title="Unit Economics" dotColor="bg-navy-400">
            {ueMetrics.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {ueMetrics.map((m, i) => (
                  <MetricCard key={i} label={m.label} value={m.value} />
                ))}
              </div>
            ) : (
              <p className="text-base text-gray-400">데이터 없음</p>
            )}
          </SectionCard>

          {moat.length > 0 && (
            <SectionCard title="경제적 해자 (Moat)" dotColor="bg-gray-400">
              <div className="space-y-3">
                {moat.map((m, i) => {
                  const cfg = MOAT_STRENGTH_CFG[m.strength] ?? MOAT_STRENGTH_CFG.medium;
                  return (
                    <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base font-semibold text-gray-800">{m.type}</span>
                        <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full mb-2">
                        <div className={`${cfg.width} ${cfg.barColor} h-1.5 rounded-full`} />
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{m.description}</p>
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
    '강함': { width: 'w-[90%]', barColor: 'bg-navy-600' },
    '보통': { width: 'w-[60%]', barColor: 'bg-navy-400' },
    '약함': { width: 'w-[30%]', barColor: 'bg-gray-300' },
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
    '강함': 'bg-navy-100 text-navy-700',
    '보통': 'bg-navy-50 text-navy-600',
    '약함': 'bg-gray-100 text-gray-500',
  };
  // 리스크 심각도(높음/중간/낮음) — risk-red 계열 안에서 진하기로만 구분,
  // "낮음"은 사실상 리스크가 아니라는 신호로 gray 처리
  const severityStyle: Record<string, { bg: string; text: string }> = {
    '높음': { bg: 'bg-red-100',  text: 'text-red-800' },
    '중간': { bg: 'bg-risk-bg',  text: 'text-risk' },
    '낮음': { bg: 'bg-gray-100', text: 'text-gray-600' },
  };
  const riskGroups = risk ? ([
    { label: '비즈니스', data: risk.business },
    { label: '재무',     data: risk.financial },
    { label: '외부',     data: risk.external },
  ] as const).filter(g => (g.data?.items?.length ?? 0) > 0) : [];

  return (
    <div className="space-y-4">
      <SectionCard title="비즈니스 모델" dotColor="bg-navy-400">
        <div className="space-y-2">
          {ls.map((l, i) => <p key={i} className="text-base text-gray-700 leading-relaxed">{l}</p>)}
        </div>
      </SectionCard>

      {ueMetrics.length > 0 && (
        <SectionCard title="Unit Economics" dotColor="bg-navy-400">
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
                      <span className="text-base font-semibold text-gray-800">{t.name}</span>
                      <span className={`text-sm px-2.5 py-0.5 rounded-full font-medium ${moatBadge[t.strength] ?? 'bg-gray-100 text-gray-600'}`}>{t.strength}</span>
                    </div>
                    <MoatBar strength={t.strength} />
                    <p className="text-sm text-gray-600 leading-relaxed mt-2">{t.basis}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {moat.sustain_conditions && (
                <div className="bg-navy-50 border border-navy-100 rounded-lg p-3">
                  <div className="text-sm font-semibold uppercase tracking-widest text-navy-600 mb-1.5">유지 조건</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{moat.sustain_conditions}</p>
                </div>
              )}
              {moat.collapse_scenarios && (
                <div className="bg-risk-bg border border-risk-border rounded-lg p-3">
                  <div className="text-sm font-semibold uppercase tracking-widest text-risk mb-1.5">붕괴 시나리오</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{moat.collapse_scenarios}</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {riskGroups.length > 0 && (
        <SectionCard title="리스크 분석" dotColor="bg-risk">
          <div className="space-y-4">
            {riskGroups.map(({ label, data: g }) => {
              const sev = severityStyle[g.severity] ?? severityStyle['중간'];
              return (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">{label} 리스크</span>
                    <span className={`text-sm px-2.5 py-0.5 rounded-full font-semibold ${sev.bg} ${sev.text}`}>{g.severity}</span>
                  </div>
                  <table className="w-full text-sm">
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
        <span className="text-sm text-gray-400">경쟁 포지션</span>
        <span className={`text-base font-semibold px-3 py-1 rounded-full ${pos.cls}`}>{pos.label}</span>
      </div>

      {/* Above fold: top 3 direct competitors */}
      {topDirect.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-navy-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topDirect.map((comp, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-base">{comp.name}</span>
                  <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-sm font-medium">{flagOf(comp.country)} {comp.country}</span>
                </div>
                {comp.market_share && (
                  <div className="text-navy-600 font-medium text-sm">{comp.market_share}</div>
                )}
                {comp.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {comp.strengths.slice(0, 3).map((s, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-navy-400 shrink-0" />
                        <span className="text-sm text-gray-600">{s}</span>
                      </div>
                    ))}
                  </div>
                )}
                {comp.weaknesses.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {comp.weaknesses.slice(0, 2).map((w, j) => (
                      <div key={j} className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-risk shrink-0" />
                        <span className="text-sm text-gray-600">{w}</span>
                      </div>
                    ))}
                  </div>
                )}
                {comp.vs_subject && (
                  <div className="bg-navy-50 rounded-lg px-3 py-1.5">
                    <p className="text-sm text-navy-700 leading-relaxed">{comp.vs_subject}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {dataSource === 'edgar' && c.revenue_ranking && (
        <SectionCard title="매출 순위" dotColor="bg-navy-400">
          <p className="text-sm text-gray-400 mb-2">
            <CitedText text={`SIC ${c.revenue_ranking.sicCode} 동종업계, EDGAR ${c.revenue_ranking.totalCompanies}개사 중 매출 상위 ${c.revenue_ranking.top.length}개사${c.revenue_ranking.sourceIndex ? ` [${c.revenue_ranking.sourceIndex}]` : ''}`} />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left font-medium py-1.5 pr-2">순위</th>
                  <th className="text-left font-medium py-1.5 pr-2">기업명</th>
                  <th className="text-right font-medium py-1.5">매출</th>
                </tr>
              </thead>
              <tbody>
                {c.revenue_ranking.top.map((row) => (
                  <tr key={row.ticker} className={row.isSubject ? 'bg-navy-50 font-semibold text-navy-700' : 'text-gray-700'}>
                    <td className="py-1.5 pr-2">{row.rank}</td>
                    <td className="py-1.5 pr-2">{row.name} <span className="text-gray-400 font-normal">({row.ticker})</span></td>
                    <td className="py-1.5 text-right">{fmtGrowthRevenue(row.revenue, 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.revenue_ranking.subjectRank != null && (
            <p className="text-sm text-gray-500 mt-2">
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
              <SectionCard title="직접 경쟁사 (추가)" dotColor="bg-navy-400">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {restDirect.map((comp, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-gray-900 text-base">{comp.name}</span>
                        <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-sm font-medium">{flagOf(comp.country)} {comp.country}</span>
                      </div>
                      {comp.market_share && <div className="text-navy-600 font-medium text-sm">{comp.market_share}</div>}
                      {comp.vs_subject && (
                        <div className="bg-navy-50 rounded-lg px-3 py-1.5">
                          <p className="text-sm text-navy-700 leading-relaxed">{comp.vs_subject}</p>
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
                  <SectionCard title="간접 경쟁사" dotColor="bg-navy-300">
                    <div className="flex flex-wrap gap-2">
                      {c.indirect.map((comp, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="text-sm font-medium text-gray-700 mb-0.5">{comp.name}</div>
                          <div className="text-sm text-gray-400">{comp.threat}</div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}
                {c.substitutes.length > 0 && (
                  <SectionCard title="대체재" dotColor="bg-navy-400">
                    <div className="flex flex-wrap gap-2">
                      {c.substitutes.map((sub, i) => (
                        <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="text-sm font-medium text-gray-700 mb-0.5">{sub.name}</div>
                          <div className="text-sm text-gray-400">{sub.threat}</div>
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
        <span className="font-semibold text-gray-900 text-base">{comp.name}</span>
        {comp.country && <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-sm font-medium">{flagOf(comp.country)} {comp.country}</span>}
      </div>
      {comp.market_share && <div className="text-navy-600 font-medium text-base">{comp.market_share}</div>}
      {(comp.strengths?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {comp.strengths.slice(0, 3).map((s, j) => <Tag key={j} label={s} color="navy" />)}
        </div>
      )}
      {diff && (
        <>
          <p className={`text-sm text-gray-500 leading-relaxed ${!expanded && showToggle ? 'line-clamp-2' : ''}`}>{diff}</p>
          {showToggle && (
            <button onClick={() => setExpanded(v => !v)} className="text-sm text-navy-500 hover:text-navy-700 self-start">
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
    return <p className="text-base text-gray-500 py-4 text-center">경쟁사 데이터가 없습니다.</p>;
  }
  return (
    <div className="space-y-4">
      {direct.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-navy-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {direct.map((comp, i) => <CompetitorCard key={i} comp={comp} />)}
          </div>
        </SectionCard>
      )}
      {indirect.length > 0 && (
        <SectionCard title="간접 경쟁사 / 대체재" dotColor="bg-navy-400">
          <div className="flex flex-wrap gap-2">
            {indirect.map((comp, i) => (
              <span key={i} className="bg-gray-100 text-gray-600 rounded-full px-3 py-1 text-sm">
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
        <div className="text-base font-semibold text-gray-800 mb-1.5">{n.industry_pain.title}</div>
        <div className="mb-2">
          <BulletList items={n.industry_pain.description} textCls="text-base text-gray-600" dotCls="bg-amber-400" />
        </div>
        {n.industry_pain.financial_impact_question && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-sm text-amber-800 leading-relaxed">
            {n.industry_pain.financial_impact_question}
          </div>
        )}
      </SectionCard>

      {/* 2026-08-17 신규 — 위 산업 문제와 아래 타산업 사례가 왜 연결되는지 명시 (관찰
          기록: "사례가 뜬금없이 튀어나온 것처럼 보인다"는 지적 계기). 옛 캐시 데이터는
          필드 자체가 없을 수 있어 조건부 렌더링. */}
      {n.connection_insight && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-gray-100 rounded-lg">
          <ArrowDown size={14} className="text-navy-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">연결고리</div>
            <p className="text-base text-gray-700 leading-relaxed italic">{n.connection_insight}</p>
          </div>
        </div>
      )}

      <SectionCard title="타산업 해결 사례" dotColor="bg-navy-400">
        <div className="flex items-center gap-2 mb-1.5">
          <Tag label={n.cross_industry_example.source_industry} color="navy" />
          <span className="text-base font-semibold text-gray-800">{n.cross_industry_example.case_name}</span>
        </div>
        <CitedText text={n.cross_industry_example.solution_description} className="text-base text-gray-600 leading-relaxed block" />
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
      dotColor: 'bg-navy-400',
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
      dotColor: 'bg-navy-400',
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
      dotColor: 'bg-navy-400',
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
              <div className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${sec.dotColor}`} />
                {sec.label}
                <span className="text-gray-300 font-normal normal-case tracking-normal">({sec.sub})</span>
              </div>
              {sec.direction && (
                <p className="text-base font-semibold text-gray-800 leading-snug mb-3 pl-3.5">{sec.direction}</p>
              )}
              {sec.bullets.length > 0 && (
                <div className="space-y-1.5 pl-3.5">
                  {sec.bullets.map((b, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <span className="mt-[5px] w-1 h-1 rounded-full bg-gray-300 shrink-0" />
                      <p className="text-sm text-gray-600 leading-relaxed">{b}</p>
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

      {(s.strategy_coherence || s.ten_year_durability?.length) ? (
        <ShowMore label="전략 수렴 · 지속가능성 보기">
          <div className="space-y-3 pb-1">
            {s.strategy_coherence && (
              <div className="bg-white border-2 border-navy-200 rounded-xl p-4">
                <div className="text-sm font-semibold uppercase tracking-widest text-navy-500 mb-2">전략 수렴</div>
                {/* 백엔드가 strategy_coherence를 2~3개 문단(빈 줄로 구분, "\n\n")으로 나눠 보내므로
                    whitespace-pre-line으로 줄바꿈을 실제로 살린다 — 기본 white-space:normal이면
                    \n이 공백으로 뭉개져서 여전히 한 덩어리 문단처럼 보인다. */}
                <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">{s.strategy_coherence}</p>
              </div>
            )}
            <BulletCallout title="10년 지속 가능성" items={s.ten_year_durability} boxCls="bg-navy-50 border border-navy-100" titleCls="text-navy-600" dotCls="bg-navy-400" />
          </div>
        </ShowMore>
      ) : null}

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
          ? <span key={i} className="bg-navy-50 text-navy-700 px-1.5 py-0.5 rounded text-sm font-medium mx-0.5">{p}</span>
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function StrategyTab({ data }: { data: AnalysisDetail }) {
  const s = data.strategy as StrategyAnalysis | null;
  if (!s || (!s.corporate && !s.business && !s.financial)) {
    return <p className="text-base text-gray-500 py-4 text-center">전략 데이터가 없습니다.</p>;
  }

  const sections = [
    {
      label: '기업 전략', dotColor: 'bg-navy-400',
      headline: s.corporate?.portfolio_direction,
      items: s.corporate ? [
        { label: 'M&A / 파트너십', value: s.corporate.ma_partnership },
        { label: '지역 확장', value: s.corporate.regional_expansion },
        ...(s.corporate.notes ? [{ label: '비고', value: s.corporate.notes }] : []),
      ] : [],
    },
    {
      label: '사업 전략', dotColor: 'bg-navy-400',
      headline: s.business?.competitive_advantage,
      items: s.business ? [
        { label: '고객 / 채널', value: s.business.customer_channel },
        { label: '제품 로드맵', value: s.business.product_roadmap },
        ...(s.business.notes ? [{ label: '비고', value: s.business.notes }] : []),
      ] : [],
    },
    {
      label: '재무 전략', dotColor: 'bg-navy-400',
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
              <div className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${sec.dotColor}`} />
                {sec.label}
              </div>
              {headlineTrunc && (
                <p className="text-base font-medium text-gray-800 leading-snug mb-3 pl-3.5">
                  <HighlightNumbers text={headlineTrunc} />
                </p>
              )}
              {filledItems.length > 0 && (
                <div>
                  {filledItems.map((item, i) => (
                    <div key={i} className={`flex gap-3 items-start py-2.5 ${i < filledItems.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <span className="shrink-0 w-24 text-sm text-gray-400 pt-0.5 leading-tight">{item.label}</span>
                      <p className="text-base text-gray-700 leading-relaxed flex-1">
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
      <span className="text-xs text-gray-400 w-36 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all`} style={{ width: `${widthPct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-700 w-16 text-right shrink-0">{value.toFixed(decimals)}{unit}</span>
    </div>
  );
}

function SecBenchmarkComparisonBlock({ comparison }: { comparison: SecBenchmarkComparison }) {
  const { language } = useLanguage();
  const chartT = getUiStrings(language).benchmarkChart;
  if (comparison.status === 'insufficient_sample') {
    return (
      <SectionCard title="동종업계 비교 (SEC)" dotColor="bg-navy-400">
        <p className="text-sm text-gray-500 leading-relaxed">
          이 업종(SIC {comparison.sicCode})은 공개 동종업계 비교 표본이 적어(최대 {comparison.maxN ?? 0}개사) 벤치마크 비교가 제한적이에요. 재무 상황은 직접 확인하는 게 더 정확할 수 있어요.
        </p>
      </SectionCard>
    );
  }
  if (!comparison.items?.length) return null;
  return (
    <SectionCard title="동종업계 비교 (SEC)" dotColor="bg-navy-400">
      <div className="space-y-4">
        {comparison.items.map((item, i) => {
          const maxAbs = Math.max(Math.abs(item.companyValue), Math.abs(item.median)) || 1;
          return (
            <div key={i} className={i > 0 ? 'pt-4 border-t border-gray-100' : ''}>
              <div className="text-sm font-semibold text-gray-700 mb-2">{item.label}</div>
              <div className="space-y-1.5">
                <SecBenchmarkBar label={chartT.thisCompany} value={item.companyValue} unit={item.unit} colorClass="bg-navy-500" maxAbs={maxAbs} />
                <SecBenchmarkBar label={`${chartT.industryMedian}(n=${item.n})`} value={item.median} unit={item.unit} colorClass="bg-gray-300" maxAbs={maxAbs} />
              </div>
              {item.interpretation && (
                <p className="text-sm text-gray-500 leading-relaxed mt-2">{item.interpretation}</p>
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
    return n.startsWith('▲') ? 'text-navy-600 font-medium' : 'text-risk font-medium';
  };


  const cfDots: Record<string, string> = {
    'Operating CF':  'bg-navy-600',
    'Investing CF':  'bg-navy-400',
    'Financing CF':  'bg-gray-400',
    'FCF':           'bg-navy-800',
  };

  // 데이터 신뢰도 요약 — 이 탭에 표시되는 필드들 중 (추정) 배지 / 확인 필요(플레이스홀더) 값 카운트
  const { estimatedCount, unknownCount } = useMemo(() => countFinancialsReliability(f), [f]);

  // 회사마다 실제로 보유한 회계연도만 컬럼으로 렌더링 — 고정 fy2021~fy2025/fy2023~fy2025
  // 리터럴을 가정하지 않는다(신규 상장사는 짧은 이력만, 오래된 기업은 최대 5개년).
  const isYearCols = useMemo(
    () => Array.from(new Set(f.income_statement.flatMap(getFinancialYearCols))).sort(),
    [f.income_statement],
  );
  const bsYearCols = useMemo(
    () => Array.from(new Set(f.balance_sheet.flatMap(getFinancialYearCols))).sort(),
    [f.balance_sheet],
  );
  // 마지막 직전 연도(=가장 최근으로 확정된 회계연도)를 강조 — 최신 연도는 (추정)일 수 있어
  // 기존에도 항상 최신이 아니라 그 직전 연도를 강조해왔다(예전 고정 5칸 땐 fy2024 강조).
  const isHighlightCol = isYearCols.length >= 2 ? isYearCols[isYearCols.length - 2] : isYearCols[0];
  const bsHighlightCol = bsYearCols.length >= 2 ? bsYearCols[bsYearCols.length - 2] : bsYearCols[0];

  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={f.key_bullets} />
      {(estimatedCount > 0 || unknownCount > 0) && (
        <p className="text-sm text-source-reference bg-source-reference-bg border border-source-reference-border rounded-lg px-3 py-2">
          ⚠️ 이 리포트에는 추정값 {estimatedCount}건, 확인 필요 데이터 {unknownCount}건이 포함되어 있습니다
        </p>
      )}
      {/* 데이터 출처 뱃지 + Refresh 버튼 */}
      <div className="flex items-center justify-between">
        {dataSource === 'edgar' ? (
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L1.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L1}`} />🟢 SEC EDGAR 공식
          </span>
        ) : dataSource === 'dart' ? (
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L1.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L1}`} />🟢 DART 공식
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full ${LEVEL_BADGE.L3.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${LEVEL_DOT.L3}`} />⚪ 웹 검색 추정치
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 text-sm text-navy-600 hover:text-navy-800 bg-navy-50 hover:bg-navy-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? '새로고침 중...' : '데이터 새로고침'}
        </button>
      </div>

      {/* 업종 벤치마크 — EDGAR 기업 전용, 표본 부족 지표는 서버가 이미 배열에서 제외함 */}
      {dataSource === 'edgar' && f.industry_benchmark && (
        <SectionCard title="업종 벤치마크" dotColor="bg-navy-400">
          <div className="space-y-1.5">
            {f.industry_benchmark.metrics.map((m) => (
              <p key={m.key} className="text-base text-gray-700 leading-relaxed">
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

      {/* Income statement */}
      {f.income_statement.length > 0 && (
        <SectionCard title="손익계산서 (I/S)" dotColor="bg-navy-400">
          <VirtualTable
            rows={f.income_statement}
            colTemplate={`minmax(100px,1.5fr) repeat(${isYearCols.length},1fr) 80px`}
            minWidth={520}
            maxVisible={10}
            header={
              <>
                <span className="py-2 pr-3 text-sm font-semibold uppercase tracking-widest text-gray-400">항목</span>
                {isYearCols.map(col => (
                  <span key={col} className={`py-2 px-2 text-right text-sm font-semibold uppercase tracking-widest whitespace-nowrap ${col === isHighlightCol ? 'text-gray-600' : 'text-gray-400'}`}>
                    {col.replace('fy', 'FY')}
                  </span>
                ))}
                <span className="py-2 px-2 text-right text-sm font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</span>
              </>
            }
            renderRow={(row: FinancialsV2Row) => {
              const isBold = IS_BOLD_ITEMS.some(b => row.item.includes(b));
              return (
                <>
                  <span className={`py-2.5 pr-3 text-sm truncate ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</span>
                  {isYearCols.map(col => (
                    <span key={col} className={`py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap ${isBold && col === isHighlightCol ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                      <FinancialValue text={row[col] ?? '—'} dataSource={dataSource} />
                    </span>
                  ))}
                  <span className={`py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap ${yoyCls(row.yoy)}`}><DataValue text={normalizeYoy(row.yoy)} /></span>
                </>
              );
            }}
          />
        </SectionCard>
      )}

      {/* 매출 구성 — 회사가 실제 10-K에서 라인 구분해 공시한 경우만(서버가 R.htm에서 직접
          파싱, Claude 미생성) — 축이 사업부든 제품군이든 그 회사가 쓴 라벨 그대로. 라인 구분이
          없는 회사(f.revenue_lines가 undefined)는 이 섹션 자체를 스킵한다. */}
      {f.revenue_lines && f.revenue_lines.length > 0 && (
        <SectionCard title="매출 구성" dotColor="bg-navy-400">
          <div className="space-y-3">
            {f.revenue_lines.map((rl, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">{rl.label}</span>
                  <span className="text-sm font-medium text-gray-800">{rl.value} ({rl.sharePct}%)</span>
                </div>
                <ProgressBar value={rl.sharePct} color={BAR_COLORS[i % BAR_COLORS.length]} />
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-400 mt-3">10-K 손익계산서에 실제로 공시된 라인만 표시 — 비중(%)은 서버가 단순 계산, 추정치 아님</p>
        </SectionCard>
      )}

      {/* Below fold: Balance sheet, Cash flow, Key risks */}
      <ShowMore label="재무상태표 · 현금흐름 보기">
        <>
          {f.balance_sheet.length > 0 && (
            <SectionCard title="재무상태표 (B/S)" dotColor="bg-navy-400">
              <VirtualTable
                rows={f.balance_sheet}
                colTemplate={`minmax(130px,1.5fr) repeat(${bsYearCols.length},1fr)`}
                minWidth={380}
                maxVisible={10}
                header={
                  <>
                    <span className="py-2 pr-3 text-sm font-semibold uppercase tracking-widest text-gray-400">항목</span>
                    {bsYearCols.map(col => (
                      <span key={col} className={`py-2 px-2 text-right text-sm font-semibold uppercase tracking-widest whitespace-nowrap ${col === bsHighlightCol ? 'text-gray-600' : 'text-gray-400'}`}>
                        {col.replace('fy', 'FY')}
                      </span>
                    ))}
                  </>
                }
                renderRow={(row: FinancialsV2Row) => {
                  const isBold = ['총자산', '총부채', '자본총계', 'Total Assets', 'Total Liabilities', 'Total Equity'].includes(row.item);
                  return (
                    <>
                      <span className={`py-2.5 pr-3 text-sm truncate ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</span>
                      {bsYearCols.map(col => (
                        <span key={col} className={`py-2.5 px-2 text-right font-mono text-sm whitespace-nowrap ${isBold && col === bsHighlightCol ? 'font-semibold text-gray-800' : isBold ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                          <FinancialValue text={row[col] ?? '—'} dataSource={dataSource} />
                        </span>
                      ))}
                    </>
                  );
                }}
              />
            </SectionCard>
          )}

          {(f.cash_flow.operating || f.cash_flow.fcf) && (
            <SectionCard title="현금흐름 (C/F)" dotColor="bg-navy-400">
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
                <p className="mt-3 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{f.cash_flow.notes}</p>
              )}
            </SectionCard>
          )}

          {f.key_risks.length > 0 && (
            <SectionCard title="핵심 리스크" dotColor="bg-risk">
              <div className="space-y-1.5">
                {f.key_risks.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-[5px] w-1.5 h-1.5 rounded-full bg-risk shrink-0" />
                    <p className="text-base text-gray-700 leading-relaxed">{r}</p>
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
    return v.startsWith('▲') ? 'text-navy-600 font-medium' : v.startsWith('▼') ? 'text-risk font-medium' : 'text-gray-500';
  };

  const cfDots: Record<string, string> = {
    '영업활동 CF': 'bg-navy-600', '투자활동 CF': 'bg-navy-400',
    '재무활동 CF': 'bg-gray-400', 'Free Cash Flow': 'bg-navy-800',
  };

  return (
    <div className="space-y-4">
      {data.financials && (
        <SectionCard title="재무 서사" dotColor="bg-navy-400">
          <div className="space-y-1.5">
            {splitLines(data.financials).map((l, i) => (
              <p key={i} className="text-base text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {hasStructured ? (
        <>
          {(fs!.income_statement?.length ?? 0) > 0 && (
            <SectionCard title="손익계산서 (I/S)" dotColor="bg-navy-400">
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-sm font-semibold uppercase tracking-widest text-gray-400 min-w-[110px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className={`text-right py-2 px-3 text-sm font-semibold uppercase tracking-widest whitespace-nowrap ${y === 'FY2024' ? 'text-gray-600' : 'text-gray-400'}`}>{y}</th>
                      ))}
                      <th className="text-right py-2 px-3 text-sm font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.income_statement.map((row, i) => {
                      const isMedium = IS_MEDIUM_ITEMS.some(b => row.item.includes(b));
                      return (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className={`py-2.5 pr-4 text-sm ${isMedium ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-sm whitespace-nowrap ${isMedium ? 'font-medium text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-sm whitespace-nowrap ${yoyCls(row.yoy)}`}>{normalizeYoy(row.yoy)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
          {(fs!.balance_sheet?.length ?? 0) > 0 && (
            <SectionCard title="재무상태표 (B/S)" dotColor="bg-navy-400">
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-sm font-semibold uppercase tracking-widest text-gray-400 min-w-[130px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className={`text-right py-2 px-3 text-sm font-semibold uppercase tracking-widest whitespace-nowrap ${y === 'FY2024' ? 'text-gray-600' : 'text-gray-400'}`}>{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.balance_sheet.map((row, i) => {
                      const isBold = BS_SECTION_HEADERS.includes(row.item);
                      return (
                        <tr key={i} className={`hover:bg-gray-50/50 ${isBold ? 'bg-gray-50' : ''}`}>
                          <td className={`py-2.5 pr-4 text-sm ${isBold ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-sm whitespace-nowrap ${isBold ? 'font-medium text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-sm text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
          {fs!.cash_flow && (
            <SectionCard title="현금흐름 (C/F)" dotColor="bg-navy-400">
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
                <p className="mt-3 text-sm text-gray-500 leading-relaxed border-t border-gray-50 pt-3">{fs!.cash_flow.notes}</p>
              )}
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard title="재무 현황" dotColor="bg-navy-400">
          <div className="space-y-2">
            {rawLines.map((l, i) => (
              <p key={i} className="text-base text-gray-700 leading-relaxed">{l}</p>
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
  exit:      { label: 'Exit',    cls: 'bg-navy-100 text-navy-700' },
  closed:    { label: '폐업',    cls: 'bg-risk-bg text-risk' },
  operating: { label: '운영 중', cls: 'bg-gray-100 text-gray-600' },
};

const EXIT_TYPE_CFG: Record<string, { label: string; cls: string }> = {
  'M&A': { label: 'M&A',  cls: 'bg-navy-50 text-navy-700' },
  'IPO': { label: 'IPO',  cls: 'bg-navy-100 text-navy-700' },
};

const FounderV2Tab = memo(function FounderV2Tab({ f }: { f: FounderV2 }) {
  const isSerial = f.founding_history.type === 'serial';
  return (
    <div className="space-y-4">
      {/* Key bullets */}
      <KeyBulletsBlock bullets={f.key_bullets} />

      {/* Founder profiles */}
      {f.founders.length > 0 && (
        <SectionCard title="기본 정보" dotColor="bg-navy-400">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {f.founders.map((fd, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">{fd.name}</span>
                  {fd.title && fd.title !== '-' && (
                    <span className="text-sm bg-navy-100 text-navy-700 rounded-full px-2 py-0.5 font-medium">{fd.title}</span>
                  )}
                </div>
                {fd.education && fd.education !== '-' && (
                  <div className="flex gap-2 text-sm text-gray-600">
                    <span className="text-gray-400 shrink-0 w-10">학교</span>
                    <span>{fd.education}</span>
                  </div>
                )}
                {fd.major && fd.major !== '-' && (
                  <div className="flex gap-2 text-sm text-gray-600">
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
        <SectionCard title="커리어 궤적" dotColor="bg-navy-400">
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
                  <div className="flex flex-col items-center w-12 shrink-0">
                    <div className="w-12 h-12 rounded-full bg-navy-50 border-2 border-navy-300 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-navy-800 text-center leading-none px-0.5 whitespace-nowrap">{item.period.slice(0, 6)}</span>
                    </div>
                    {!isLast && <div className="w-0.5 bg-gray-100 flex-1 my-1 min-h-[2rem]" />}
                  </div>
                  <div className="pb-4 flex-1 min-w-0 pt-1">
                    <div className="text-base font-semibold text-gray-800">{item.company}</div>
                    <div className="text-sm text-gray-500 mt-0.5">{item.role}</div>
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
          <SectionCard title="창업 이력" dotColor="bg-navy-400">
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-base font-semibold px-3 py-1 rounded-full ${isSerial ? 'bg-navy-100 text-navy-700' : 'bg-gray-100 text-gray-600'}`}>
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
                      <span className="text-sm font-medium text-gray-800 flex-1">{v.name}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${res.cls}`}>{res.label}</span>
                      {exitType && (
                        <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${exitType.cls}`}>{exitType.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">이전 창업 이력 없음</p>
            )}
          </SectionCard>

          {(f.reputation.sns_style !== '-' || f.reputation.media_exposure !== '-' || f.reputation.blind_glassdoor !== '-') && (
            <SectionCard title="평판 & 퍼블릭 시그널" dotColor="bg-navy-400">
              <div className="space-y-2">
                {f.reputation.sns_style !== '-' && (
                  <div className="flex gap-3 items-start py-2 border-b border-gray-50">
                    <span className="shrink-0 w-20 text-sm text-gray-400 pt-0.5">SNS 스타일</span>
                    <p className="text-base text-gray-700 leading-relaxed flex-1">{f.reputation.sns_style}</p>
                  </div>
                )}
                {f.reputation.media_exposure !== '-' && (
                  <div className="flex gap-3 items-start py-2 border-b border-gray-50">
                    <span className="shrink-0 w-20 text-sm text-gray-400 pt-0.5">미디어 노출</span>
                    <p className="text-base text-gray-700 leading-relaxed flex-1">{f.reputation.media_exposure}</p>
                  </div>
                )}
                {f.reputation.blind_glassdoor !== '-' && (
                  <div className="flex gap-3 items-start py-2">
                    <span className="shrink-0 w-20 text-sm text-gray-400 pt-0.5">Blind / GD</span>
                    <p className="text-base text-gray-700 leading-relaxed flex-1">{f.reputation.blind_glassdoor}</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {(f.network.investors.length > 0 || f.network.advisors_board.length > 0 || f.network.cofounders.length > 0) && (
            <SectionCard title="네트워크" dotColor="bg-navy-400">
              <div className="space-y-3">
                {f.network.cofounders.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1.5">공동창업팀</div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.network.cofounders.map((c, i) => <Tag key={i} label={c} color="navy" />)}
                    </div>
                  </div>
                )}
                {f.network.investors.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1.5">투자자</div>
                    <div className="flex flex-wrap gap-1.5">
                      {f.network.investors.map((inv, i) => <Tag key={i} label={inv} color="navy" />)}
                    </div>
                  </div>
                )}
                {f.network.advisors_board.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-1.5">어드바이저 / 보드</div>
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
        className="w-full py-2 text-sm text-navy-500 hover:text-navy-600 bg-navy-50 hover:bg-navy-100 rounded-lg flex items-center justify-center gap-1.5 mt-1"
      >
        {open ? '접기 ↑' : `${label} ↓`}
      </button>
    </>
  );
}

// 배치 응답은 성공(callSection() OK)으로 왔지만 hasTabData()가 실제 콘텐츠를 못 찾은 경우
// (간헐적 Claude JSON 파싱 실패로 DEFAULT_ANALYSIS_DATA 빈 placeholder가 저장된 케이스,
// 2026-08-15 Ford value_chain_v2 실측) 전용 — data.X 자체가 없는 "생성 전"과는 다른 상태라
// 기존 legacy 폴백 탭(ValueChainTab 등)으로 보내지 않고 별도의 명시적 실패 안내 + 재분석
// CTA를 보여준다. onReanalyze가 없으면(히스토리/공유 등 읽기 전용 화면) 버튼 자체를 숨긴다.
function EmptySectionState({ message, onReanalyze, reanalyzeLabel }: { message: string; onReanalyze?: () => void; reanalyzeLabel?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <p className="text-base text-gray-500 max-w-xs leading-relaxed">{message}</p>
      {onReanalyze && (
        <button
          onClick={onReanalyze}
          className="px-4 py-2 text-base font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-xl transition-colors"
        >
          {reanalyzeLabel}
        </button>
      )}
    </div>
  );
}

// 스크롤-스택 문서(2026-08-17)의 섹션 하나 — 구 탭 콘텐츠 패널을 대체. id는 상단 sticky
// 그리드의 jumpToSection()이 scrollIntoView로 찾는 앵커. scroll-mt로 sticky 그리드에
// 가려지지 않게 오프셋을 준다.
function ReportSection({ id, title, icon: Icon, children, getMarkdown, uiT }: {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  // 이 카드 자체의 데이터만 참조하는 마크다운 생성 함수 — 헤더의 "이 탭 복사"
  // (getActiveTabMarkdown, tab state 기반)와 별개로 각 카드가 자기 콘텐츠만 안다.
  getMarkdown: () => string;
  uiT: ReturnType<typeof getUiStrings>;
}) {
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
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div
      id={`section-${id}`}
      className="scroll-mt-20 rounded-xl border p-5 border-gray-100 bg-white"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-gray-400" />
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title={copied ? uiT.actions.copied : uiT.actions.copySection}
            aria-label={copied ? uiT.actions.copied : uiT.actions.copySection}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={scrollToTop}
            title={uiT.actions.scrollToTop}
            aria-label={uiT.actions.scrollToTop}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

// 출처(신규, 2026-08-17) — 각 섹션 하단에 이미 개별 표시되는 출처와 별개로 전 섹션 출처를
// 한 곳에 모은 통합 목록(PDF의 "마지막 페이지 통합 출처 목록"과 동일한 개념). 각 섹션의
// 실제 렌더링 컴포넌트가 쓰는 것과 동일한 출처 소스(자체 .sources 필드 우선, 없으면
// data.sources 폴백)를 그대로 재사용 — 신규 데이터 없음, 신규 렌더링만.
function buildSourceGroups(data: AnalysisDetail, uiT: ReturnType<typeof getUiStrings>): Array<{ label: string; sources: Source[] | undefined }> {
  return [
    { label: uiT.tabs.summary.label,              sources: data.summary_v2?.sources ?? data.sources?.summary },
    { label: uiT.tabs.value_chain.label,           sources: data.value_chain_v2?.sources ?? data.sources?.value_chain },
    { label: uiT.tabs.business_model.label,        sources: data.business_model_v2?.sources ?? data.sources?.business_model },
    { label: uiT.tabs.competitors.label,           sources: data.competitors_v2?.sources ?? data.sources?.competitors },
    { label: uiT.tabs.cross_industry_nudge.label,  sources: data.cross_industry_nudge_v1?.sources },
    { label: uiT.tabs.financials.label,            sources: data.financials_v2?.sources ?? data.sources?.financials },
    { label: uiT.tabs.strategy.label,              sources: data.strategy_v2?.sources ?? data.sources?.strategy },
    { label: uiT.tabs.industry_history.label,      sources: data.industry_history_v2?.sources ?? data.sources?.industry_history },
    { label: uiT.tabs.tech_evolution.label,        sources: data.tech_evolution_v2?.sources ?? data.sources?.tech_evolution },
  ].filter(g => g.sources?.length);
}

function sourcesToMd(data: AnalysisDetail, uiT: ReturnType<typeof getUiStrings>): string {
  const groups = buildSourceGroups(data, uiT);
  if (groups.length === 0) return '';
  const body = groups.map(g => mdSourcesBlock(g.sources, g.label)).join('\n\n');
  return `## ${uiT.home.progressCardSources}\n\n${body}`;
}

function AllSourcesSummary({ data, uiT }: { data: AnalysisDetail; uiT: ReturnType<typeof getUiStrings> }) {
  const groups = buildSourceGroups(data, uiT);

  if (groups.length === 0) {
    return <p className="text-base text-gray-500 py-4 text-center">아직 표시할 출처가 없습니다.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map(g => (
        <div key={g.label}>
          <p className="text-sm font-semibold text-gray-500 mb-1">{g.label}</p>
          <SourcesList sources={g.sources} />
        </div>
      ))}
    </div>
  );
}

// 섹션 로딩 UI 공통 컴포넌트 — 배치 스트리밍(최초 생성)/탭별 재분석/ICP 인사이트 생성
// 전부 이 하나로 통일한다(2026-08-15, "산업역사 탭만 스피너+예상 소요시간, 나머지는
// 스켈레톤 shimmer"였던 불일치 해소 — 예전엔 SummarySkeleton/CardsSkeleton/TableSkeleton/
// FounderSkeleton 4종이 섹션마다 제각각 있었으나 전부 이 컴포넌트로 대체되어 삭제됨).
// 스켈레톤(콘텐츠 모양을 흉내낸 shimmer)과 달리 "지금 이 요청으로 실제 생성 중"임을
// 명시적으로 알리고, suffix로 기대 대기시간을 안내해 "로딩만 계속 돈다"는 오인을
// 방지한다(financials 새로고침 버튼과 동일한 철학). 배치5(Pain Diagnosis 포함)가 2026-08-16
// 부터 다른 배치와 동일하게 병렬 실행되면서 모든 섹션이 sectionGeneratingSuffixShort
// ("최대 1~2분")로 통일됨.
function SectionGenerating({ label, suffix }: { label: string; suffix: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
      <RefreshCw size={20} className="animate-spin" />
      <span className="text-base">{label}{suffix}</span>
    </div>
  );
}

// ── Growth Scenario (몬테카를로, 프리미엄 전용) ─────────────────────────────────
// CAGR 계산/포맷과 매출 포맷(fmtGrowthRevenue)은 PDF(AnalysisPdf.tsx)와 동일한 숫자를
// 보여줘야 해서 client/src/lib/growthScenario.ts 공용 유틸에서 import(중복 구현 금지,
// 2026-08-16 — 상세는 그 파일 헤더 주석 참고).

const SCENARIO_LABEL = { p10: '보수적 시나리오', p50: '예상 시나리오', p90: '낙관적 시나리오' } as const;

function GrowthScenarioV2Tab({ g }: { g: GrowthScenarioV2 }) {
  const years = g.simulation.p50.length;
  const stats = g.stats;
  const cagr = {
    p10: calcCagr(g.simulation.p10),
    p50: calcCagr(g.simulation.p50),
    p90: calcCagr(g.simulation.p90),
  };
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
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${isHigh ? 'bg-source-official/20 text-source-official' : 'bg-source-reference/20 text-source-reference'}`}>
            {isHigh ? '🟢 공식' : '🟡 참고'}
          </span>
          <span className="text-sm text-gray-400">{sampleLabel} 기반</span>
        </div>
        <p className="text-base leading-relaxed">
          {g.narrative ?? '몬테카를로 시뮬레이션(1만회) 기반 매출 성장 시나리오입니다.'}
        </p>
      </div>

      {!isHigh && (
        <p className="text-sm text-source-reference bg-source-reference-bg border border-source-reference-border rounded-lg px-3 py-2">
          이 기업의 공식 재무 데이터가 부족해 동종업계 벤치마크 기반 추정치를 사용했어요. 실제 편차는 더 클 수 있습니다.
        </p>
      )}

      {/* 라인 + 신뢰구간 밴드 차트 */}
      <div>
        <h4 className="text-base font-semibold text-gray-700 mb-3">연도별 매출 시나리오</h4>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['p10', 'p50', 'p90'] as const).map(k => (
            <div key={k} className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-center">
              <p className="text-xs text-gray-400 mb-0.5">{SCENARIO_LABEL[k].replace(' 시나리오', '')} CAGR</p>
              <p className="text-base font-semibold text-gray-900">{fmtCagr(cagr[k])}</p>
            </div>
          ))}
        </div>
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
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-navy-600 inline-block" />{SCENARIO_LABEL.p50}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-navy-200 inline-block" />{SCENARIO_LABEL.p10} ~ {SCENARIO_LABEL.p90} 범위</span>
        </div>
      </div>

      <div>
        <table className="w-full text-base">
          <thead>
            <tr className="text-gray-400 text-sm border-b border-gray-200">
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
        <h4 className="text-base font-semibold text-gray-700 mb-3">최종 연도 매출 분포</h4>
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={histData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="count" fill="#93c5fd" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-sm text-gray-400">
        {isHigh ? '🟢 공식' : '🟡 참고'} — {sampleLabel} 기반 통계적 시뮬레이션이며, 실제 미래 실적을 보장하지 않습니다.
      </p>
    </div>
  );
}

function GrowthScenarioLocked() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <Lock size={28} className="text-gray-300" />
      <p className="text-base text-gray-500">성장 시나리오는 프리미엄 전용 기능이에요</p>
      <button
        type="button"
        className="px-4 py-2 rounded-xl bg-navy-600 text-white text-sm font-medium hover:bg-navy-700 transition-colors"
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

function mdSourcesBlock(sources: Source[] | undefined, label = '출처'): string {
  if (!sources?.length) return '';
  const lines = sources.map((s, i) => {
    const idx = s.index ?? i + 1;
    return `[${idx}] ${s.organization}${s.date ? ` — ${s.date}` : ''}: ${s.content}${s.isEstimate ? ' (추정)' : ''}`;
  });
  return `**${label}**\n${lines.join('\n')}`;
}

function summaryToMd(s: SummaryV2, sources: Source[] | undefined): string {
  const cc = s.customer_concentration;
  const body = mdJoin([
    s.oneLiner,
    s.key_bullets?.length ? `**핵심 요약**\n${mdList(s.key_bullets)}` : '',
    s.key_metrics.length ? `**핵심 지표**\n${mdList(s.key_metrics.map(m => `${m.label}: ${m.value}`))}` : '',
    s.products.length ? `**주요 제품/서비스**\n${mdList(s.products.map(p => p.description ? `${p.name} — ${p.description}` : p.name))}` : '',
    s.key_markets.length ? `**주요 시장**\n${mdList(s.key_markets.map(m => `${m.country} — ${m.revenue_share}%`))}` : '',
    s.top_customers.length ? `**주요 고객사**: ${s.top_customers.join(', ')}` : '',
    cc && cc.top_n_share > 0 ? `상위 ${cc.top_n}개 고객이 매출 ${cc.top_n_share}% 차지${cc.trend === 'diversifying' ? ' (다변화 진행 중)' : cc.trend === 'concentrating' ? ' (집중도 심화)' : ''}` : '',
    s.bull_case?.length ? `**성장 모멘텀**\n${mdList(s.bull_case)}` : '',
    s.bear_case?.length ? `**핵심 리스크**\n${mdList(s.bear_case)}` : '',
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
    h.why_durable?.length ? `**지속 가능성**\n${mdList(h.why_durable)}` : '',
    h.chasm_points.length ? `**캐즘 포인트**\n${mdList(h.chasm_points)}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 산업역사\n\n${body}` : '';
}

function techEvolutionToMd(t: TechEvolutionV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    t.key_bullets?.length ? `**핵심 요약**\n${mdList(t.key_bullets)}` : '',
    t.current_stage?.label ? `**현재 단계**: ${t.current_stage.label}${t.current_stage.detail ? ' — ' + t.current_stage.detail : ''}` : '',
    t.next_inflection?.label ? `**다음 변곡점**: ${t.next_inflection.label}${t.next_inflection.detail ? ' — ' + t.next_inflection.detail : ''}` : '',
    t.stages.length ? `**단계별 흐름**\n${mdList(t.stages.map(s => `${s.period} — ${s.title}: ${s.description}`))}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 기술변화\n\n${body}` : '';
}

function crossIndustryNudgeToMd(n: CrossIndustryNudgeV1): string {
  const body = mdJoin([
    n.key_bullets?.length ? `**핵심 요약**\n${mdList(n.key_bullets)}` : '',
    `**${n.industry_pain.title}**\n${mdList(n.industry_pain.description)}`,
    n.industry_pain.financial_impact_question,
    n.connection_insight ? `> 연결고리: ${n.connection_insight}` : '',
    `**타산업 사례 (${n.cross_industry_example.source_industry})**: ${n.cross_industry_example.case_name} — ${n.cross_industry_example.solution_description}`,
    mdSourcesBlock(n.sources),
  ]);
  return body ? `## 넛지\n\n${body}` : '';
}

function valueChainToMd(vc: ValueChainV2, sources: Source[] | undefined): string {
  const body = mdJoin([
    vc.key_bullets?.length ? `**핵심 요약**\n${mdList(vc.key_bullets)}` : '',
    vc.layers.length ? `**밸류체인 레이어**\n${mdList(vc.layers.map(l =>
      `${l.name}${l.is_subject ? ' (분석 대상)' : ''}${l.buyer ? ' [구매자]' : l.pricing_power ? ` [가격결정력: ${l.pricing_power}]` : ''}${l.bottleneck ? ' [Bottleneck]' : ''} — ${l.description}`
    ))}` : '',
    vc.value_flow?.length ? `**가격 전가 메커니즘**\n${mdList(vc.value_flow)}` : '',
    vc.subject_position?.length ? `**분석 기업 포지션**\n${mdList(vc.subject_position)}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 밸류체인\n\n${body}` : '';
}

function businessModelToMd(bm: BusinessModelV2, sources: Source[] | undefined): string {
  const ue = bm.unit_economics;
  const body = mdJoin([
    bm.key_bullets?.length ? `**핵심 요약**\n${mdList(bm.key_bullets)}` : '',
    bm.growth_motion_detail ? `**Growth Motion (${bm.growth_motion})**: ${bm.growth_motion_detail}` : '',
    bm.revenue_streams.length ? `**Revenue Streams**\n${mdList(bm.revenue_streams.map(rs => `${rs.name} (${rs.type})${rs.description ? ` — ${rs.description}` : ''}`))}` : '',
    (ue.gross_margin || ue.operating_margin || ue.net_margin) ? `**Unit Economics**\n${mdList([
      ue.gross_margin ? `Gross Margin: ${ue.gross_margin}%` : '',
      ue.operating_margin ? `Operating Margin: ${ue.operating_margin}%` : '',
      ue.net_margin ? `Net Margin: ${ue.net_margin}%` : '',
      ue.fcf_margin ? `FCF Margin: ${ue.fcf_margin}%` : '',
      ue.nrr ? `NRR: ${ue.nrr}%` : '',
    ])}` : '',
    bm.segments.length ? `**사업 세그먼트**\n${mdList(bm.segments.map(seg => `${seg.name}: ${seg.characteristics}`))}` : '',
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
    st.ten_year_durability?.length ? `**10년 지속 가능성**\n${mdList(st.ten_year_durability)}` : '',
    mdSourcesBlock(sources),
  ]);
  return body ? `## 전략\n\n${body}` : '';
}

function financialsToMd(f: FinancialsV2, sources: Source[] | undefined): string {
  const isYearCols = Array.from(new Set(f.income_statement.flatMap(getFinancialYearCols))).sort();
  const bsYearCols = Array.from(new Set(f.balance_sheet.flatMap(getFinancialYearCols))).sort();
  const isRows = f.income_statement.filter(r => isYearCols.some(c => r[c]));
  const bsRows = f.balance_sheet.filter(r => bsYearCols.some(c => r[c]));
  const isHeaderLabels = isYearCols.map(c => c.replace('fy', 'FY'));
  const bsHeaderLabels = bsYearCols.map(c => c.replace('fy', 'FY'));
  const body = mdJoin([
    f.key_bullets?.length ? `**핵심 요약**\n${mdList(f.key_bullets)}` : '',
    isRows.length ? `**손익계산서 (I/S)**\n| 항목 | ${isHeaderLabels.join(' | ')} | YoY |\n|---|${isHeaderLabels.map(() => '---').join('|')}|---|\n${
      isRows.map(r => `| ${r.item} | ${isYearCols.map(c => r[c] ?? '—').join(' | ')} | ${r.yoy ?? '—'} |`).join('\n')
    }` : '',
    bsRows.length ? `**재무상태표 (B/S)**\n| 항목 | ${bsHeaderLabels.join(' | ')} |\n|---|${bsHeaderLabels.map(() => '---').join('|')}|\n${
      bsRows.map(r => `| ${r.item} | ${bsYearCols.map(c => r[c] ?? '—').join(' | ')} |`).join('\n')
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
    `**CAGR (Year+1 → Year+${years})**: 보수적(P10) ${fmtCagr(calcCagr(g.simulation.p10))} · 예상(P50) ${fmtCagr(calcCagr(g.simulation.p50))} · 낙관적(P90) ${fmtCagr(calcCagr(g.simulation.p90))}`,
    `| 연차 | 보수적(P10) | 예상(P50) | 낙관적(P90) |\n|---|---|---|---|\n${
      Array.from({ length: years }, (_, i) =>
        `| Year+${i + 1} | ${fmtGrowthRevenue(g.simulation.p10[i], g.currency)} | ${fmtGrowthRevenue(g.simulation.p50[i], g.currency)} | ${fmtGrowthRevenue(g.simulation.p90[i], g.currency)} |`
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

function CopyButton({ getMarkdown, label = '복사', shortLabel, copiedLabel = '복사됨' }: { getMarkdown: () => string; label?: string; shortLabel?: string; copiedLabel?: string }) {
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
      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm transition-colors shrink-0 whitespace-nowrap"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {shortLabel ? (
        <>
          <span className="hidden sm:inline">{copied ? copiedLabel : label}</span>
          <span className="sm:hidden">{copied ? copiedLabel : shortLabel}</span>
        </>
      ) : (
        copied ? copiedLabel : label
      )}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

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

// 콘텐츠 패널의 초기 로딩 UI(SectionGenerating) 표시 여부 판정 전용
// (아래 batchDone()에서만 사용). 탭 바 체크마크(✓)는 이 값을 안 쓰고 hasTabData()로
// 판정한다 — 혼동 금지.
//
// industry_history/tech_evolution(Pain Diagnosis)은 2026-08-16부터 배치5로 승격되어
// 다른 8개 섹션과 동일하게 batchDone 기반 스켈레톤 판정을 받는다(구 "pain 진단 시작"
// 버튼 온디맨드 트리거는 제거됨).
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
  industry_history:     5,
  tech_evolution:       5,
};


// 탭 바 체크마크(✓)와 탭 콘텐츠 렌더 게이트(V2Tab vs 빈 상태 UI)가 공유하는 단일 판정
// 함수 — TAB_BATCH(위 주석 참고, 스켈레톤 표시용일 뿐 실제 완료 순서와 무관)와는 완전히
// 별개 판정 경로다. 예전엔 "그 탭 필드 객체가 존재하는가"(`!!data.value_chain_v2`)만
// 봤는데, `callSection()`이 그 실행에서만 JSON 파싱에 실패하면 서버가 DEFAULT_ANALYSIS_DATA의
// 빈 placeholder 객체(모든 배열/문자열이 비어있을 뿐 객체 자체는 존재)로 조용히 대체해
// 저장한다 — 이 경우도 `!!`는 true라서 체크마크는 뜨는데 실제 콘텐츠는 없는 버그가
// 있었다(2026-08-15, Ford value_chain_v2 실측 — 형제 섹션은 정상, 이 섹션만 간헐적으로
// 빈 채로 저장됨). 서버 Quality Gate(claude.ts의 SECTION_CONTENT_SIGNALS)와 같은 계열의
// "필드 단위로 실제 콘텐츠가 있는가" 판정이지만, 서버는 "저장 전에 이 섹션을 통째로
// 폐기할지"를 판단하는 반면 여기는 "이미 저장된 값이 실제 콘텐츠인지 빈 placeholder인지"를
// 판단하는 다른 용도라 필드 선정은 각 V2Tab이 실제로 렌더링하는 필드에 맞춰 별도로 정의한다.
export function hasTabData(key: TabKey, data: AnalysisDetail, financialsV2: FinancialsV2 | undefined): boolean {
  switch (key) {
    case 'summary': {
      const s = data.summary_v2;
      return !!s && !!(s.oneLiner || s.products.length || s.key_metrics.length || s.key_bullets?.length);
    }
    case 'industry_history': {
      const h = data.industry_history_v2;
      return !!h && !!(h.timeline.length || h.why_durable.length || h.chasm_points.length || h.key_bullets?.length);
    }
    case 'tech_evolution': {
      const t = data.tech_evolution_v2;
      return !!t && !!(t.stages.length || t.current_stage?.label || t.next_inflection?.label || t.key_bullets?.length);
    }
    case 'value_chain': {
      const vc = data.value_chain_v2;
      return !!vc && !!(vc.layers.length || vc.value_flow.length || vc.key_bullets?.length);
    }
    case 'business_model': {
      const bm = data.business_model_v2;
      return !!bm && !!(bm.revenue_streams.length || bm.segments.length || bm.moat.length || bm.growth_motion_detail || bm.key_bullets?.length);
    }
    case 'competitors': {
      const c = data.competitors_v2;
      return !!c && !!(c.direct.length || c.indirect.length || c.substitutes.length || c.key_bullets?.length);
    }
    case 'cross_industry_nudge': {
      const n = data.cross_industry_nudge_v1;
      return !!n && !!(n.industry_pain?.title || n.cross_industry_example?.case_name || n.key_bullets?.length);
    }
    case 'strategy': {
      const s = data.strategy_v2;
      return !!s && !!(
        s.strategy_coherence || s.corporate?.direction || s.business?.direction || s.financial?.direction ||
        s.ten_year_durability?.length || s.key_bullets?.length
      );
    }
    case 'financials':
      return !!financialsV2 && !!(financialsV2.income_statement.length || financialsV2.balance_sheet.length || financialsV2.key_bullets?.length);
    case 'founder': {
      const f = data.founder_v2;
      return !!f && !!(f.founders.length || f.career_trajectory.length || f.key_bullets?.length);
    }
    case 'growth_scenario':      return !!data.growth_scenario_v2;
    default:                     return false;
  }
}

// 관리자 전용 기능 노출 대상(PDF 내보내기 등) — 추가 시 이 배열에 이메일만 추가.
const ADMIN_EMAILS = ['sg.van.p@gmail.com'];

function AnalysisCardInner({ data, reanalyzingTabs, onReanalyze, isPremium, isShareView }: {
  data: AnalysisDetail;
  reanalyzingTabs?: Set<string>;
  onReanalyze?: (tab: string) => void;
  isPremium?: boolean;
  // 공유 링크 전용(ShareContent.tsx) — 즐겨찾기 별표 등 로그인 유저 전용 액션을 숨긴다.
  isShareView?: boolean;
}) {
  const { user, session, signInWithGoogle } = useAuth();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  // 탭 라벨/버튼은 전역 선호값이 아니라 이 리포트 자체의 저장된 언어를 우선한다 —
  // 안 그러면 KR로 생성해둔 과거 리포트를 열었을 때 콘텐츠는 한국어인데 탭 라벨만
  // 전역 설정(EN)을 따라가는 불일치가 생긴다. data가 아직 없을 때만 전역값으로 폴백.
  const { language: globalLanguage } = useLanguage();
  const reportLanguage = data.language === 'ko' || data.language === 'en' ? data.language : globalLanguage;
  const uiT = getUiStrings(reportLanguage);
  // 2026-08-17부터 탭 전환 UI가 사라지고 전 섹션이 세로로 이어지는 스크롤 문서로 바뀌면서
  // tab은 더 이상 "지금 보이는 탭"이 아니다 — 상단 sticky 그리드에서 마지막으로 클릭한
  // 섹션만 추적, 헤더의 "이 섹션 복사" 버튼(getActiveTabMarkdown)이 이 값을 참조한다.
  const [tab, setTab] = useState<TabKey>('summary');
  const [, startTransition] = useTransition();
  const { completedBatches } = useAnalysis();
  // 그리드 클릭/섹션 내부 링크 클릭 시 공통으로 쓰는 헬퍼 — tab state를 갱신하고(복사
  // 버튼용) 해당 섹션 id로 스무스 스크롤한다. scroll-mt-* 유틸로 sticky 그리드에
  // 가려지지 않게 오프셋을 준다(각 섹션 래퍼에 적용).
  const jumpToSection = useCallback((key: TabKey | 'pain_diagnosis') => {
    startTransition(() => setTab(key === 'pain_diagnosis' ? 'industry_history' : key));
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  // batchDone: true when not streaming OR when that batch has completed
  const batchDone = (n: number) => completedBatches.size === 0 || completedBatches.has(n);
  // isReanalyzing: that tab is being reanalyzed right now
  const isReanalyzing = (t: string) => reanalyzingTabs?.has(t) ?? false;
  // reanalyzeBtn: small text-link shown when v2 data is missing
  const reanalyzeBtn = (t: string) => onReanalyze && !isReanalyzing(t) ? (
    <div className="text-right mb-2">
      <button
        onClick={() => onReanalyze(t)}
        className="text-sm text-gray-400 hover:text-navy-500 hover:underline transition-colors"
      >
        {uiT.actions.reanalyzeSection}
      </button>
    </div>
  ) : null;

  const [financialsV2Local, setFinancialsV2Local] = useState<FinancialsV2 | undefined>(data.financials_v2);
  const [refreshingFinancials, setRefreshingFinancials] = useState(false);

  // ★ 즐겨찾기 토글(2026-08-17, 히스토리 페이지 즐겨찾기 섹션과 연동) — financialsV2Local과
  // 동일한 이유로 prop 변화에 재동기화 필요(다른 분석을 열면 data.isFavorited도 바뀐다).
  const [isFavorited, setIsFavorited] = useState(data.isFavorited ?? false);
  useEffect(() => {
    setIsFavorited(data.isFavorited ?? false);
  }, [data.isFavorited, data.id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!session) { signInWithGoogle(); return; }
    if (!data.id) return; // 스트리밍 중(아직 저장 전)이면 버튼 자체가 비활성화되어 있음
    const next = !isFavorited;
    setIsFavorited(next); // 낙관적 업데이트
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/analyses/${data.id}/favorite`, {
        method: next ? 'POST' : 'DELETE',
        headers: buildAuthHeaders(null, session.access_token),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIsFavorited(!next); // 실패 시 원상복구
    }
  }, [data.id, isFavorited, session, signInWithGoogle]);

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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Building2 size={18} className="text-gray-400" />
              <h2 className="text-2xl font-semibold text-gray-900 leading-none">{data.companyName}</h2>
            </div>
            <p className="text-sm text-gray-400 ml-6">
              {new Date(data.createdAt).toLocaleString(reportLanguage === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            {/* 분석 목적 배지 — PDF 표지엔 이미 있었으나 웹엔 없던 것을 신규 추가
                (2026-08-17, 사전 확인 다이얼로그 통합 작업 계기). purposeDetailFormatted가
                있으면 그걸, 없으면(옛 캐시 등) 원문으로 폴백 — PDF와 동일 우선순위. */}
            {data.purposeCategory && (
              <div className="flex items-start flex-wrap gap-1.5 ml-6 mt-1.5">
                <span className="inline-flex items-center whitespace-nowrap shrink-0 text-sm font-medium text-navy-700 bg-navy-50 border border-navy-100 rounded-full px-2.5 py-0.5">
                  {uiT.home.purposeSectionTitle}: {purposeCategoryLabel(data.purposeCategory, uiT)}
                </span>
                {(data.purposeDetailFormatted ?? data.purposeDetail) && (
                  <span className="text-sm text-gray-400 leading-snug max-w-md pt-0.5">
                    {data.purposeDetailFormatted ?? data.purposeDetail}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end max-w-full">
            {!isShareView && (
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={!data.id}
                aria-label={isFavorited ? uiT.home.favoriteRemove : uiT.home.favoriteAdd}
                title={isFavorited ? uiT.home.favoriteRemove : uiT.home.favoriteAdd}
                className="p-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Star size={16} className={isFavorited ? 'fill-source-reference text-source-reference' : 'text-gray-300'} />
              </button>
            )}
            <CopyButton getMarkdown={() => analysisToMd(data)} label={uiT.actions.copyAll} copiedLabel={uiT.actions.copied} />
            <CopyButton getMarkdown={getActiveTabMarkdown} label={uiT.actions.copyTab} shortLabel={uiT.actions.copyTabShort} copiedLabel={uiT.actions.copied} />
            {isAdmin && <ExportPdfButton data={data} />}
            <DataSourceBadge source={data.dataSource ?? 'web_search'} />
          </div>
        </div>
      </div>

      {/* 상단 sticky 상태 그리드(2026-08-17) — 구 좌우 스크롤 탭바를 완전히 대체하는
          유일한 섹션 내비게이션. 스트리밍 중이든 완료된 캐시 리포트를 바로 열든 항상
          보임(구 넛지 그리드의 3초 자동 숨김 없음) — HomeContent.tsx의 진행 카드 그리드와
          동일한 상태 판정(hasTabData/completedBatches)을 그대로 재사용해 여기로 이관.
          클릭 시 jumpToSection()으로 해당 섹션까지 스무스 스크롤. */}
      {(() => {
        const isStreaming = completedBatches.has(-1);
        const batch1Done = completedBatches.has(1);
        const navCards: Array<{ key: TabKey | 'pain_diagnosis'; label: string; done: boolean }> = [
          { key: 'summary',              label: uiT.tabs.summary.label,              done: hasTabData('summary', data, financialsV2Local) },
          {
            key: 'pain_diagnosis', label: uiT.home.progressCardPainDiagnosis,
            done: hasTabData('industry_history', data, financialsV2Local) && hasTabData('tech_evolution', data, financialsV2Local),
          },
          { key: 'value_chain',          label: uiT.tabs.value_chain.label,          done: hasTabData('value_chain', data, financialsV2Local) },
          { key: 'business_model',       label: uiT.tabs.business_model.label,       done: hasTabData('business_model', data, financialsV2Local) },
          { key: 'competitors',          label: uiT.tabs.competitors.label,          done: hasTabData('competitors', data, financialsV2Local) },
          { key: 'financials',           label: uiT.tabs.financials.label,           done: hasTabData('financials', data, financialsV2Local) },
          { key: 'strategy',             label: uiT.tabs.strategy.label,             done: hasTabData('strategy', data, financialsV2Local) },
          { key: 'founder',              label: uiT.tabs.founder.label,              done: hasTabData('founder', data, financialsV2Local) },
          { key: 'cross_industry_nudge', label: uiT.tabs.cross_industry_nudge.label, done: hasTabData('cross_industry_nudge', data, financialsV2Local) },
          // 출처는 실제 스크롤 순서상 스택 최후미(성장시나리오 뒤)라 내비 그리드에서도
          // 마지막에 배치 — 그리드 클릭 순서와 실제 스크롤 순서가 어긋나면 안 됨
          // (2026-08-16, PDF 목차 누락 버그와 동일 계열의 "표시 순서 ≠ 실제 순서" 재발 방지).
          { key: 'sources' as TabKey,    label: uiT.home.progressCardSources,        done: completedBatches.has(4) },
        ];
        return (
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {navCards.map(card => {
                const isWaiting = isStreaming && !batch1Done && card.key !== 'summary';
                const isInProgress = isStreaming && !card.done && !isWaiting;
                return (
                  <button
                    key={card.key}
                    onClick={() => {
                      trackEvent('tab_clicked', { tab: card.key });
                      if (card.key === 'financials') trackEvent('financials_tab_reached', { companyName: data.companyName });
                      jumpToSection(card.key);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors ${
                      card.done ? 'bg-success-bg border-success-border hover:bg-success-bg' : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {card.done ? (
                      <span className="text-success text-sm font-bold leading-none">✓</span>
                    ) : isInProgress ? (
                      <span className="w-2.5 h-2.5 border border-current text-navy-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="flex gap-[2px]" aria-hidden>
                        {[0, 1, 2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-gray-300" />)}
                      </span>
                    )}
                    <span className={`text-xs font-medium leading-tight ${card.done ? 'text-success' : 'text-gray-500'}`}>
                      {card.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Scroll-stack document — 전 섹션이 탭 전환 없이 순서대로 이어진다(2026-08-17).
          각 블록의 !batchDone → SectionGenerating : hasTabData ? <Tab/> : <EmptySectionState/>
          게이트 로직은 기존 그대로(재분석 버튼 포함) — 조건문만 "탭 선택 시"에서 "항상"으로 바뀜. */}
      <div className="p-5 bg-gray-50 flex flex-col gap-4">
        <ReportSection id="summary" title={uiT.tabs.summary.label} icon={Briefcase} uiT={uiT} getMarkdown={() => data.summary_v2 ? summaryToMd(data.summary_v2, data.summary_v2.sources ?? data.sources?.summary) : ''}>
          {!batchDone(TAB_BATCH.summary) ? <SectionGenerating label={uiT.tabs.summary.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.summary_v2
            ? (hasTabData('summary', data, financialsV2Local)
                ? <SummaryV2Tab s={data.summary_v2} sources={data.summary_v2.sources ?? data.sources?.summary} onTabChange={key => jumpToSection(key as TabKey)} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('summary') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <SummaryTab data={data} />}
        </ReportSection>

        {/* Pain Diagnosis(industry_history+tech_evolution 통합, 2026-08-16부터 배치5) —
            다른 섹션과 동일한 스타일로 렌더(2026-08-19, 앰버 강조 제거). */}
        <ReportSection
          id="pain_diagnosis"
          title={uiT.home.progressCardPainDiagnosis}
          icon={Lightbulb}
          uiT={uiT}
          getMarkdown={() => mdJoin([
            data.industry_history_v2 ? industryHistoryToMd(data.industry_history_v2, data.industry_history_v2.sources ?? data.sources?.industry_history) : '',
            data.tech_evolution_v2 ? techEvolutionToMd(data.tech_evolution_v2, data.tech_evolution_v2.sources ?? data.sources?.tech_evolution) : '',
          ])}
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-500 mb-2">{uiT.tabs.industry_history.label}</h4>
              {(isReanalyzing('industry') || !batchDone(TAB_BATCH.industry_history)) ? <SectionGenerating label={uiT.tabs.industry_history.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
              data.industry_history_v2
                ? (hasTabData('industry_history', data, financialsV2Local)
                    ? <IndustryHistoryV2Tab h={data.industry_history_v2} sources={data.industry_history_v2.sources ?? data.sources?.industry_history} />
                    : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('industry') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
                : <p className="text-base text-gray-500 py-8 text-center">아직 생성되지 않은 섹션입니다.</p>}
            </div>
            <div className="pt-6 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-500 mb-2">{uiT.tabs.tech_evolution.label}</h4>
              {(isReanalyzing('tech') || !batchDone(TAB_BATCH.tech_evolution)) ? <SectionGenerating label={uiT.tabs.tech_evolution.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
              data.tech_evolution_v2
                ? (hasTabData('tech_evolution', data, financialsV2Local)
                    ? <TechEvolutionV2Tab t={data.tech_evolution_v2} sources={data.tech_evolution_v2.sources ?? data.sources?.tech_evolution} />
                    : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('tech') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
                : <p className="text-base text-gray-500 py-8 text-center">아직 생성되지 않은 섹션입니다.</p>}
            </div>
          </div>
        </ReportSection>

        <ReportSection id="value_chain" title={uiT.tabs.value_chain.label} icon={GitBranch} uiT={uiT} getMarkdown={() => data.value_chain_v2 ? valueChainToMd(data.value_chain_v2, data.value_chain_v2.sources ?? data.sources?.value_chain) : ''}>
          {(isReanalyzing('value_chain') || !batchDone(TAB_BATCH.value_chain)) ? <SectionGenerating label={uiT.tabs.value_chain.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.value_chain_v2
            ? (hasTabData('value_chain', data, financialsV2Local)
                ? <ValueChainV2Tab vc={data.value_chain_v2} sources={data.value_chain_v2.sources ?? data.sources?.value_chain} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('value_chain') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('value_chain')}<ValueChainTab data={data} /></>}
        </ReportSection>

        <ReportSection id="business_model" title={uiT.tabs.business_model.label} icon={DollarSign} uiT={uiT} getMarkdown={() => data.business_model_v2 ? businessModelToMd(data.business_model_v2, data.business_model_v2.sources ?? data.sources?.business_model) : ''}>
          {(isReanalyzing('business_model') || !batchDone(TAB_BATCH.business_model)) ? <SectionGenerating label={uiT.tabs.business_model.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.business_model_v2
            ? (hasTabData('business_model', data, financialsV2Local)
                ? <BusinessModelV2Tab bm={data.business_model_v2} sources={data.business_model_v2.sources ?? data.sources?.business_model} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('business_model') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('business_model')}<BusinessModelTab data={data} /></>}
        </ReportSection>

        <ReportSection id="competitors" title={uiT.tabs.competitors.label} icon={Users} uiT={uiT} getMarkdown={() => data.competitors_v2 ? competitorsToMd(data.competitors_v2, data.competitors_v2.sources ?? data.sources?.competitors) : ''}>
          {(isReanalyzing('competitors') || !batchDone(TAB_BATCH.competitors)) ? <SectionGenerating label={uiT.tabs.competitors.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.competitors_v2
            ? (hasTabData('competitors', data, financialsV2Local)
                ? <CompetitorsV2Tab c={data.competitors_v2} sources={data.competitors_v2.sources ?? data.sources?.competitors} dataSource={data.dataSource} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('competitors') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('competitors')}<CompetitorsTab data={data} /></>}
        </ReportSection>

        <ReportSection id="financials" title={uiT.tabs.financials.label} icon={BarChart2} uiT={uiT} getMarkdown={() => financialsV2Local ? financialsToMd(financialsV2Local, financialsV2Local.sources ?? data.sources?.financials) : ''}>
          {(isReanalyzing('financials') || !batchDone(TAB_BATCH.financials)) ? <SectionGenerating label={uiT.tabs.financials.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          financialsV2Local
            ? (data.dataSource !== 'edgar' && data.dataSource !== 'dart'
                // EDGAR/DART 둘 다 미공시(비상장·비영리 등) — 재분석해도 달라지지 않으므로
                // CTA 없는 전용 문구(작업 D, 2026-08-16). 서버가 이제 이 경우 financials_v2를
                // 항상 빈 상태로 반환하므로 hasTabData()로도 걸러지지만, 그 실패 문구
                // ("재분석을 시도해보세요")는 이 케이스엔 안 맞아서 먼저 분기한다.
                ? <EmptySectionState message={uiT.actions.financialsNoOfficialData} />
                : hasTabData('financials', data, financialsV2Local)
                  ? <FinancialsV2Tab
                      f={financialsV2Local}
                      sources={financialsV2Local.sources ?? data.sources?.financials}
                      onRefresh={handleRefreshFinancials}
                      isRefreshing={refreshingFinancials}
                      dataSource={data.dataSource}
                    />
                  : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('financials') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('financials')}<FinancialsTab data={data} /></>}
        </ReportSection>

        <ReportSection id="strategy" title={uiT.tabs.strategy.label} icon={Target} uiT={uiT} getMarkdown={() => data.strategy_v2 ? strategyToMd(data.strategy_v2, data.strategy_v2.sources ?? data.sources?.strategy) : ''}>
          {(isReanalyzing('strategy') || !batchDone(TAB_BATCH.strategy)) ? <SectionGenerating label={uiT.tabs.strategy.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.strategy_v2
            ? (hasTabData('strategy', data, financialsV2Local)
                ? <StrategyV2Tab s={data.strategy_v2} sources={data.strategy_v2.sources ?? data.sources?.strategy} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('strategy') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('strategy')}<StrategyTab data={data} /></>}
        </ReportSection>

        <ReportSection id="founder" title={uiT.tabs.founder.label} icon={User} uiT={uiT} getMarkdown={() => data.founder_v2 ? founderToMd(data.founder_v2) : ''}>
          {(isReanalyzing('founder') || !batchDone(TAB_BATCH.founder)) ? <SectionGenerating label={uiT.tabs.founder.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.founder_v2
            ? (hasTabData('founder', data, financialsV2Local)
                ? <FounderV2Tab f={data.founder_v2} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('founder') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('founder')}<p className="text-base text-gray-500 py-4 text-center">창업자 데이터가 없습니다.</p></>}
        </ReportSection>

        <ReportSection id="cross_industry_nudge" title={uiT.tabs.cross_industry_nudge.label} icon={Lightbulb} uiT={uiT} getMarkdown={() => data.cross_industry_nudge_v1 ? crossIndustryNudgeToMd(data.cross_industry_nudge_v1) : ''}>
          {(isReanalyzing('nudge') || !batchDone(TAB_BATCH.cross_industry_nudge)) ? <SectionGenerating label={uiT.tabs.cross_industry_nudge.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.cross_industry_nudge_v1
            ? (hasTabData('cross_industry_nudge', data, financialsV2Local)
                ? <CrossIndustryNudgeV1Tab n={data.cross_industry_nudge_v1} sources={data.cross_industry_nudge_v1.sources} />
                : <EmptySectionState message={uiT.actions.sectionFailedEmpty} onReanalyze={onReanalyze ? () => onReanalyze('nudge') : undefined} reanalyzeLabel={uiT.actions.reanalyzeSection} />)
            : <>{reanalyzeBtn('nudge')}<p className="text-base text-gray-500 py-4 text-center">넛지 데이터가 없습니다.</p></>}
        </ReportSection>

        {/* growth_scenario: 그리드 셀에는 없지만(요청사항 10개 순서 밖) 출처 바로
            앞에 유지 — 기존 인터랙션(PRO 배지/생성 버튼) 그대로. */}
        <ReportSection id="growth_scenario" title={uiT.tabs.growth_scenario.label} icon={TrendingUp} uiT={uiT} getMarkdown={() => data.growth_scenario_v2 ? growthScenarioToMd(data.growth_scenario_v2) : ''}>
          {!isPremium ? <GrowthScenarioLocked /> :
          !batchDone(TAB_BATCH.growth_scenario) ? <SectionGenerating label={uiT.tabs.growth_scenario.label} suffix={uiT.actions.sectionGeneratingSuffixShort} /> :
          data.growth_scenario_v2
            ? <GrowthScenarioV2Tab g={data.growth_scenario_v2} />
            : <p className="text-base text-gray-500 py-4 text-center">최소 3개년 공식 재무 시계열이 확보된 기업만 지원돼요.</p>}
        </ReportSection>

        {/* 출처(신규, 2026-08-17) — 각 섹션 하단에 이미 개별 표시되는 출처와 별개로,
            전 섹션 출처를 한 곳에 모은 통합 목록(PDF의 "마지막 페이지 통합 출처 목록"과
            동일한 개념). data.sources는 이미 있는 필드라 데이터 신규 추가 없음. **진짜
            최종 섹션(2026-08-16 재조정 — 이전엔 Pain Diagnosis 다음·성장시나리오
            앞이었으나, 출처는 항상 스택의 마지막이어야 한다는 재검토로 성장시나리오
            뒤로 이동).** */}
        <ReportSection id="sources" title={uiT.home.progressCardSources} icon={BookOpen} uiT={uiT} getMarkdown={() => sourcesToMd(data, uiT)}>
          <AllSourcesSummary data={data} uiT={uiT} />
        </ReportSection>
      </div>
    </div>
  );
}

const AnalysisCard = memo(AnalysisCardInner);
export default AnalysisCard;

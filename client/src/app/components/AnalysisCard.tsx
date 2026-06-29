'use client';

import { useState, useEffect, useRef, memo, useCallback, useMemo, useTransition } from 'react';
import { useAnalysis } from '@/app/context/AnalysisContext';
import dynamic from 'next/dynamic';
import {
  BarChart2, Zap, GitBranch, Users, DollarSign, Target,
  BookOpen, ExternalLink, Building2, Clock, Briefcase, User, RefreshCw,
} from 'lucide-react';
const ExportPdfButton = dynamic(() => import('./ExportPdfButton'), { ssr: false, loading: () => null });
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
  SummaryV2,
  IndustryHistoryV2,
  TechEvolutionV2,
  ValueChainV2,
  BusinessModelV2,
  CompetitorsV2,
  StrategyV2,
  FinancialsV2,
  FinancialsV2Row,
  FounderV2,
} from '@/types';

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
  if (str === '확인 필요' || str === '공개 없음') {
    return <span className={`text-gray-400 italic ${className}`}>{str}</span>;
  }
  if (str.includes('(추정)')) {
    const idx = str.indexOf('(추정)');
    return (
      <span className={className}>
        {str.slice(0, idx)}<span className="text-amber-500">(추정)</span>{str.slice(idx + 4)}
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

function FinancialValue({ text }: { text: string | null | undefined }) {
  const str = text ?? '—';
  const match = str.match(FINANCIAL_SOURCE_RE);
  const cleaned = match ? str.replace(FINANCIAL_SOURCE_RE, '').trim() : str;
  const tag = (match?.[0] ?? '').replace(/[()]/g, '').trim().toUpperCase();
  const isEdgar = tag.includes('EDGAR');
  const isDart  = !isEdgar && tag.includes('DART');
  return (
    <span className="inline-flex items-center gap-0.5">
      <DataValue text={cleaned} />
      {(isEdgar || isDart) && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 cursor-help ${isEdgar ? 'bg-blue-500' : 'bg-emerald-500'}`}
          title={isEdgar ? 'SEC EDGAR 공식 데이터' : 'DART 공식 데이터'}
        />
      )}
    </span>
  );
}

function MetricCard({ value, label, trend }: { value: string; label: string; trend?: 'up' | 'down' | 'flat' }) {
  const cleaned = cleanMetricValue(value);
  const isUnknown = cleaned === '확인 필요' || cleaned === '공개 없음' || isPlaceholder(cleaned);
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

const DATA_SOURCE_CONFIG: Record<DataSource, { label: string; cls: string; dot: string }> = {
  dart:       { label: 'DART 연동됨',      cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  edgar:      { label: 'SEC EDGAR 연동됨', cls: 'bg-blue-50 text-blue-700',       dot: 'bg-blue-500' },
  web_search: { label: '웹 검색 기반',      cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
};

function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = DATA_SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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

function isPlaceholder(v: string | number | null | undefined): boolean {
  if (v == null) return false;
  return /^-999([.,]\d+)?([%\s]|$)/.test(String(v).trim());
}

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

// ── Static stock chart ────────────────────────────────────────────────────────

function StockChart({ ticker }: { ticker: string | null }) {
  if (!ticker) return null;
  const parts = ticker.split(':');
  const exchange = (parts[0] ?? '').toUpperCase();
  const symbol = parts[1] ?? ticker;
  const isKorean = ['KRX', 'KOSDAQ', 'KOSPI'].includes(exchange);
  const isUS = ['NASDAQ', 'NYSE', 'AMEX'].includes(exchange);

  if (isKorean) {
    return (
      <a href={`https://finance.naver.com/item/main.nhn?code=${symbol}`} target="_blank" rel="noopener noreferrer"
        className="block w-full rounded-xl border border-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=250&requestType=0`}
          alt={`${symbol} 주가 차트`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </a>
    );
  }
  if (isUS) {
    return (
      <a href={`https://finviz.com/quote.ashx?t=${symbol}`} target="_blank" rel="noopener noreferrer"
        className="block w-full rounded-xl border border-gray-100 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://finviz.com/chart.ashx?t=${symbol}&ty=c&ta=1&p=d`}
          alt={`${symbol} 주가 차트`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </a>
    );
  }
  return (
    <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl border border-gray-100">
      시세 정보 없음
    </div>
  );
}

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

      {/* Static stock chart */}
      <StockChart ticker={s.ticker} />

      {/* Key metrics — 3-col grid, no truncation */}
      {filteredMetrics.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {filteredMetrics.map((m, i) => (
            <MetricCard key={i} value={m.value} label={m.label} trend={m.trend} />
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

      {/* 성장 모멘텀 / 핵심 리스크 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-2">성장 모멘텀</div>
          <p className="text-sm text-gray-700 leading-relaxed">{s.bull_case}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-2">핵심 리스크</div>
          <p className="text-sm text-gray-700 leading-relaxed">{s.bear_case}</p>
        </div>
      </div>

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

// ── Legacy Tab: 산업역사 ──────────────────────────────────────────────────────

function Timeline({ text, sourcesKey, data }: {
  text: string;
  sourcesKey: keyof typeof data.sources;
  data: AnalysisDetail;
}) {
  type Item = { period: string; sortYear: number; content: string };
  const { items, hasYears } = useMemo(() => {
    const lines = splitLines(text);
    const parsed: Item[] = [];
    for (const line of lines) {
      const m = line.match(/^((?:19|20)\d{2}(?:년대?|s)?(?:\s*[~\-–]\s*(?:(?:19|20)\d{2}(?:년대?|s)?|현재))?)\s*[:·]?\s*/);
      if (m) {
        const yearNum = parseInt(m[1].match(/\d{4}/)?.[0] ?? '0');
        parsed.push({ period: m[1], sortYear: yearNum, content: line.slice(m[0].length) });
      } else if (parsed.length > 0) {
        parsed[parsed.length - 1].content += ' ' + line;
      } else {
        parsed.push({ period: '', sortYear: 0, content: line });
      }
    }
    const hy = parsed.some(it => it.period !== '');
    if (hy) parsed.sort((a, b) => a.sortYear - b.sortYear);
    return { items: parsed, hasYears: hy };
  }, [text]);

  return (
    <>
      <div>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const badgeText = item.period.match(/\d{2,4}/)?.[0] ?? '·';
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center w-9 shrink-0">
                <div className="w-9 h-9 rounded-full bg-blue-50 border-2 border-blue-300 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-blue-800 text-center leading-none">{badgeText}</span>
                </div>
                {!isLast && <div className="w-0.5 bg-gray-100 flex-1 my-1 min-h-[1.5rem]" />}
              </div>
              <div className="pb-5 flex-1 min-w-0 pt-1">
                {item.period && hasYears && (
                  <div className="text-[11px] text-blue-600 font-medium mb-1">{item.period}</div>
                )}
                <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
              </div>
            </div>
          );
        })}
      </div>
      <SourcesList sources={data.sources?.[sourcesKey] as Source[] | undefined} />
    </>
  );
}

function IndustryHistoryTab({ data }: { data: AnalysisDetail }) {
  return (
    <SectionCard title="산업 발전 연혁" dotColor="bg-blue-400">
      <Timeline text={data.industry_history} sourcesKey="industry_history" data={data} />
    </SectionCard>
  );
}

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

// ── Legacy Tab: 기술변화 ──────────────────────────────────────────────────────

const TECH_BULLET_RE = /^(\d+[.)]\s|[①②③④⑤⑥⑦⑧⑨]\s?|\d+단계[:\s]|[•·▶→■◆]\s?)/;

function TechEvolutionTab({ data }: { data: AnalysisDetail }) {
  const lines = splitLines(data.tech_evolution);
  const points: string[] = [];
  let buf = '';
  for (const line of lines) {
    if (TECH_BULLET_RE.test(line)) {
      if (buf) points.push(buf.trim());
      buf = line.replace(TECH_BULLET_RE, '');
    } else {
      buf = buf ? buf + ' ' + line : line;
    }
  }
  if (buf) points.push(buf.trim());
  if (points.length === 0 && data.tech_evolution) points.push(data.tech_evolution);

  return (
    <SectionCard title="기술 변화 트렌드" dotColor="bg-purple-400">
      <div className="space-y-4">
        {points.map((point, i) => {
          const yearMatch = point.match(/^((?:19|20)\d{2}(?:년대?|s)?(?:\s*[-~]\s*(?:(?:19|20)\d{2}(?:년대?|s)?|현재))?)\s*[:·—]?\s*/);
          const yearText = yearMatch?.[1] ?? '';
          const restText = yearMatch ? point.slice(yearMatch[0].length) : point;
          return (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-purple-50 border-2 border-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[11px] font-semibold text-purple-800">{i + 1}</span>
              </div>
              <div className="flex-1">
                {yearText && <div className="text-[11px] text-purple-600 font-medium mb-1">{yearText}</div>}
                <p className="text-sm text-gray-700 leading-relaxed">{restText}</p>
              </div>
            </div>
          );
        })}
      </div>
      <SourcesList sources={data.sources?.tech_evolution} />
    </SectionCard>
  );
}

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
  const ue = bm.unit_economics;
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
      {bm.revenue_streams.length > 0 && (
        <SectionCard title="Revenue Streams" dotColor="bg-green-400">
          <div className="space-y-3">
            {bm.revenue_streams.map((rs, i) => (
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

      {/* Above fold: growth motion */}
      <SectionCard title="Growth Motion" dotColor="bg-blue-400">
        <div className="mb-3">
          <span className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full ${gm.cls}`}>
            {gm.label}
          </span>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{bm.growth_motion_detail}</p>
      </SectionCard>

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

          {bm.segments.length > 0 && (
            <SectionCard title="사업 세그먼트" dotColor="bg-indigo-400">
              <div className="space-y-2.5">
                {bm.segments.map((seg, i) => (
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

          {bm.moat.length > 0 && (
            <SectionCard title="경제적 해자 (Moat)" dotColor="bg-gray-400">
              <div className="space-y-3">
                {bm.moat.map((m, i) => {
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

const CompetitorsV2Tab = memo(function CompetitorsV2Tab({ c, sources }: { c: CompetitorsV2; sources: Source[] | undefined }) {
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
        {comp.country && <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{comp.country}</span>}
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

const IS_BOLD_ITEMS = ['매출', '영업이익', '순이익'];

// YoY 값 정규화 — ▲/▼로 시작하지 않는 값(확인 필요%, 확인 필요% YoY 등)은 em dash로 표시
function normalizeYoy(v: string | undefined): string {
  if (!v || v === '—') return '—';
  if (v.startsWith('▲') || v.startsWith('▼')) return v;
  return '—';
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

  const mbMetrics = [
    { label: 'ROE',           value: f.munger_buffett_metrics.roe },
    { label: 'ROIC',          value: f.munger_buffett_metrics.roic },
    { label: 'Owner Earnings', value: f.munger_buffett_metrics.owner_earnings },
    { label: 'D/E Ratio',     value: f.munger_buffett_metrics.debt_to_equity },
    { label: 'Interest Coverage', value: f.munger_buffett_metrics.interest_coverage },
    { label: 'Reinvestment Rate', value: f.munger_buffett_metrics.reinvestment_rate },
  ].filter(m => m.value && m.value !== '추정 불가' && m.value !== '확인 필요' && !isPlaceholder(m.value));

  const cfDots: Record<string, string> = {
    'Operating CF':  'bg-blue-400',
    'Investing CF':  'bg-amber-400',
    'Financing CF':  'bg-gray-400',
    'FCF':           'bg-green-500',
  };

  return (
    <div className="space-y-4">
      <KeyBulletsBlock bullets={f.key_bullets} />
      {/* 데이터 출처 뱃지 + Refresh 버튼 */}
      <div className="flex items-center justify-between">
        {dataSource === 'edgar' ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />🟢 SEC EDGAR 공식
          </span>
        ) : dataSource === 'dart' ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />🟢 DART 공식
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />⚪ 웹 검색 추정치
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

      {/* Narrative */}
      {f.narrative && (
        <SectionCard title="재무 서사" dotColor="bg-emerald-400">
          <div className="space-y-1.5">
            {splitLines(f.narrative).map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                <CitedText text={l} />
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
                      <FinancialValue text={row[col] ?? '—'} />
                    </span>
                  ))}
                  <span className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${yoyCls(row.yoy)}`}><DataValue text={normalizeYoy(row.yoy)} /></span>
                </>
              );
            }}
          />
        </SectionCard>
      )}

      {/* Below fold: Balance sheet, Cash flow, Munger metrics, Key risks */}
      <ShowMore label="재무상태표 · 현금흐름 · Munger 지표 보기">
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
                  const isBold = ['총자산', '총부채', '자본총계'].includes(row.item);
                  return (
                    <>
                      <span className={`py-2.5 pr-3 text-xs truncate ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</span>
                      <span className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap"><FinancialValue text={row.fy2023 ?? '—'} /></span>
                      <span className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${isBold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}><FinancialValue text={row.fy2024 ?? '—'} /></span>
                      <span className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap"><FinancialValue text={row.fy2025 ?? '—'} /></span>
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

          {mbMetrics.length > 0 && (
            <SectionCard title="Munger / Buffett Metrics" dotColor="bg-amber-400">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {mbMetrics.map((m, i) => <MetricCard key={i} label={m.label} value={m.value} />)}
              </div>
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

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <Sk h="h-14" />
      {[0,1,2,3].map(i => (
        <div key={i} className="flex gap-4">
          <Sk w="w-10 shrink-0" h="h-10" />
          <div className="flex-1 space-y-2 pt-1">
            <Sk w="w-1/2" />
            <Sk />
            <Sk w="w-3/4" />
          </div>
        </div>
      ))}
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

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'summary',          label: '요약',         icon: Briefcase,  tooltip: '이 회사가 뭐 하는 곳인지 한눈에 확인할 수 있어요' },
  { key: 'industry_history', label: '산업역사',     icon: Clock,      tooltip: '이 산업이 어떻게 발전해왔는지 확인할 수 있어요' },
  { key: 'tech_evolution',   label: '기술변화',     icon: Zap,        tooltip: '현재 기술 트렌드와 앞으로의 방향을 확인할 수 있어요' },
  { key: 'value_chain',      label: '밸류체인',     icon: GitBranch,  tooltip: '이 회사가 산업 내 어디에 위치하는지 확인할 수 있어요' },
  { key: 'business_model',   label: '비즈니스모델', icon: DollarSign, tooltip: '어떻게 돈을 버는지 확인할 수 있어요' },
  { key: 'competitors',      label: '경쟁사',       icon: Users,      tooltip: '주요 경쟁사와 차별점을 확인할 수 있어요' },
  { key: 'strategy',         label: '전략',         icon: Target,     tooltip: '앞으로의 성장 전략을 확인할 수 있어요' },
  { key: 'financials',       label: '재무',         icon: BarChart2,  tooltip: '매출, 이익, 현금흐름 등 재무 데이터를 확인할 수 있어요' },
  { key: 'founder',          label: '창업자',       icon: User,       tooltip: '창업자 배경과 이력을 확인할 수 있어요' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const TAB_BATCH: Record<TabKey, number> = {
  summary:          1,
  industry_history: 2,
  business_model:   2,
  competitors:      2,
  tech_evolution:   3,
  value_chain:      3,
  strategy:         3,
  financials:       40,
  founder:          5,
};

function AnalysisCardInner({ data }: { data: AnalysisDetail }) {
  const [tab, setTab] = useState<TabKey>('summary');
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { completedBatches } = useAnalysis();
  // batchDone: true when not streaming OR when that batch has completed
  const batchDone = (n: number) => completedBatches.size === 0 || completedBatches.has(n);

  // Task 1: 분석 시작 시 요약 탭 자동 이동
  useEffect(() => {
    if (completedBatches.size === 1 && completedBatches.has(-1)) {
      startTransition(() => setTab('summary'));
    }
  }, [completedBatches]);

  const [financialsV2Local, setFinancialsV2Local] = useState<FinancialsV2 | undefined>(data.financials_v2);
  const [refreshingFinancials, setRefreshingFinancials] = useState(false);

  const handleRefreshFinancials = useCallback(async () => {
    setRefreshingFinancials(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/api/analyses/${data.id}/refresh-financials`, { method: 'POST' });
      if (res.ok) {
        const { financials_v2 } = await res.json();
        setFinancialsV2Local(financials_v2);
      }
    } catch {
      // silently ignore network errors
    } finally {
      setRefreshingFinancials(false);
    }
  }, [data.id]);

  const ticker = data.summary_v2?.ticker ?? null;


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
            <ExportPdfButton data={data} />
            <DataSourceBadge source={data.dataSource ?? 'web_search'} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-white px-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          const isStreaming = completedBatches.has(-1);
          const batch1Done = completedBatches.has(1);
          const tabDone = completedBatches.has(TAB_BATCH[t.key]);
          // waiting: streaming, batch1 not done, non-summary tab (batches haven't notified yet)
          const isWaiting    = isStreaming && !batch1Done && t.key !== 'summary';
          // in-progress: streaming, batch1 done (or is summary tab), this tab not done
          const isInProgress = isStreaming && !tabDone && !isWaiting;
          // done: streaming and this tab's batch has arrived
          const isDoneNow    = isStreaming && tabDone;
          return (
            <button
              key={t.key}
              onClick={() => startTransition(() => setTab(t.key))}
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
        {tab === 'industry_history' && (
          !batchDone(TAB_BATCH.industry_history) ? <TimelineSkeleton /> :
          data.industry_history_v2
            ? <IndustryHistoryV2Tab h={data.industry_history_v2} sources={data.industry_history_v2.sources ?? data.sources?.industry_history} />
            : <IndustryHistoryTab data={data} />
        )}
        {tab === 'tech_evolution' && (
          !batchDone(TAB_BATCH.tech_evolution) ? <CardsSkeleton count={4} /> :
          data.tech_evolution_v2
            ? <TechEvolutionV2Tab t={data.tech_evolution_v2} sources={data.tech_evolution_v2.sources ?? data.sources?.tech_evolution} />
            : <TechEvolutionTab data={data} />
        )}
        {tab === 'value_chain' && (
          !batchDone(TAB_BATCH.value_chain) ? <CardsSkeleton count={4} /> :
          data.value_chain_v2
            ? <ValueChainV2Tab vc={data.value_chain_v2} sources={data.value_chain_v2.sources ?? data.sources?.value_chain} />
            : <ValueChainTab data={data} />
        )}
        {tab === 'business_model' && (
          !batchDone(TAB_BATCH.business_model) ? <CardsSkeleton count={3} /> :
          data.business_model_v2
            ? <BusinessModelV2Tab bm={data.business_model_v2} sources={data.business_model_v2.sources ?? data.sources?.business_model} />
            : <BusinessModelTab data={data} />
        )}
        {tab === 'competitors' && (
          !batchDone(TAB_BATCH.competitors) ? <CardsSkeleton count={4} /> :
          data.competitors_v2
            ? <CompetitorsV2Tab c={data.competitors_v2} sources={data.competitors_v2.sources ?? data.sources?.competitors} />
            : <CompetitorsTab data={data} />
        )}
        {tab === 'strategy' && (
          !batchDone(TAB_BATCH.strategy) ? <CardsSkeleton count={3} /> :
          data.strategy_v2
            ? <StrategyV2Tab s={data.strategy_v2} sources={data.strategy_v2.sources ?? data.sources?.strategy} />
            : <StrategyTab data={data} />
        )}
        {tab === 'financials' && (
          !batchDone(TAB_BATCH.financials) ? <TableSkeleton rows={5} cols={7} /> :
          financialsV2Local
            ? <FinancialsV2Tab
                f={financialsV2Local}
                sources={financialsV2Local.sources ?? data.sources?.financials}
                onRefresh={handleRefreshFinancials}
                isRefreshing={refreshingFinancials}
                dataSource={data.dataSource}
              />
            : <FinancialsTab data={data} />
        )}
        {tab === 'founder' && (
          !batchDone(TAB_BATCH.founder) ? <FounderSkeleton /> :
          data.founder_v2
            ? <FounderV2Tab f={data.founder_v2} />
            : <p className="text-sm text-gray-500 py-4 text-center">창업자 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );
}

const AnalysisCard = memo(AnalysisCardInner);
export default AnalysisCard;

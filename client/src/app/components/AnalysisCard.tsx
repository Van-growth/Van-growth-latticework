'use client';

import { useState } from 'react';
import {
  BarChart2, Zap, GitBranch, Users, DollarSign, Target,
  BookOpen, ExternalLink, ChevronRight, Building2, Clock, Briefcase,
} from 'lucide-react';
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
} from '@/types';

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

function MetricCard({ value, label, trend }: { value: string; label: string; trend?: 'up' | 'down' | 'flat' }) {
  const trendEl = trend === 'up'
    ? <span className="text-green-500 text-[10px] ml-1">↑</span>
    : trend === 'down'
    ? <span className="text-red-500 text-[10px] ml-1">↓</span>
    : trend === 'flat'
    ? <span className="text-gray-400 text-[10px] ml-1">→</span>
    : null;
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div className="text-xl font-medium text-gray-900 leading-none flex items-baseline">
        {value}
        {trendEl}
      </div>
    </div>
  );
}

function ProgressBar({ value, color = 'bg-blue-400', height = 'h-1.5' }: {
  value: number;
  color?: string;
  height?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`${height} bg-gray-100 rounded-full overflow-hidden`}>
      <div className={`${height} ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
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
  const [numPart, descPart] = splitCfValue(value);
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="text-sm font-medium text-gray-900 leading-snug break-words">{numPart}</div>
      {descPart && <div className="text-xs text-gray-500 leading-snug mt-0.5 break-words">{descPart}</div>}
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-4 pt-3 border-t border-gray-50">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={11} className="text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">참고 출처</span>
      </div>
      <div className="flex flex-col gap-1">
        {sources.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 truncate">
            <ExternalLink size={10} className="shrink-0" />
            {s.title || s.url}
          </a>
        ))}
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

function SummaryV2Tab({ s, sources }: { s: SummaryV2; sources: Source[] | undefined }) {
  const vcPos = VC_POSITION_CFG[s.value_chain_position] ?? VC_POSITION_CFG.midstream;
  return (
    <div className="space-y-4">
      {/* One-line headline */}
      <div className="bg-gray-900 rounded-xl px-5 py-4 flex items-center justify-between gap-3">
        <p className="text-white font-semibold text-sm leading-snug flex-1">{s.one_line}</p>
        <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${vcPos.cls}`}>
          {vcPos.label}
        </span>
      </div>

      {/* Key metrics */}
      {s.key_metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {s.key_metrics.map((m, i) => (
            <MetricCard key={i} value={m.value} label={m.label} trend={m.trend} />
          ))}
        </div>
      )}

      {/* Products + Markets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <span className="text-gray-700">{m.country}</span>
                    <span className="font-medium text-gray-800">{m.revenue_share}%</span>
                  </div>
                  <ProgressBar value={m.revenue_share} color={BAR_COLORS[i % BAR_COLORS.length]} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Top customers */}
      {s.top_customers.length > 0 && (
        <SectionCard title="주요 고객사" dotColor="bg-violet-400">
          <div className="flex flex-wrap gap-2">
            {s.top_customers.map((c, i) => (
              <Tag key={i} label={c} color="violet" />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Bull / Bear */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-green-600 mb-2">Bull Case</div>
          <p className="text-sm text-gray-700 leading-relaxed">{s.bull_case}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-2">Bear Case</div>
          <p className="text-sm text-gray-700 leading-relaxed">{s.bear_case}</p>
        </div>
      </div>

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

function IndustryHistoryV2Tab({ h, sources }: { h: IndustryHistoryV2; sources: Source[] | undefined }) {
  return (
    <div className="space-y-4">
      <div>
        {h.timeline.map((item, i) => {
          const isLast = i === h.timeline.length - 1;
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
}

// ── Legacy Tab: 산업역사 ──────────────────────────────────────────────────────

function Timeline({ text, sourcesKey, data }: {
  text: string;
  sourcesKey: keyof typeof data.sources;
  data: AnalysisDetail;
}) {
  const lines = splitLines(text);
  type Item = { period: string; sortYear: number; content: string };
  const items: Item[] = [];
  for (const line of lines) {
    const m = line.match(/^((?:19|20)\d{2}(?:년대?|s)?(?:\s*[~\-–]\s*(?:(?:19|20)\d{2}(?:년대?|s)?|현재))?)\s*[:·]?\s*/);
    if (m) {
      const yearNum = parseInt(m[1].match(/\d{4}/)?.[0] ?? '0');
      items.push({ period: m[1], sortYear: yearNum, content: line.slice(m[0].length) });
    } else if (items.length > 0) {
      items[items.length - 1].content += ' ' + line;
    } else {
      items.push({ period: '', sortYear: 0, content: line });
    }
  }
  const hasYears = items.some(it => it.period !== '');
  if (hasYears) items.sort((a, b) => a.sortYear - b.sortYear);

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

function TechEvolutionV2Tab({ t, sources }: { t: TechEvolutionV2; sources: Source[] | undefined }) {
  return (
    <div className="space-y-4">
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

      <SourcesList sources={sources} />
    </div>
  );
}

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

function ValueChainV2Tab({ vc, sources }: { vc: ValueChainV2; sources: Source[] | undefined }) {
  return (
    <div className="space-y-4">
      {/* Horizontal flow */}
      <SectionCard title="밸류체인 레이어" dotColor="bg-indigo-400">
        <div className="flex items-start gap-2 overflow-x-auto pb-2">
          {vc.layers.map((layer, i) => {
            const pp = PRICING_POWER_CFG[layer.pricing_power] ?? PRICING_POWER_CFG.medium;
            return (
              <div key={i} className="flex items-center gap-2 shrink-0">
                <div className={`rounded-xl border-2 p-3 min-w-[130px] ${
                  layer.is_subject
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-100 bg-white'
                }`}>
                  <div className={`text-xs font-semibold mb-1 ${layer.is_subject ? 'text-blue-700' : 'text-gray-800'}`}>
                    {layer.name}
                    {layer.is_subject && <span className="ml-1.5 text-[10px] bg-blue-600 text-white rounded-full px-1.5 py-0.5">분석 대상</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-tight mb-2">{layer.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pp.cls}`}>{pp.label}</span>
                    {layer.bottleneck && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-red-50 text-red-600">Bottleneck</span>
                    )}
                  </div>
                </div>
                {i < vc.layers.length - 1 && (
                  <span className="text-gray-300 text-lg shrink-0">→</span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Global leaders per layer */}
      {vc.layers.some(l => l.global_leaders.length > 0) && (
        <SectionCard title="레이어별 글로벌 선도기업" dotColor="bg-indigo-400">
          <div className="space-y-4">
            {vc.layers.filter(l => l.global_leaders.length > 0).map((layer, i) => (
              <div key={i}>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${layer.is_subject ? 'bg-blue-400' : 'bg-gray-300'}`} />
                  {layer.name}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {layer.global_leaders.map((leader, j) => (
                    <div key={j} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-800">{leader.name}</span>
                        <span className="text-[10px] bg-gray-200 text-gray-600 rounded px-1.5 py-0.5">{leader.country}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed">{leader.why_leader}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Value flow + subject position */}
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

      <SourcesList sources={sources} />
    </div>
  );
}

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

function BusinessModelV2Tab({ bm, sources }: { bm: BusinessModelV2; sources: Source[] | undefined }) {
  const gm = GROWTH_MOTION_CFG[bm.growth_motion] ?? GROWTH_MOTION_CFG.hybrid;
  const ue = bm.unit_economics;
  const ueMetrics = [
    { label: 'Gross Margin', value: `${ue.gross_margin}%` },
    { label: 'Operating Margin', value: `${ue.operating_margin}%` },
    { label: 'Net Margin', value: `${ue.net_margin}%` },
    { label: 'FCF Margin', value: `${ue.fcf_margin}%` },
    ...(ue.nrr ? [{ label: 'NRR', value: `${ue.nrr}%` }] : []),
  ].filter(m => m.value !== '0%');

  return (
    <div className="space-y-4">
      {/* Revenue streams */}
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

      {/* Growth motion + unit economics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SectionCard title="Growth Motion" dotColor="bg-blue-400">
          <div className="mb-3">
            <span className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full ${gm.cls}`}>
              {gm.label}
            </span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{bm.growth_motion_detail}</p>
        </SectionCard>

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
      </div>

      {/* Segments */}
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

      {/* Moat */}
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

      <SourcesList sources={sources} />
    </div>
  );
}

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

function CompetitorsV2Tab({ c, sources }: { c: CompetitorsV2; sources: Source[] | undefined }) {
  const pos = COMPETITIVE_POSITION_CFG[c.competitive_position] ?? COMPETITIVE_POSITION_CFG.niche;
  return (
    <div className="space-y-4">
      {/* Position badge */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-400">경쟁 포지션</span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full ${pos.cls}`}>{pos.label}</span>
      </div>

      {/* Direct competitors */}
      {c.direct.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-orange-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {c.direct.map((comp, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900 text-sm">{comp.name}</span>
                  <span className="shrink-0 bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{comp.country}</span>
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

      {/* Indirect + substitutes */}
      {(c.indirect.length > 0 || c.substitutes.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      <SourcesList sources={sources} />
    </div>
  );
}

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

function StrategyV2Tab({ s, sources }: { s: StrategyV2; sources: Source[] | undefined }) {
  const sections = [
    {
      label: '기업 전략 (Corporate)',
      dotColor: 'bg-violet-400',
      direction: s.corporate.direction,
      items: [
        { label: '포트폴리오', value: s.corporate.portfolio },
        { label: 'M&A / 파트너십', value: s.corporate.ma_partnerships.join(' · ') },
        { label: '지역 확장', value: s.corporate.geographic },
      ].filter(it => it.value),
    },
    {
      label: '사업 전략 (Business)',
      dotColor: 'bg-blue-400',
      direction: s.business.direction,
      items: [
        { label: '경쟁 우위', value: s.business.competitive_advantage },
        { label: 'GTM', value: s.business.go_to_market },
        { label: '제품 로드맵', value: s.business.product_roadmap.join(' / ') },
      ].filter(it => it.value),
    },
    {
      label: '재무 전략 (Financial)',
      dotColor: 'bg-emerald-400',
      direction: s.financial.direction,
      items: [
        { label: '자본 배분', value: s.financial.capital_allocation },
        { label: '투자 우선순위', value: s.financial.investment_priority },
        { label: '목표 수익성', value: s.financial.return_target },
      ].filter(it => it.value),
    },
  ];

  return (
    <div className="space-y-1">
      {sections.map((sec, si) => (
        <div key={sec.label}>
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${sec.dotColor}`} />
              {sec.label}
            </div>
            <p className="text-sm font-semibold text-gray-800 leading-snug mb-3 pl-3.5">{sec.direction}</p>
            {sec.items.length > 0 && (
              <div>
                {sec.items.map((item, i) => (
                  <div key={i} className={`flex gap-3 items-start py-2.5 ${i < sec.items.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <span className="shrink-0 w-24 text-[11px] text-gray-400 pt-0.5 leading-tight">{item.label}</span>
                    <p className="text-sm text-gray-700 leading-relaxed flex-1">{item.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {si < sections.length - 1 && (
            <div className="flex justify-center py-1">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-px h-3 bg-gray-200" />
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="opacity-40">
                  <path d="M5 6L0 0h10L5 6z" fill="#6b7280" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="pt-2 space-y-3">
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

      <div className="pt-2">
        <SourcesList sources={sources} />
      </div>
    </div>
  );
}

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

// ── V2 Tab: 재무 ──────────────────────────────────────────────────────────────

const IS_COLS_V2: Array<keyof Omit<FinancialsV2Row, 'item' | 'yoy'>> =
  ['fy2021', 'fy2022', 'fy2023', 'fy2024', 'fy2025'];

const IS_BOLD_ITEMS = ['매출', '영업이익', '순이익'];

function FinancialsV2Tab({ f, sources }: { f: FinancialsV2; sources: Source[] | undefined }) {
  const yoyCls = (v?: string) => {
    if (!v || v === '—') return 'text-gray-400';
    return v.startsWith('▲') ? 'text-green-600 font-medium' : v.startsWith('▼') ? 'text-red-500 font-medium' : 'text-gray-500';
  };

  const mbMetrics = [
    { label: 'ROE',           value: f.munger_buffett_metrics.roe },
    { label: 'ROIC',          value: f.munger_buffett_metrics.roic },
    { label: 'Owner Earnings', value: f.munger_buffett_metrics.owner_earnings },
    { label: 'D/E Ratio',     value: f.munger_buffett_metrics.debt_to_equity },
    { label: 'Interest Coverage', value: f.munger_buffett_metrics.interest_coverage },
    { label: 'Reinvestment Rate', value: f.munger_buffett_metrics.reinvestment_rate },
  ].filter(m => m.value && m.value !== '추정 불가');

  const cfDots: Record<string, string> = {
    'Operating CF':  'bg-blue-400',
    'Investing CF':  'bg-amber-400',
    'Financing CF':  'bg-gray-400',
    'FCF':           'bg-green-500',
  };

  return (
    <div className="space-y-4">
      {/* Narrative */}
      {f.narrative && (
        <SectionCard title="재무 서사" dotColor="bg-emerald-400">
          <div className="space-y-1.5">
            {splitLines(f.narrative).map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Income statement */}
      {f.income_statement.length > 0 && (
        <SectionCard title="손익계산서 (I/S)" dotColor="bg-blue-400">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[100px]">항목</th>
                  {IS_COLS_V2.map(col => (
                    <th key={col} className={`text-right py-2 px-2 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${col === 'fy2024' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {col.replace('fy', 'FY')}
                    </th>
                  ))}
                  <th className="text-right py-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {f.income_statement.map((row, i) => {
                  const isBold = IS_BOLD_ITEMS.some(b => row.item.includes(b));
                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className={`py-2.5 pr-3 text-xs ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                      {IS_COLS_V2.map(col => (
                        <td key={col} className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${isBold && col === 'fy2024' ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>
                          {row[col] ?? '—'}
                        </td>
                      ))}
                      <td className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${yoyCls(row.yoy)}`}>{row.yoy ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Balance sheet */}
      {f.balance_sheet.length > 0 && (
        <SectionCard title="재무상태표 (B/S)" dotColor="bg-indigo-400">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[130px]">항목</th>
                  {(['fy2023', 'fy2024', 'fy2025'] as const).map(col => (
                    <th key={col} className={`text-right py-2 px-2 text-[11px] font-semibold uppercase tracking-widest whitespace-nowrap ${col === 'fy2024' ? 'text-gray-600' : 'text-gray-400'}`}>
                      {col.replace('fy', 'FY')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {f.balance_sheet.map((row, i) => {
                  const isBold = ['총자산', '총부채', '자본총계'].includes(row.item);
                  return (
                    <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${isBold ? 'bg-gray-50' : ''}`}>
                      <td className={`py-2.5 pr-3 text-xs ${isBold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                      <td className={`py-2.5 px-2 text-right font-mono text-xs whitespace-nowrap ${isBold ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Cash flow */}
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

      {/* Munger/Buffett metrics */}
      {mbMetrics.length > 0 && (
        <SectionCard title="Munger / Buffett Metrics" dotColor="bg-amber-400">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {mbMetrics.map((m, i) => <MetricCard key={i} label={m.label} value={m.value} />)}
          </div>
        </SectionCard>
      )}

      {/* Key risks */}
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

      <SourcesList sources={sources} />
    </div>
  );
}

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
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${yoyCls(row.yoy)}`}>{row.yoy ?? '—'}</td>
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

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'summary',          label: '요약',         icon: Briefcase },
  { key: 'industry_history', label: '산업역사',     icon: Clock },
  { key: 'tech_evolution',   label: '기술변화',     icon: Zap },
  { key: 'value_chain',      label: '밸류체인',     icon: GitBranch },
  { key: 'business_model',   label: '비즈니스모델', icon: DollarSign },
  { key: 'competitors',      label: '경쟁사',       icon: Users },
  { key: 'strategy',         label: '전략',         icon: Target },
  { key: 'financials',       label: '재무',         icon: BarChart2 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AnalysisCard({ data }: { data: AnalysisDetail }) {
  const [tab, setTab] = useState<TabKey>('summary');

  const renderTab = () => {
    switch (tab) {
      case 'summary':
        return data.summary_v2
          ? <SummaryV2Tab s={data.summary_v2} sources={data.sources?.summary} />
          : <SummaryTab data={data} />;
      case 'industry_history':
        return data.industry_history_v2
          ? <IndustryHistoryV2Tab h={data.industry_history_v2} sources={data.sources?.industry_history} />
          : <IndustryHistoryTab data={data} />;
      case 'tech_evolution':
        return data.tech_evolution_v2
          ? <TechEvolutionV2Tab t={data.tech_evolution_v2} sources={data.sources?.tech_evolution} />
          : <TechEvolutionTab data={data} />;
      case 'value_chain':
        return data.value_chain_v2
          ? <ValueChainV2Tab vc={data.value_chain_v2} sources={data.sources?.value_chain} />
          : <ValueChainTab data={data} />;
      case 'business_model':
        return data.business_model_v2
          ? <BusinessModelV2Tab bm={data.business_model_v2} sources={data.sources?.business_model} />
          : <BusinessModelTab data={data} />;
      case 'competitors':
        return data.competitors_v2
          ? <CompetitorsV2Tab c={data.competitors_v2} sources={data.sources?.competitors} />
          : <CompetitorsTab data={data} />;
      case 'strategy':
        return data.strategy_v2
          ? <StrategyV2Tab s={data.strategy_v2} sources={data.sources?.strategy} />
          : <StrategyTab data={data} />;
      case 'financials':
        return data.financials_v2
          ? <FinancialsV2Tab f={data.financials_v2} sources={data.sources?.financials} />
          : <FinancialsTab data={data} />;
    }
  };

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
          <DataSourceBadge source={data.dataSource ?? 'web_search'} />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-100 bg-white px-2">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 flex items-center gap-1.5 py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5 bg-gray-50 min-h-[300px]">
        {renderTab()}
      </div>
    </div>
  );
}

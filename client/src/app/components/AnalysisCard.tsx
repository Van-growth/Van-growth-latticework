'use client';

import { useState } from 'react';
import {
  BarChart2, TrendingUp, Layers, Users, Briefcase, Target,
  DollarSign, Clock, Globe, Shield, AlertTriangle, ChevronRight,
  ExternalLink, Zap, Award, Activity, BookOpen, GitBranch,
  Building2, ArrowRight, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import {
  AnalysisDetail,
  Metric,
  MoatAnalysis,
  RiskAnalysis,
  CompetitorsAnalysis,
  StrategyAnalysis,
  StructuredFinancials,
  DataSource,
  Source,
} from '@/types';

// ── Primitives ────────────────────────────────────────────────────────────────

function Tag({ label, color = 'gray' }: { label: string; color?: string }) {
  const map: Record<string, string> = {
    gray:    'bg-gray-100 text-gray-600',
    blue:    'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    red:     'bg-red-50 text-red-700',
    violet:  'bg-violet-50 text-violet-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[color] ?? map.gray}`}>
      {label}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children, className = '' }: {
  title?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-100 rounded-xl shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          {Icon && <Icon size={13} className="text-gray-400 shrink-0" />}
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</span>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div className="text-xl font-medium text-gray-900 leading-none">{value}</div>
    </div>
  );
}

function SourcesList({ sources }: { sources: Source[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={11} className="text-gray-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">참고 출처</span>
      </div>
      <div className="flex flex-col gap-1">
        {sources.map((s, i) => (
          <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 truncate group">
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
  dart:       { label: 'DART 연동됨',     cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  edgar:      { label: 'SEC EDGAR 연동됨', cls: 'bg-blue-50 text-blue-700',      dot: 'bg-blue-500' },
  web_search: { label: '웹 검색 기반',     cls: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' },
};

function DataSourceBadge({ source }: { source: DataSource }) {
  const cfg = DATA_SOURCE_CONFIG[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Tab: 요약 ─────────────────────────────────────────────────────────────────

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
    <div className="space-y-5">
      {/* Metric grid — 4 cols, up to 2 rows */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map((m, i) => (
            <MetricCard
              key={i}
              value={m.value}
              label={m.unit ? `${m.label} (${m.unit})` : m.label}
            />
          ))}
        </div>
      )}

      {/* Prose summary */}
      <SectionCard title="경영 요약" icon={Briefcase}>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
          ))}
        </div>
      </SectionCard>

      {/* Strengths / Risks 2-col */}
      {(strengths.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <SectionCard title="핵심 강점" icon={Award}>
              <div className="space-y-2">
                {strengths.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <p className="text-xs text-gray-700 leading-relaxed">{l}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
          {risks.length > 0 && (
            <SectionCard title="주요 리스크" icon={AlertTriangle}>
              <div className="space-y-2">
                {risks.map((l, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    <p className="text-xs text-gray-700 leading-relaxed">{l}</p>
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

// ── Tab: 산업 역사 ─────────────────────────────────────────────────────────────

function Timeline({ text, sourcesKey, data }: {
  text: string;
  sourcesKey: keyof typeof data.sources;
  data: AnalysisDetail;
}) {
  const lines = splitLines(text);

  type Item = { period: string; content: string };
  const items: Item[] = [];
  for (const line of lines) {
    const m = line.match(/^((?:19|20)\d{2}(?:년대?|s)?(?:\s*[~\-–]\s*(?:(?:19|20)\d{2}(?:년대?|s)?|현재))?)\s*[:·]?\s*/);
    if (m) {
      items.push({ period: m[1], content: line.slice(m[0].length) });
    } else if (items.length > 0) {
      items[items.length - 1].content += ' ' + line;
    } else {
      items.push({ period: '', content: line });
    }
  }

  const hasYears = items.some(it => it.period !== '');

  return (
    <>
      <div className="space-y-0">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center pt-0.5">
              <div className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${item.period ? 'bg-blue-500 border-blue-500' : 'bg-gray-300 border-gray-300'}`} />
              {i < items.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1 min-h-[1.5rem]" />}
            </div>
            <div className="pb-5 min-w-0 flex-1">
              {item.period && hasYears && (
                <span className="inline-block text-[11px] font-semibold text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 mb-1.5 leading-none">
                  {item.period}
                </span>
              )}
              <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
            </div>
          </div>
        ))}
      </div>
      <SourcesList sources={data.sources?.[sourcesKey] as Source[] | undefined} />
    </>
  );
}

function IndustryHistoryTab({ data }: { data: AnalysisDetail }) {
  return (
    <SectionCard title="산업 발전 연혁" icon={Clock}>
      <Timeline text={data.industry_history} sourcesKey="industry_history" data={data} />
    </SectionCard>
  );
}

// ── Tab: 기술 변화 ─────────────────────────────────────────────────────────────

function TechEvolutionTab({ data }: { data: AnalysisDetail }) {
  const lines = splitLines(data.tech_evolution);
  const points: string[] = [];
  let buf = '';
  for (const line of lines) {
    if (/^(\d+[.)]\s|[•·▶→■◆]\s?)/.test(line)) {
      if (buf) points.push(buf.trim());
      buf = line.replace(/^(\d+[.)]\s|[•·▶→■◆]\s?)/, '');
    } else {
      buf = buf ? buf + ' ' + line : line;
    }
  }
  if (buf) points.push(buf.trim());
  if (points.length === 0 && data.tech_evolution) points.push(data.tech_evolution);

  return (
    <SectionCard title="기술 변화 트렌드" icon={Zap}>
      <div className="space-y-3">
        {points.map((point, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600 text-white text-[11px] flex items-center justify-center font-semibold leading-none">
              {i + 1}
            </span>
            <p className="text-sm text-gray-700 leading-relaxed pt-0.5">{point}</p>
          </div>
        ))}
      </div>
      <SourcesList sources={data.sources?.tech_evolution} />
    </SectionCard>
  );
}

// ── Tab: 밸류체인 ──────────────────────────────────────────────────────────────

function ValueChainTab({ data }: { data: AnalysisDetail }) {
  const players = data.valuechainPlayers ?? [];
  const companyName = data.companyName?.toLowerCase() ?? '';

  // Classify players into chain positions
  const upstream: typeof players = [];
  const target: typeof players = [];
  const downstream: typeof players = [];

  for (const p of players) {
    const roleLow = (p.role + p.description).toLowerCase();
    const isTargetPlayer = p.player_name?.toLowerCase().includes(companyName) ||
      p.description?.toLowerCase().includes('분석 대상') ||
      p.description?.toLowerCase().includes('해당 기업');
    if (isTargetPlayer) {
      target.push(p);
    } else if (/원재료|공급|supplier|upstream|광산|채굴|소재|화학|반도체 장비/.test(roleLow)) {
      upstream.push(p);
    } else if (/유통|downstream|최종|소비|고객|판매|리테일|distribution/.test(roleLow)) {
      downstream.push(p);
    } else {
      // Heuristic: first half goes upstream, second half downstream
      if (upstream.length <= downstream.length) upstream.push(p);
      else downstream.push(p);
    }
  }

  return (
    <div className="space-y-4">
      {data.value_chain_overview && (
        <SectionCard title="밸류체인 개요" icon={GitBranch}>
          <p className="text-sm text-gray-700 leading-relaxed">{data.value_chain_overview}</p>
        </SectionCard>
      )}

      {players.length > 0 && (
        <SectionCard title="주요 플레이어" icon={Globe}>
          {/* Flow diagram header */}
          <div className="flex items-center gap-2 mb-5 px-1">
            <div className="flex-1 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Upstream</span>
            </div>
            <ArrowRight size={14} className="text-gray-300 shrink-0" />
            <div className="flex-1 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-500">분석 대상</span>
            </div>
            <ArrowRight size={14} className="text-gray-300 shrink-0" />
            <div className="flex-1 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Downstream</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p, i) => {
              const isTargetPlayer = p.player_name?.toLowerCase().includes(companyName) ||
                p.description?.toLowerCase().includes('분석 대상') ||
                p.description?.toLowerCase().includes('해당 기업');
              return (
                <div key={i} className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${
                  isTargetPlayer
                    ? 'border-blue-200 bg-blue-50 ring-1 ring-blue-100'
                    : 'border-gray-100 bg-white'
                }`}>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${isTargetPlayer ? 'text-blue-500' : 'text-gray-400'}`}>
                      {p.role}
                    </span>
                    {isTargetPlayer && (
                      <span className="shrink-0 text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 font-semibold">
                        분석 대상
                      </span>
                    )}
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

// ── Tab: 경쟁사 ───────────────────────────────────────────────────────────────

function CompetitorsTab({ data }: { data: AnalysisDetail }) {
  const c = data.competitors as CompetitorsAnalysis | null;
  const direct = c?.direct ?? [];
  const indirect = c?.indirect ?? [];

  if (direct.length === 0 && indirect.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">경쟁사 데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-5">
      {direct.length > 0 && (
        <SectionCard title="직접 경쟁사" icon={Target}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">기업명</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">국가</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">점유율</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">핵심 강점</th>
                  <th className="text-left py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">차별점</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {direct.map((comp, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">{comp.name}</td>
                    <td className="py-3 px-3">
                      <Tag label={comp.country} color="blue" />
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">{comp.market_share}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {comp.strengths?.slice(0, 2).map((s, j) => (
                          <Tag key={j} label={s} color="emerald" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-gray-600 max-w-[200px]">{comp.differentiation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {indirect.length > 0 && (
        <SectionCard title="간접 경쟁사 / 대체재" icon={Layers}>
          <div className="flex flex-wrap gap-2">
            {indirect.map((comp, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-gray-800">{comp.name}</span>
                <Tag label={comp.type} color="amber" />
                {comp.description && (
                  <span className="text-xs text-gray-500 hidden sm:inline">{comp.description}</span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SourcesList sources={data.sources?.competitors} />
    </div>
  );
}

// ── Tab: 비즈니스 모델 ────────────────────────────────────────────────────────

function MoatBar({ strength }: { strength: string }) {
  const map: Record<string, { width: string; color: string }> = {
    '강함': { width: 'w-[90%]', color: 'bg-emerald-500' },
    '보통': { width: 'w-[60%]', color: 'bg-amber-400' },
    '약함': { width: 'w-[30%]', color: 'bg-red-400' },
  };
  const cfg = map[strength] ?? map['보통'];
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${cfg.width} ${cfg.color} h-1.5 rounded-full transition-all`} />
    </div>
  );
}

function BusinessModelTab({ data }: { data: AnalysisDetail }) {
  const moat = data.moat_analysis as MoatAnalysis | null;
  const risk = data.risk_analysis as RiskAnalysis | null;
  const ls = splitLines(data.business_model);

  // Split business model text into Revenue / UE sections
  const reLines: string[] = [];
  const ueTextLines: string[] = [];
  let section = 0;
  for (const line of ls) {
    const low = line.toLowerCase();
    if (/revenue|수익화|수익 구조|수익모델|매출/.test(low)) { section = 1; reLines.push(line); continue; }
    if (/unit economics|유닛|arpu|ltv|cac|가격|구독|수수료/.test(low)) { section = 2; ueTextLines.push(line); continue; }
    if (section === 2) ueTextLines.push(line);
    else reLines.push(line);
  }
  if (ueTextLines.length === 0 && reLines.length > 2) {
    const mid = Math.ceil(reLines.length / 2);
    ueTextLines.push(...reLines.splice(mid));
  }

  // Unit Economics structured metrics from financials_structured
  const ueData = data.financials_structured?.unit_economics;
  const ueMetrics = ueData ? [
    { label: 'Gross Margin',     value: ueData.gross_margin },
    { label: 'Operating Margin', value: ueData.operating_margin },
    { label: 'Net Margin',       value: ueData.net_margin },
    { label: 'FCF Margin',       value: ueData.fcf_margin },
    ...(ueData.nrr ? [{ label: 'NRR', value: ueData.nrr }] : []),
  ].filter((m): m is { label: string; value: string } =>
    !!m.value && m.value !== '공개 없음'
  ) : [];

  const strengthStyle: Record<string, string> = {
    '강함': 'bg-emerald-50 text-emerald-700',
    '보통': 'bg-amber-50 text-amber-700',
    '약함': 'bg-red-50 text-red-700',
  };
  const severityStyle: Record<string, { bg: string; text: string }> = {
    '높음': { bg: 'bg-red-50',     text: 'text-red-700' },
    '중간': { bg: 'bg-amber-50',   text: 'text-amber-700' },
    '낮음': { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  };

  const riskGroups = risk ? [
    { label: '비즈니스', data: risk.business },
    { label: '재무',     data: risk.financial },
    { label: '외부',     data: risk.external },
  ].filter(g => (g.data?.items?.length ?? 0) > 0) : [];

  return (
    <div className="space-y-5">
      {/* Revenue Engine / Unit Economics 2-col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SectionCard title="Revenue Engine" icon={DollarSign}>
          <div className="space-y-2">
            {reLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Unit Economics" icon={BarChart2}>
          {ueMetrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {ueMetrics.map((m, i) => (
                <MetricCard key={i} label={m.label} value={m.value} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {ueTextLines.map((l, i) => (
                <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Moat Analysis */}
      {moat && (moat.types?.length > 0 || moat.sustain_conditions || moat.collapse_scenarios) && (
        <SectionCard title="해자 분석 (Economic Moat)" icon={Shield}>
          <div className="space-y-4">
            {moat.types?.length > 0 && (
              <div className="space-y-3">
                {moat.types.map((t, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${strengthStyle[t.strength] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.strength}
                      </span>
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
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-1">유지 조건</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{moat.sustain_conditions}</p>
                </div>
              )}
              {moat.collapse_scenarios && (
                <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-1">붕괴 시나리오</div>
                  <p className="text-xs text-gray-700 leading-relaxed">{moat.collapse_scenarios}</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Risk Analysis */}
      {riskGroups.length > 0 && (
        <SectionCard title="리스크 분석" icon={AlertTriangle}>
          <div className="space-y-4">
            {riskGroups.map(({ label, data: g }) => {
              const sev = severityStyle[g.severity] ?? severityStyle['중간'];
              return (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700">{label} 리스크</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${sev.bg} ${sev.text}`}>
                      {g.severity}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        {g.items.map((item, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="py-2 pr-3 w-20 shrink-0">
                              <Tag label={item.category} color="gray" />
                            </td>
                            <td className="py-2 text-gray-700 leading-relaxed">{item.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

// ── Tab: 전략 ─────────────────────────────────────────────────────────────────

function StrategyTab({ data }: { data: AnalysisDetail }) {
  const s = data.strategy as StrategyAnalysis | null;
  if (!s || (!s.corporate && !s.business && !s.financial)) {
    return <p className="text-sm text-gray-500 py-4 text-center">전략 데이터가 없습니다.</p>;
  }

  function HighlightNumbers({ text }: { text: string }) {
    const parts = text.split(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|T|%|배|원|x)+)/g);
    return (
      <>
        {parts.map((p, i) =>
          /\d/.test(p)
            ? <strong key={i} className="text-blue-700 font-semibold">{p}</strong>
            : <span key={i}>{p}</span>
        )}
      </>
    );
  }

  const sections = [
    {
      label: '기업 전략', icon: Building2,
      headerCls: 'text-violet-800', bgCls: 'bg-violet-50 border-violet-100', labelCls: 'text-violet-600',
      items: s.corporate ? [
        { label: '포트폴리오',    value: s.corporate.portfolio_direction },
        { label: 'M&A / 파트너십', value: s.corporate.ma_partnership },
        { label: '지역 확장',     value: s.corporate.regional_expansion },
        ...(s.corporate.notes ? [{ label: '비고', value: s.corporate.notes }] : []),
      ] : [],
    },
    {
      label: '사업 전략', icon: Target,
      headerCls: 'text-blue-800', bgCls: 'bg-blue-50 border-blue-100', labelCls: 'text-blue-600',
      items: s.business ? [
        { label: '경쟁 우위',   value: s.business.competitive_advantage },
        { label: '고객 / 채널', value: s.business.customer_channel },
        { label: '제품 로드맵', value: s.business.product_roadmap },
        ...(s.business.notes ? [{ label: '비고', value: s.business.notes }] : []),
      ] : [],
    },
    {
      label: '재무 전략', icon: DollarSign,
      headerCls: 'text-emerald-800', bgCls: 'bg-emerald-50 border-emerald-100', labelCls: 'text-emerald-600',
      items: s.financial ? [
        { label: '자본 조달',     value: s.financial.capital_raising },
        { label: '투자 우선순위', value: s.financial.investment_priority },
        { label: '배당 / 자사주', value: s.financial.dividend_buyback },
        { label: '목표 수익성',   value: s.financial.profitability_target },
        ...(s.financial.notes ? [{ label: '비고', value: s.financial.notes }] : []),
      ] : [],
    },
  ];

  return (
    <div className="space-y-4">
      {sections.map(sec => {
        const filled = sec.items.filter(it => it.value);
        if (!filled.length) return null;
        return (
          <div key={sec.label} className={`border rounded-xl p-5 ${sec.bgCls}`}>
            <div className="flex items-center gap-2 mb-4">
              <sec.icon size={14} className={sec.labelCls} />
              <h4 className={`text-sm font-semibold ${sec.headerCls}`}>{sec.label}</h4>
            </div>
            <div className="space-y-3">
              {filled.map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span className={`shrink-0 text-xs font-semibold w-24 pt-0.5 ${sec.labelCls}`}>{item.label}</span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    <HighlightNumbers text={item.value!} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <SourcesList sources={data.sources?.strategy} />
    </div>
  );
}

// ── Tab: 재무 ─────────────────────────────────────────────────────────────────

type FinRow = { label: string; values: string[]; isHeader?: boolean };

function parseFinancials(text: string): {
  isRows: FinRow[];
  bsRows: FinRow[];
  cfRows: FinRow[];
  notes: string[];
  years: string[];
} {
  const lines = splitLines(text);
  const years: string[] = [];
  const isRows: FinRow[] = [];
  const bsRows: FinRow[] = [];
  const cfRows: FinRow[] = [];
  const notes: string[] = [];

  for (const l of lines) {
    const ys = l.match(/20\d{2}/g);
    if (ys) ys.forEach(y => { if (!years.includes(y)) years.push(y); });
  }
  years.sort().reverse();
  const displayYears = years.slice(0, 3);

  function isNumberLine(l: string) {
    return (l.match(/[\d,]+/g) ?? []).length >= 1;
  }

  for (const l of lines) {
    const low = l.toLowerCase();
    if (/매출|revenue|순매출|영업이익|operating|순이익|net income|당기순|ebitda|매출총이익|gross|r&d|연구개발/.test(low)) {
      if (isNumberLine(l)) {
        const nums = l.match(/[$₩]?[\d,.]+(?:억|조|B|M|T|K)?/g) ?? [];
        isRows.push({ label: l.replace(/[$₩\d,.%억조BMK\s]+/g, ' ').trim().slice(0, 30), values: nums.slice(0, 3) });
      }
    } else if (/자산|부채|자본|equity|asset|liab/.test(low)) {
      if (isNumberLine(l)) {
        const nums = l.match(/[$₩]?[\d,.]+(?:억|조|B|M|T|K)?/g) ?? [];
        bsRows.push({ label: l.replace(/[$₩\d,.%억조BMK\s]+/g, ' ').trim().slice(0, 30), values: nums.slice(0, 3) });
      }
    } else if (/현금흐름|cash flow|capex|fcf|영업활동|투자활동|재무활동/.test(low)) {
      if (isNumberLine(l)) {
        const nums = l.match(/[$₩]?[\d,.]+(?:억|조|B|M|T|K)?/g) ?? [];
        cfRows.push({ label: l.replace(/[$₩\d,.%억조BMK\s]+/g, ' ').trim().slice(0, 30), values: nums.slice(0, 3) });
      }
    } else if (!isNumberLine(l) && l.length > 10) {
      notes.push(l);
    }
  }

  return { isRows, bsRows, cfRows, notes: notes.slice(0, 5), years: displayYears };
}

function FinancialsTab({ data }: { data: AnalysisDetail }) {
  const fs = data.financials_structured as StructuredFinancials | null | undefined;
  const hasStructured = !!(
    fs &&
    ((fs.income_statement?.length ?? 0) > 0 ||
     (fs.balance_sheet?.length ?? 0) > 0 ||
     fs.cash_flow?.operating)
  );

  const { isRows, bsRows, cfRows, notes, years } = parseFinancials(data.financials);
  const rawLines = splitLines(data.financials);

  const IS_COLS = ['FY2023', 'FY2024', 'FY2025'];

  const yoyColor = (v?: string) => {
    if (!v || v === '—') return 'text-gray-400';
    return v.startsWith('▲') ? 'text-emerald-600 font-semibold' : v.startsWith('▼') ? 'text-red-500 font-semibold' : 'text-gray-500';
  };

  const BOLD_IS_ITEMS = ['매출', '영업이익', '순이익'];

  return (
    <div className="space-y-5">
      {/* Prose narrative */}
      {data.financials && (
        <SectionCard title="재무 서사" icon={Briefcase}>
          <div className="space-y-1.5">
            {splitLines(data.financials).map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {hasStructured ? (
        <>
          {/* Income Statement */}
          {fs!.income_statement?.length > 0 && (
            <SectionCard title="손익계산서 (I/S)" icon={TrendingUp}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[110px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{y}</th>
                      ))}
                      <th className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">YoY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.income_statement.map((row, i) => {
                      const isBold = BOLD_IS_ITEMS.some(b => row.item.includes(b));
                      return (
                        <tr key={i} className={`hover:bg-gray-50 transition-colors ${isBold ? 'bg-gray-50/50' : ''}`}>
                          <td className={`py-2.5 pr-4 text-xs ${isBold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${isBold ? 'text-gray-800 font-semibold' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${yoyColor(row.yoy)}`}>{row.yoy ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Balance Sheet */}
          {fs!.balance_sheet?.length > 0 && (
            <SectionCard title="재무상태표 (B/S)" icon={BarChart2}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[130px]">항목</th>
                      {IS_COLS.map(y => (
                        <th key={y} className="text-right py-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {fs!.balance_sheet.map((row, i) => {
                      const isHeader = row.item === '총자산';
                      return (
                        <tr key={i} className={`hover:bg-gray-50 transition-colors ${isHeader ? 'bg-gray-50' : ''}`}>
                          <td className={`py-2.5 pr-4 text-xs ${isHeader ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${isHeader ? 'text-gray-800 font-semibold' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2025 ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Cash Flow — 4 metric cards */}
          {fs!.cash_flow && (
            <SectionCard title="현금흐름 (C/F)" icon={Activity}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: '영업활동 CF', value: fs!.cash_flow.operating },
                  { label: '투자활동 CF', value: fs!.cash_flow.investing },
                  { label: '재무활동 CF', value: fs!.cash_flow.financing },
                  { label: 'Free Cash Flow', value: fs!.cash_flow.free_cash_flow },
                ].map(({ label, value }) => (
                  <MetricCard key={label} label={label} value={value || '—'} />
                ))}
              </div>
              {fs!.cash_flow.notes && (
                <p className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
                  {fs!.cash_flow.notes}
                </p>
              )}
            </SectionCard>
          )}
        </>
      ) : (
        <>
          {/* Fallback text-parsed tables */}
          {isRows.length > 0 && (
            <SectionCard title="손익계산서 (I/S)" icon={TrendingUp}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[120px]">항목</th>
                      {(years.length > 0 ? years : ['최근']).map(y => (
                        <th key={y} className="text-right py-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {isRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-xs text-gray-700">{row.label || '—'}</td>
                        {(row.values.length > 0 ? row.values : ['—']).map((v, j) => (
                          <td key={j} className="py-2.5 px-2 text-right font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {bsRows.length > 0 && (
            <SectionCard title="재무상태표 (B/S)" icon={BarChart2}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 min-w-[120px]">항목</th>
                      {(years.length > 0 ? years : ['최근']).map(y => (
                        <th key={y} className="text-right py-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {bsRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-4 text-xs text-gray-700">{row.label || '—'}</td>
                        {(row.values.length > 0 ? row.values : ['—']).map((v, j) => (
                          <td key={j} className="py-2.5 px-2 text-right font-mono text-xs font-semibold text-gray-800 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {cfRows.length > 0 && (
            <SectionCard title="현금흐름 (C/F)" icon={Activity}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {cfRows.slice(0, 4).map((row, i) => (
                  <MetricCard key={i} label={row.label} value={row.values[0] || '—'} />
                ))}
              </div>
            </SectionCard>
          )}

          {isRows.length === 0 && bsRows.length === 0 && cfRows.length === 0 && (
            <SectionCard title="재무 현황" icon={DollarSign}>
              <div className="space-y-2">
                {rawLines.map((l, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
                ))}
              </div>
            </SectionCard>
          )}

          {notes.length > 0 && (
            <SectionCard title="특이사항" icon={AlertTriangle}>
              <div className="space-y-2">
                {notes.map((n, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <ChevronRight size={13} className="text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 leading-relaxed">{n}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      <SourcesList sources={data.sources?.financials} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'summary',          label: '요약',          icon: Briefcase },
  { key: 'industry_history', label: '산업 역사',     icon: Clock },
  { key: 'tech_evolution',   label: '기술 변화',     icon: Zap },
  { key: 'value_chain',      label: '밸류체인',      icon: GitBranch },
  { key: 'competitors',      label: '경쟁사',        icon: Users },
  { key: 'business_model',   label: '비즈니스 모델', icon: DollarSign },
  { key: 'strategy',         label: '전략',          icon: Target },
  { key: 'financials',       label: '재무',          icon: BarChart2 },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AnalysisCard({ data }: { data: AnalysisDetail }) {
  const [tab, setTab] = useState<TabKey>('summary');

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
      <div className="p-6 bg-gray-50 min-h-[300px]">
        {tab === 'summary'          && <SummaryTab          data={data} />}
        {tab === 'industry_history' && <IndustryHistoryTab  data={data} />}
        {tab === 'tech_evolution'   && <TechEvolutionTab    data={data} />}
        {tab === 'value_chain'      && <ValueChainTab       data={data} />}
        {tab === 'competitors'      && <CompetitorsTab      data={data} />}
        {tab === 'business_model'   && <BusinessModelTab    data={data} />}
        {tab === 'strategy'         && <StrategyTab         data={data} />}
        {tab === 'financials'       && <FinancialsTab       data={data} />}
      </div>
    </div>
  );
}

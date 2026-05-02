'use client';

import { useState } from 'react';
import {
  BarChart2, TrendingUp, Layers, Users, Briefcase, Target,
  DollarSign, Clock, Globe, Shield, AlertTriangle, ChevronRight,
  ExternalLink, Zap, Award, Activity, BookOpen, GitBranch,
  Building2,
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
    green:   'bg-green-50 text-green-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    red:     'bg-red-50 text-red-700',
    violet:  'bg-violet-50 text-violet-700',
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

function MetricCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div className="text-xl font-medium text-gray-900 leading-none">{value}</div>
    </div>
  );
}

function CfMetricCard({ label, value, dotColor }: { label: string; value: string; dotColor: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
        <span className="text-[11px] text-gray-400 leading-tight">{label}</span>
      </div>
      <div className="text-xl font-medium text-gray-900 leading-none">{value}</div>
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
                {yearText && (
                  <div className="text-[11px] text-purple-600 font-medium mb-1">{yearText}</div>
                )}
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

// ── Tab: 밸류체인 ──────────────────────────────────────────────────────────────

function ValueChainTab({ data }: { data: AnalysisDetail }) {
  const players = data.valuechainPlayers ?? [];
  const companyName = data.companyName?.toLowerCase() ?? '';

  const upstreamRoles: string[] = [];
  const downstreamRoles: string[] = [];

  for (const p of players) {
    const roleLow = (p.role + p.description).toLowerCase();
    const isTargetPlayer =
      p.player_name?.toLowerCase().includes(companyName) ||
      p.description?.toLowerCase().includes('분석 대상') ||
      p.description?.toLowerCase().includes('해당 기업');
    if (!isTargetPlayer) {
      if (/원재료|공급|supplier|upstream|광산|채굴|소재|화학|반도체 장비/.test(roleLow)) {
        if (!upstreamRoles.includes(p.role)) upstreamRoles.push(p.role);
      } else if (/유통|downstream|최종|소비|고객|판매|리테일|distribution/.test(roleLow)) {
        if (!downstreamRoles.includes(p.role)) downstreamRoles.push(p.role);
      }
    }
  }

  const flowNodes: { label: string; isTarget: boolean }[] = [
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
          {/* Flow bar */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {flowNodes.flatMap((node, i) => [
              <div
                key={`node-${i}`}
                className={`rounded-lg px-3 py-2 text-xs text-center flex-1 min-w-[80px] ${
                  node.isTarget
                    ? 'bg-blue-50 border-2 border-blue-300 text-blue-800 font-medium'
                    : 'bg-gray-50 text-gray-700'
                }`}
              >
                {node.label}
              </div>,
              i < flowNodes.length - 1
                ? <span key={`arrow-${i}`} className="text-gray-300 text-sm shrink-0">→</span>
                : null,
            ])}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players.map((p, i) => {
              const isTargetPlayer =
                p.player_name?.toLowerCase().includes(companyName) ||
                p.description?.toLowerCase().includes('분석 대상') ||
                p.description?.toLowerCase().includes('해당 기업');
              return (
                <div key={i} className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${
                  isTargetPlayer ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-white'
                }`}>
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className={`text-[11px] font-semibold uppercase tracking-widest ${isTargetPlayer ? 'text-blue-500' : 'text-gray-400'}`}>
                      {p.role}
                    </span>
                    {isTargetPlayer && (
                      <span className="shrink-0 text-[10px] bg-blue-600 text-white rounded-full px-2 py-0.5 font-semibold">분석 대상</span>
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
    <div className="space-y-4">
      {direct.length > 0 && (
        <SectionCard title="직접 경쟁사" dotColor="bg-orange-400">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['기업명', '국가', '점유율', '핵심 강점', '차별점'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {direct.map((comp, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">{comp.name}</td>
                    <td className="py-3 px-3">
                      <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 text-[11px] font-medium">{comp.country}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-blue-600 font-medium text-sm">{comp.market_share}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {comp.strengths?.slice(0, 2).map((s, j) => (
                          <Tag key={j} label={s} color="green" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm text-gray-600 max-w-[200px]">{comp.differentiation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

// ── Tab: 비즈니스 모델 ────────────────────────────────────────────────────────

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

  const riskGroups = risk ? [
    { label: '비즈니스', data: risk.business },
    { label: '재무',     data: risk.financial },
    { label: '외부',     data: risk.external },
  ].filter(g => (g.data?.items?.length ?? 0) > 0) : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SectionCard title="Revenue Engine" dotColor="bg-green-400">
          <div className="space-y-2">
            {reLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Unit Economics" dotColor="bg-blue-400">
          {ueMetrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
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

      {moat && (moat.types?.length > 0 || moat.sustain_conditions || moat.collapse_scenarios) && (
        <SectionCard title="해자 분석 (Economic Moat)" dotColor="bg-gray-500">
          <div className="space-y-4">
            {moat.types?.length > 0 && (
              <div className="space-y-3">
                {moat.types.map((t, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${moatBadge[t.strength] ?? 'bg-gray-100 text-gray-600'}`}>
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
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${sev.bg} ${sev.text}`}>
                      {g.severity}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-gray-50">
                      {g.items.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-50/50">
                          <td className="py-2 pr-3 w-20 shrink-0">
                            <Tag label={item.category} color="gray" />
                          </td>
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
            ? <span key={i} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[11px] font-medium mx-0.5">{p}</span>
            : <span key={i}>{p}</span>
        )}
      </>
    );
  }

  const sections = [
    {
      label: '기업 전략', dotColor: 'bg-violet-400',
      items: s.corporate ? [
        { label: '포트폴리오',     value: s.corporate.portfolio_direction },
        { label: 'M&A / 파트너십', value: s.corporate.ma_partnership },
        { label: '지역 확장',      value: s.corporate.regional_expansion },
        ...(s.corporate.notes ? [{ label: '비고', value: s.corporate.notes }] : []),
      ] : [],
    },
    {
      label: '사업 전략', dotColor: 'bg-blue-400',
      items: s.business ? [
        { label: '경쟁 우위',   value: s.business.competitive_advantage },
        { label: '고객 / 채널', value: s.business.customer_channel },
        { label: '제품 로드맵', value: s.business.product_roadmap },
        ...(s.business.notes ? [{ label: '비고', value: s.business.notes }] : []),
      ] : [],
    },
    {
      label: '재무 전략', dotColor: 'bg-emerald-400',
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
    <div className="space-y-3">
      {sections.map(sec => {
        const filled = sec.items.filter(it => it.value);
        if (!filled.length) return null;
        return (
          <SectionCard key={sec.label} title={sec.label} dotColor={sec.dotColor}>
            <div>
              {filled.map((item, i) => (
                <div key={i} className={`flex gap-3 items-start py-2.5 ${i < filled.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <span className="shrink-0 w-24 text-[11px] text-gray-400 pt-0.5 leading-tight">{item.label}</span>
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">
                    <HighlightNumbers text={item.value!} />
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        );
      })}
      <SourcesList sources={data.sources?.strategy} />
    </div>
  );
}

// ── Tab: 재무 ─────────────────────────────────────────────────────────────────

type FinRow = { label: string; values: string[] };

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

  function isNumberLine(l: string) { return (l.match(/[\d,]+/g) ?? []).length >= 1; }

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

  return { isRows, bsRows, cfRows, notes: notes.slice(0, 5), years: years.slice(0, 3) };
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
  const IS_MEDIUM_ITEMS = ['매출', '매출총이익', '영업이익', '순이익'];
  const BS_SECTION_HEADERS = ['총자산', '총부채', '자본총계'];

  const yoyCls = (v?: string) => {
    if (!v || v === '—') return 'text-gray-400';
    return v.startsWith('▲') ? 'text-green-600 font-medium' : v.startsWith('▼') ? 'text-red-500 font-medium' : 'text-gray-500';
  };

  const cfDots: Record<string, string> = {
    '영업활동 CF':    'bg-blue-400',
    '투자활동 CF':    'bg-amber-400',
    '재무활동 CF':    'bg-gray-400',
    'Free Cash Flow': 'bg-green-500',
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
                        <tr key={i} className="hover:bg-gray-50/50 transition-colors">
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
                      const isSectionHdr = BS_SECTION_HEADERS.includes(row.item);
                      return (
                        <tr key={i} className={`hover:bg-gray-50/50 transition-colors ${isSectionHdr ? 'bg-gray-50' : ''}`}>
                          <td className={`py-2.5 pr-4 text-xs ${isSectionHdr ? 'font-medium text-gray-900' : 'text-gray-600'}`}>{row.item}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-gray-500 whitespace-nowrap">{row.fy2023 ?? '—'}</td>
                          <td className={`py-2.5 px-3 text-right font-mono text-xs whitespace-nowrap ${isSectionHdr ? 'font-medium text-gray-800' : 'text-gray-700'}`}>{row.fy2024 ?? '—'}</td>
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
                <p className="mt-3 text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-3">
                  {fs!.cash_flow.notes}
                </p>
              )}
            </SectionCard>
          )}
        </>
      ) : (
        <>
          {isRows.length > 0 && (
            <SectionCard title="손익계산서 (I/S)" dotColor="bg-blue-400">
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
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="py-2.5 pr-4 text-xs text-gray-700">{row.label || '—'}</td>
                        {(row.values.length > 0 ? row.values : ['—']).map((v, j) => (
                          <td key={j} className="py-2.5 px-2 text-right font-mono text-xs font-medium text-gray-800 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {bsRows.length > 0 && (
            <SectionCard title="재무상태표 (B/S)" dotColor="bg-indigo-400">
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
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="py-2.5 pr-4 text-xs text-gray-700">{row.label || '—'}</td>
                        {(row.values.length > 0 ? row.values : ['—']).map((v, j) => (
                          <td key={j} className="py-2.5 px-2 text-right font-mono text-xs font-medium text-gray-800 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {cfRows.length > 0 && (
            <SectionCard title="현금흐름 (C/F)" dotColor="bg-green-400">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {cfRows.slice(0, 4).map((row, i) => (
                  <MetricCard key={i} label={row.label} value={row.values[0] || '—'} />
                ))}
              </div>
            </SectionCard>
          )}

          {isRows.length === 0 && bsRows.length === 0 && cfRows.length === 0 && (
            <SectionCard title="재무 현황" dotColor="bg-emerald-400">
              <div className="space-y-2">
                {rawLines.map((l, i) => (
                  <p key={i} className="text-sm text-gray-700 leading-relaxed">{l}</p>
                ))}
              </div>
            </SectionCard>
          )}

          {notes.length > 0 && (
            <SectionCard title="특이사항" dotColor="bg-amber-400">
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
      <div className="p-5 bg-gray-50 min-h-[300px]">
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

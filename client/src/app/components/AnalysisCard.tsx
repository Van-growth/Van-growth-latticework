'use client';

import { useState } from 'react';
import {
  AnalysisDetail,
  MoatAnalysis,
  RiskAnalysis,
  Source,
} from '@/types';

// ── Utilities ──────────────────────────────────────────────────────────────────

function splitLines(text: string): string[] {
  return text.split('\n').map(s => s.trim()).filter(Boolean);
}

function HighlightNumbers({ text }: { text: string }) {
  const parts = text.split(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|%|배|원|x)+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /\d/.test(part) ? (
          <strong key={i} className="text-blue-700 font-semibold">{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ── Shared: Sources ────────────────────────────────────────────────────────────

function SourcesList({ sources }: { sources: Source[] | undefined }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-5 pt-4 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">참고 출처</h4>
      <div className="flex flex-col gap-1">
        {sources.map((s, i) => (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline truncate"
          >
            {s.title || s.url}
          </a>
        ))}
      </div>
    </div>
  );
}

// ── Shared: Moat ───────────────────────────────────────────────────────────────

function MoatSection({ moat }: { moat: MoatAnalysis }) {
  if (!moat.types?.length && !moat.sustain_conditions && !moat.collapse_scenarios) return null;

  const strengthStyle: Record<string, string> = {
    '강함': 'bg-green-100 text-green-700',
    '보통': 'bg-amber-100 text-amber-700',
    '약함': 'bg-red-100 text-red-700',
  };

  return (
    <div className="mt-5 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
      <h4 className="text-sm font-bold text-indigo-800 mb-4">해자 분석 (Moat)</h4>

      {moat.types?.length > 0 && (
        <div className="space-y-3 mb-4">
          {moat.types.map((t, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-800">{t.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${strengthStyle[t.strength] ?? 'bg-gray-100 text-gray-600'}`}>
                  {t.strength}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{t.basis}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {moat.sustain_conditions && (
          <div>
            <div className="text-xs font-bold text-indigo-600 mb-1">유지 조건</div>
            <p className="text-sm text-gray-700 leading-relaxed">{moat.sustain_conditions}</p>
          </div>
        )}
        {moat.collapse_scenarios && (
          <div>
            <div className="text-xs font-bold text-red-500 mb-1">붕괴 시나리오</div>
            <p className="text-sm text-gray-700 leading-relaxed">{moat.collapse_scenarios}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared: Risk ───────────────────────────────────────────────────────────────

function RiskSection({ risk }: { risk: RiskAnalysis }) {
  const groups = [
    { label: '비즈니스 리스크', data: risk.business },
    { label: '재무 리스크',     data: risk.financial },
    { label: '외부 리스크',     data: risk.external },
  ];

  const hasContent = groups.some(g => g.data?.items?.length > 0);
  if (!hasContent) return null;

  const severityStyle: Record<string, string> = {
    '높음': 'bg-red-100 text-red-700',
    '중간': 'bg-amber-100 text-amber-700',
    '낮음': 'bg-green-100 text-green-700',
  };

  return (
    <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-5">
      <h4 className="text-sm font-bold text-rose-800 mb-4">리스크 분석</h4>
      <div className="space-y-4">
        {groups.map(({ label, data }) => {
          if (!data?.items?.length) return null;
          return (
            <div key={label}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-700">{label}</span>
                {data.severity && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityStyle[data.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                    {data.severity}
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {data.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-xs font-medium text-gray-500 w-16 shrink-0 pt-0.5">{item.category}</span>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: 요약 ──────────────────────────────────────────────────────────────────

function SummaryTab({ data }: { data: AnalysisDetail }) {
  const ls = splitLines(data.summary);
  const statLines = ls
    .filter(l => /[$₩\d].*?(?:조|억|만|B|M|K|%|배)/.test(l))
    .slice(0, 3);

  function parseStat(line: string) {
    const m = line.match(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|%|배|원)+)/);
    return {
      value: m?.[1] ?? '—',
      label: line.replace(m?.[0] ?? '', '').replace(/[:：\s·\-–]+/g, ' ').trim(),
    };
  }

  return (
    <div className="space-y-4">
      {statLines.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statLines.map((l, i) => {
            const { value, label } = parseStat(l);
            return (
              <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-700">{value}</div>
                <div className="text-xs text-gray-500 mt-1 leading-snug">{label}</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        {ls.map((l, i) => (
          <p key={i} className="text-sm text-gray-800 leading-relaxed">
            <HighlightNumbers text={l} />
          </p>
        ))}
      </div>
      <SourcesList sources={data.sources?.summary} />
    </div>
  );
}

// ── Tab: 산업 역사 (Timeline) ──────────────────────────────────────────────────

function IndustryHistoryTab({ data }: { data: AnalysisDetail }) {
  const ls = splitLines(data.industry_history);

  type Item = { period: string; content: string };
  const items: Item[] = [];

  for (const line of ls) {
    const m = line.match(
      /^((?:19|20)\d{2}(?:년대?|s)?(?:\s*[~\-–]\s*(?:(?:19|20)\d{2}(?:년대?|s)?|현재))?)\s*[:·]?\s*/,
    );
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
      {hasYears ? (
        <div className="space-y-0">
          {items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${item.period ? 'bg-blue-500' : 'bg-gray-300'}`} />
                {i < items.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1 min-h-[1rem]" />}
              </div>
              <div className="pb-5 min-w-0">
                {item.period && (
                  <span className="inline-block text-xs font-bold text-blue-600 bg-blue-50 rounded px-2 py-0.5 mb-1">
                    {item.period}
                  </span>
                )}
                <p className="text-sm text-gray-700 leading-relaxed">{item.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ls.map((l, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
              <p className="text-sm text-gray-700 leading-relaxed">{l}</p>
            </div>
          ))}
        </div>
      )}
      <SourcesList sources={data.sources?.industry_history} />
    </>
  );
}

// ── Tab: 기술 변화 (Change points) ────────────────────────────────────────────

function TechEvolutionTab({ data }: { data: AnalysisDetail }) {
  const ls = splitLines(data.tech_evolution);
  const points: string[] = [];
  let buf = '';

  for (const line of ls) {
    if (/^(\d+[.)]\s|[•·▶→■◆]\s?)/.test(line)) {
      if (buf) points.push(buf.trim());
      buf = line.replace(/^(\d+[.)]\s|[•·▶→■◆]\s?)/, '');
    } else {
      buf = buf ? buf + ' ' + line : line;
    }
  }
  if (buf) points.push(buf.trim());
  if (points.length === 0 && data.tech_evolution) points.push(data.tech_evolution);

  const gradients = [
    'from-violet-50 to-blue-50 border-violet-100',
    'from-blue-50 to-cyan-50 border-blue-100',
    'from-cyan-50 to-teal-50 border-cyan-100',
    'from-teal-50 to-green-50 border-teal-100',
    'from-green-50 to-emerald-50 border-green-100',
  ];

  return (
    <>
      <div className="space-y-3">
        {points.map((point, i) => (
          <div
            key={i}
            className={`flex gap-3 p-4 bg-gradient-to-r ${gradients[i % gradients.length]} rounded-xl border`}
          >
            <span className="shrink-0 w-6 h-6 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center font-bold">
              {i + 1}
            </span>
            <p className="text-sm text-gray-800 leading-relaxed">
              <HighlightNumbers text={point} />
            </p>
          </div>
        ))}
      </div>
      <SourcesList sources={data.sources?.tech_evolution} />
    </>
  );
}

// ── Tab: 밸류체인 (Stage blocks) ──────────────────────────────────────────────

function ValueChainTab({ data }: { data: AnalysisDetail }) {
  const players = data.valuechainPlayers ?? [];
  return (
    <>
      <div className="space-y-5">
        {data.value_chain_overview && (
          <p className="text-sm text-gray-700 leading-relaxed">{data.value_chain_overview}</p>
        )}
        {players.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">플레이어</h4>
            <div className="flex flex-wrap gap-3">
              {players.map((p, i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[150px] max-w-xs bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="text-xs font-semibold text-blue-600 mb-1">{p.role}</div>
                  <div className="font-bold text-gray-900 text-sm mb-2">{p.player_name}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{p.description}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <SourcesList sources={data.sources?.value_chain} />
    </>
  );
}

// ── Tab: 비즈니스 모델 (Revenue Engine / Unit Economics / Moat / Risk) ─────────

function BusinessModelTab({ data }: { data: AnalysisDetail }) {
  const ls = splitLines(data.business_model);
  let reLines: string[] = [];
  let ueLines: string[] = [];
  let section = 0;

  for (const line of ls) {
    const low = line.toLowerCase();
    if (/revenue|수익화|수익 구조|수익모델|매출/.test(low)) { section = 1; reLines.push(line); continue; }
    if (/unit economics|유닛|arpu|ltv|cac|가격|구독|수수료/.test(low)) { section = 2; ueLines.push(line); continue; }
    if (section === 1) reLines.push(line);
    else if (section === 2) ueLines.push(line);
    else reLines.push(line);
  }

  if (ueLines.length === 0 && reLines.length > 1) {
    const mid = Math.ceil(reLines.length / 2);
    ueLines = reLines.splice(mid);
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
          <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3">Revenue Engine</h4>
          <div className="space-y-2">
            {reLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                <HighlightNumbers text={l} />
              </p>
            ))}
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
          <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">Unit Economics</h4>
          <div className="space-y-2">
            {ueLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                <HighlightNumbers text={l} />
              </p>
            ))}
          </div>
        </div>
      </div>

      {data.moat_analysis && <MoatSection moat={data.moat_analysis} />}
      {data.risk_analysis  && <RiskSection  risk={data.risk_analysis} />}

      <SourcesList sources={data.sources?.business_model} />
    </>
  );
}

// ── Tab: 재무 (Number cards) ──────────────────────────────────────────────────

function FinancialsTab({ data }: { data: AnalysisDetail }) {
  const ls = splitLines(data.financials);
  const statLines = ls
    .filter(l => /[$₩\d].*?(?:조|억|만|B|M|K|%|배|원)/.test(l))
    .slice(0, 6);
  const restLines = ls.filter(l => !statLines.includes(l));

  function parseStat(line: string) {
    const m = line.match(/([$₩]?[\d,]+(?:\.\d+)?(?:조|억|만|B|M|K|%|배|원)+)/);
    return {
      value: m?.[1] ?? '—',
      label: line.replace(m?.[0] ?? '', '').replace(/[:：\s·\-–]+/g, ' ').trim() || line,
    };
  }

  return (
    <>
      <div className="space-y-5">
        {statLines.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {statLines.map((l, i) => {
              const { value, label } = parseStat(l);
              return (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-slate-800">{value}</div>
                  <div className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">{label}</div>
                </div>
              );
            })}
          </div>
        )}
        {restLines.length > 0 && (
          <div className="space-y-2">
            {restLines.map((l, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed">
                <HighlightNumbers text={l} />
              </p>
            ))}
          </div>
        )}
      </div>
      <SourcesList sources={data.sources?.financials} />
    </>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'summary',          label: '요약' },
  { key: 'industry_history', label: '산업 역사' },
  { key: 'tech_evolution',   label: '기술 변화' },
  { key: 'value_chain',      label: '밸류체인' },
  { key: 'business_model',   label: '비즈니스 모델' },
  { key: 'financials',       label: '재무' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function AnalysisCard({ data }: { data: AnalysisDetail }) {
  const [tab, setTab] = useState<TabKey>('summary');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{data.companyName}</h2>
          <span className="text-xs text-gray-400">
            {new Date(data.createdAt).toLocaleString('ko-KR')}
          </span>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-100 px-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'summary'          && <SummaryTab          data={data} />}
        {tab === 'industry_history' && <IndustryHistoryTab  data={data} />}
        {tab === 'tech_evolution'   && <TechEvolutionTab    data={data} />}
        {tab === 'value_chain'      && <ValueChainTab       data={data} />}
        {tab === 'business_model'   && <BusinessModelTab    data={data} />}
        {tab === 'financials'       && <FinancialsTab       data={data} />}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AnalysisDetail } from '@/types';

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

// ── Tab: 요약 ──────────────────────────────────────────────────────────────────

function SummaryTab({ summary }: { summary: string }) {
  const ls = splitLines(summary);
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
    </div>
  );
}

// ── Tab: 산업 역사 (Timeline) ──────────────────────────────────────────────────

function IndustryHistoryTab({ text }: { text: string }) {
  const ls = splitLines(text);

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

  if (hasYears) {
    return (
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
    );
  }

  return (
    <div className="space-y-3">
      {ls.map((l, i) => (
        <div key={i} className="flex gap-3 items-start">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <p className="text-sm text-gray-700 leading-relaxed">{l}</p>
        </div>
      ))}
    </div>
  );
}

// ── Tab: 기술 변화 (Change points) ────────────────────────────────────────────

function TechEvolutionTab({ text }: { text: string }) {
  const ls = splitLines(text);
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
  if (points.length === 0 && text) points.push(text);

  const gradients = [
    'from-violet-50 to-blue-50 border-violet-100',
    'from-blue-50 to-cyan-50 border-blue-100',
    'from-cyan-50 to-teal-50 border-cyan-100',
    'from-teal-50 to-green-50 border-teal-100',
    'from-green-50 to-emerald-50 border-green-100',
  ];

  return (
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
  );
}

// ── Tab: 밸류체인 (Stage blocks) ──────────────────────────────────────────────

function ValueChainTab({ data }: { data: AnalysisDetail }) {
  const players = data.valuechainPlayers ?? [];
  return (
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
  );
}

// ── Tab: 비즈니스 모델 (Revenue Engine / Unit Economics) ─────────────────────

function BusinessModelTab({ text }: { text: string }) {
  const ls = splitLines(text);
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
  );
}

// ── Tab: 재무 (Number cards) ──────────────────────────────────────────────────

function FinancialsTab({ text }: { text: string }) {
  const ls = splitLines(text);
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
        {tab === 'summary'          && <SummaryTab summary={data.summary} />}
        {tab === 'industry_history' && <IndustryHistoryTab text={data.industry_history} />}
        {tab === 'tech_evolution'   && <TechEvolutionTab text={data.tech_evolution} />}
        {tab === 'value_chain'      && <ValueChainTab data={data} />}
        {tab === 'business_model'   && <BusinessModelTab text={data.business_model} />}
        {tab === 'financials'       && <FinancialsTab text={data.financials} />}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { AnalysisDetail } from '@/types';

interface SectionProps {
  title: string;
  content: string;
}

function Section({ title, content }: SectionProps) {
  if (!content) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</div>
    </div>
  );
}

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
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{data.companyName}</h2>
          <span className="text-xs text-gray-400">
            {new Date(data.createdAt).toLocaleString('ko-KR')}
          </span>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Tab content */}
      <div className="p-6">
        {tab === 'summary' && <Section title="경영 요약" content={data.summary} />}
        {tab === 'industry_history' && <Section title="산업 역사" content={data.industry_history} />}
        {tab === 'tech_evolution' && <Section title="기술 변화" content={data.tech_evolution} />}
        {tab === 'value_chain' && (
          <>
            <Section title="밸류체인 개요" content={data.value_chain_overview} />
            {(data.valuechainPlayers ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  플레이어
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-4 font-medium">역할</th>
                        <th className="pb-2 pr-4 font-medium">기업/기관</th>
                        <th className="pb-2 font-medium">설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.valuechainPlayers.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 pr-4 text-blue-600 font-medium whitespace-nowrap">{p.role}</td>
                          <td className="py-2 pr-4 font-medium whitespace-nowrap">{p.player_name}</td>
                          <td className="py-2 text-gray-600">{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
        {tab === 'business_model' && <Section title="비즈니스 모델" content={data.business_model} />}
        {tab === 'financials' && <Section title="재무 현황" content={data.financials} />}
      </div>
    </div>
  );
}

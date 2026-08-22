'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { AdminUserStats } from '@/types';

const DONUT_COLORS = ['#2563eb', '#93c5fd', '#1e3a5f', '#60a5fa', '#0f1c2c', '#94a3b8'];

const PURPOSE_LABELS: Record<string, string> = {
  meeting_prep: '미팅 준비',
  partner_research: '파트너 리서치',
  competitor_analysis: '경쟁사 분석',
  other: '기타',
};

const PERIOD_LABELS: Record<AdminUserStats['period'], string> = {
  week: '주간', month: '월간', quarter: '분기', half: '반기', year: '연간',
};
const PERIODS: AdminUserStats['period'][] = ['week', 'month', 'quarter', 'half', 'year'];

interface AdminStatsChartsProps {
  stats: AdminUserStats;
  period: AdminUserStats['period'];
  onPeriodChange: (p: AdminUserStats['period']) => void;
}

export default function AdminStatsCharts({ stats, period, onPeriodChange }: AdminStatsChartsProps) {
  const [donutMode, setDonutMode] = useState<'plan' | 'purpose'>('plan');

  const donutData = donutMode === 'plan'
    ? [
        { name: '프리미엄', value: stats.premiumCount },
        { name: '무료', value: stats.freeCount },
      ].filter(d => d.value > 0)
    : Object.entries(stats.purposeCounts)
        .map(([key, value]) => ({ name: PURPOSE_LABELS[key] ?? key, value }))
        .filter(d => d.value > 0);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">플랜/목적 분포</h3>
          <div className="flex gap-1">
            {(['plan', 'purpose'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setDonutMode(mode)}
                className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors ${
                  donutMode === mode ? 'text-navy-700 bg-navy-50' : 'text-gray-400 hover:text-navy-600'
                }`}
              >
                {mode === 'plan' ? '플랜별' : '목적별'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {donutData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}명`, name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">가입 추세</h3>
          <div className="flex gap-1">
            {PERIODS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => onPeriodChange(p)}
                className={`text-[11px] font-semibold px-2 py-1 rounded transition-colors ${
                  period === p ? 'text-navy-700 bg-navy-50' : 'text-gray-400 hover:text-navy-600'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {stats.trend.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.trend} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="bucket" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip formatter={(value) => [`${value}명`, '신규 가입']} />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3, fill: '#2563eb' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

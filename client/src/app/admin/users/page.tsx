'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Download } from 'lucide-react';
import Header from '@/app/components/Header';
import { useAuth } from '@/app/context/AuthContext';
import { useIsAdmin } from '@/app/hooks/useIsAdmin';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { AdminUser, AdminUserStats } from '@/types';
import AdminStatsCharts from '@/app/components/admin/AdminStatsCharts';
import AdminUserDetailPanel from '@/app/components/admin/AdminUserDetailPanel';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

const PURPOSE_OPTIONS = [
  { value: '', label: '전체 목적' },
  { value: 'meeting_prep', label: '미팅 준비' },
  { value: 'partner_research', label: '파트너 리서치' },
  { value: 'competitor_analysis', label: '경쟁사 분석' },
  { value: 'other', label: '기타' },
];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ko-KR');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

// 서버 API 없이 클라이언트에서 현재 필터된 목록을 그대로 CSV로 변환 — 별도 엔드포인트
// 불필요(요청사항). 엑셀에서 한글이 안 깨지도록 UTF-8 BOM을 앞에 붙인다.
function downloadCsv(users: AdminUser[]) {
  const headers = ['이메일', '가입일', '최근로그인', '마지막분석일', '분석횟수', '플랜', '비상장검색허용', '회사명', '조직규모', '산업', '직무', '목적'];
  const rows = users.map(u => [
    u.email ?? '', u.createdAt ?? '', u.lastSignInAt ?? '', u.lastAnalysisAt ?? '', String(u.analysisCount),
    u.isPremium ? '프리미엄' : '무료', u.allowPrivateSearch ? 'Y' : 'N',
    u.companyName ?? '', u.orgSize ?? '', u.industry ?? '', u.jobRole ?? '', u.purpose.join('/'),
  ]);
  const csv = [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `1min_users_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [period, setPeriod] = useState<AdminUserStats['period']>('month');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglePendingId, setTogglePendingId] = useState<string | null>(null);

  const [plan, setPlan] = useState('');
  const [purpose, setPurpose] = useState('');
  const [month, setMonth] = useState('');
  const [privateSearch, setPrivateSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // 비관리자는 에러 화면 없이 조용히 홈으로 — 실제 접근 통제는 서버(resolveAdminUser,
  // 401/403)가 이미 담당하고 있어 이건 순수 UX(존재 자체를 노출하지 않는 것).
  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) router.replace('/');
  }, [adminLoading, isAdmin, router]);

  // 이메일 검색만 300ms 디바운스 — 나머지 필터는 select/월 선택이라 즉시 반영해도 무리 없음
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchStats = useCallback(() => {
    if (!session || !isAdmin) return;
    fetch(`${API_URL}/api/admin/users/stats?period=${period}`, { headers: buildAuthHeaders(null, session.access_token) })
      .then(r => (r.ok ? r.json() : null))
      .then((data: AdminUserStats | null) => setStats(data))
      .catch(() => {});
  }, [session, isAdmin, period]);

  const fetchUsers = useCallback(() => {
    if (!session || !isAdmin) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (plan) params.set('plan', plan);
    if (purpose) params.set('purpose', purpose);
    if (month) params.set('month', month);
    if (privateSearch) params.set('privateSearch', privateSearch);
    if (search) params.set('search', search);

    fetch(`${API_URL}/api/admin/users?${params.toString()}`, { headers: buildAuthHeaders(null, session.access_token) })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: { users: AdminUser[] }) => setUsers(data.users))
      .catch(() => setError('유저 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [session, isAdmin, plan, purpose, month, privateSearch, search]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleTogglePrivateSearch(userId: string, next: boolean) {
    if (!session) return;
    setTogglePendingId(userId);
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, allowPrivateSearch: next } : u)));
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({ allow_private_search: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, allowPrivateSearch: !next } : u)));
    } finally {
      setTogglePendingId(null);
    }
  }

  if (adminLoading || !isAdmin) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen">
      <Header />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">관리자 — 유저 대시보드</h1>
          <button
            type="button"
            onClick={() => downloadCsv(users)}
            disabled={!users.length}
            className="flex items-center gap-1.5 text-sm font-medium text-navy-700 bg-navy-50 hover:bg-navy-100 border border-navy-200 rounded-lg px-3 py-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={14} />
            CSV 다운로드 ({users.length}명)
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="전체 유저" value={`${stats.total}명`} />
            <StatCard label="프리미엄" value={`${stats.premiumCount}명`} />
            <StatCard label="비상장 검색 허용" value={`${stats.privateSearchCount}명`} />
            <StatCard label="이번 달 신규" value={`${stats.newThisMonth}명`} />
            <StatCard label="분석 0회" value={`${stats.zeroAnalysisCount}명 (${Math.round(stats.zeroAnalysisRate * 100)}%)`} />
          </div>
        )}

        {stats && <AdminStatsCharts stats={stats} period={period} onPeriodChange={setPeriod} />}

        <div className="flex flex-wrap gap-2">
          <select value={plan} onChange={e => setPlan(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
            <option value="">전체 플랜</option>
            <option value="premium">프리미엄</option>
            <option value="free">무료</option>
          </select>
          <select value={purpose} onChange={e => setPurpose(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
            {PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
          />
          <select value={privateSearch} onChange={e => setPrivateSearch(e.target.value)} className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700">
            <option value="">비상장 검색 전체</option>
            <option value="on">허용</option>
            <option value="off">비허용</option>
          </select>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이메일 검색"
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 min-w-[180px]"
          />
        </div>

        {loading && <p className="text-sm text-gray-400">불러오는 중...</p>}
        {error && <p className="text-sm text-risk">{error}</p>}

        {!loading && !error && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-100 text-left">
                  <th className="px-4 py-2.5 font-medium">이메일</th>
                  <th className="px-4 py-2.5 font-medium">가입일</th>
                  <th className="px-4 py-2.5 font-medium">최근 로그인</th>
                  <th className="px-4 py-2.5 font-medium">마지막 분석일</th>
                  <th className="px-4 py-2.5 font-medium">분석 횟수</th>
                  <th className="px-4 py-2.5 font-medium">플랜</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">조건에 맞는 유저가 없습니다.</td></tr>
                )}
                {users.map(u => (
                  <Fragment key={u.id}>
                    <tr className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-900">{u.email ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtDate(u.lastSignInAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{fmtDate(u.lastAnalysisAt)}</td>
                      <td className="px-4 py-2.5 text-gray-500">{u.analysisCount}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${u.isPremium ? 'bg-navy-50 text-navy-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.isPremium ? '프리미엄' : '무료'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedId(prev => (prev === u.id ? null : u.id))}
                          className="text-xs font-medium text-navy-600 hover:text-navy-800 flex items-center gap-1 ml-auto"
                        >
                          보기 {expandedId === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === u.id && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <AdminUserDetailPanel
                            user={u}
                            togglePending={togglePendingId === u.id}
                            onTogglePrivateSearch={next => handleTogglePrivateSearch(u.id, next)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

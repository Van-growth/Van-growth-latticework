'use client';

import { AdminUser } from '@/types';

interface AdminUserDetailPanelProps {
  user: AdminUser;
  onTogglePrivateSearch: (next: boolean) => void;
  togglePending: boolean;
}

const PURPOSE_LABELS: Record<string, string> = {
  meeting_prep: '미팅 준비',
  partner_research: '파트너 리서치',
  competitor_analysis: '경쟁사 분석',
  other: '기타',
};

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className="text-gray-900 text-sm">{value}</p>
    </div>
  );
}

export default function AdminUserDetailPanel({ user, onTogglePrivateSearch, togglePending }: AdminUserDetailPanelProps) {
  const purposeText = user.purpose.length
    ? user.purpose.map(p => PURPOSE_LABELS[p] ?? p).join(', ') + (user.purposeOther ? ` (기타: ${user.purposeOther})` : '')
    : '—';

  return (
    <div className="bg-gray-50 border-t border-gray-200 px-5 py-4 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="가입일" value={fmtDateTime(user.createdAt)} />
        <Field label="최근 로그인" value={fmtDateTime(user.lastSignInAt)} />
        <Field label="마지막 분석일" value={fmtDateTime(user.lastAnalysisAt)} />
        <Field label="분석 횟수" value={`${user.analysisCount}회`} />
        <Field label="회사명" value={user.companyName ?? '—'} />
        <Field label="조직 규모" value={user.orgSize ?? '—'} />
        <Field label="산업" value={user.industry ?? '—'} />
        <Field label="직무 / 직급" value={`${user.jobRole ?? '—'} / ${user.jobLevel ?? '—'}`} />
        <div className="col-span-2 md:col-span-4">
          <Field label="분석 목적" value={purposeText} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer w-fit">
        <input
          type="checkbox"
          checked={user.allowPrivateSearch}
          disabled={togglePending}
          onChange={e => onTogglePrivateSearch(e.target.checked)}
          className="w-4 h-4 accent-navy-600"
        />
        비상장 회사 자유입력 검색 허용
      </label>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { syncProfileProperties } from '@/lib/analytics';
import { UserProfile } from '@/types';
import ProfileForm, { ProfileFormValues } from './ProfileForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// 구글 로그인 직후 1회성 온보딩 설문. profiles.onboarding_completed_at이 비어있을 때만 뜨고,
// 제출이든 스킵이든 닫히는 순간 그 컬럼을 채워서 다시는 안 뜨게 함 — 스킵해도 값 자체는
// null로 남아 나중에 /settings에서 채울 수 있음.
const SAVE_ERROR_MESSAGE = '저장에 실패했어요. 다시 시도해주세요.';

export default function OnboardingModal() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !session?.access_token) {
      setShow(false);
      return;
    }
    let cancelled = false;
    fetch(`${API_URL}/api/profile`, { headers: buildAuthHeaders(null, session.access_token) })
      .then(r => (r.ok ? r.json() : null))
      .then((data: UserProfile | null) => {
        if (cancelled || !data) return;
        setProfile(data);
        if (!data.onboarding_completed_at) setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, session]);

  async function submit(values: ProfileFormValues) {
    if (!session?.access_token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({
          company_name: values.company_name || null,
          org_size: values.org_size || null,
          industry: values.industry || null,
          job_role: values.job_role || null,
          job_level: values.job_level || null,
          purpose: values.purpose,
          purpose_other: values.purpose_other || null,
          completeOnboarding: true,
        }),
      });
      if (!res.ok) {
        setError(SAVE_ERROR_MESSAGE);
        return;
      }
      syncProfileProperties({
        company_name: values.company_name || null,
        org_size: values.org_size || null,
        industry: values.industry || null,
        job_role: values.job_role || null,
        job_level: values.job_level || null,
      });
      setShow(false);
    } catch {
      setError(SAVE_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  async function skip() {
    if (!session?.access_token) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders(null, session.access_token) },
        body: JSON.stringify({ completeOnboarding: true }),
      });
      if (!res.ok) {
        setError(SAVE_ERROR_MESSAGE);
        return;
      }
      setShow(false);
    } catch {
      setError(SAVE_ERROR_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">몇 가지만 알려주세요</h2>
        <p className="text-sm text-gray-500 mb-5">
          1min을 어떻게 쓰실지 알면 더 도움이 되는 분석을 드릴 수 있어요.
        </p>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <ProfileForm initial={profile} submitting={submitting} submitLabel="시작하기" onSubmit={submit} />
        <button
          onClick={skip}
          disabled={submitting}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3 disabled:opacity-50"
        >
          나중에 할게요
        </button>
      </div>
    </div>
  );
}

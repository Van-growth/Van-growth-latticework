'use client';

import { useEffect, useState } from 'react';
import Header from '@/app/components/Header';
import { useAuth } from '@/app/context/AuthContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { syncProfileProperties } from '@/lib/analytics';
import { UserProfile } from '@/types';
import ProfileForm, { ProfileFormValues } from '@/app/components/profile/ProfileForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SettingsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session?.access_token) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/profile`, { headers: buildAuthHeaders(null, session.access_token) })
      .then(r => (r.ok ? r.json() : null))
      .then((data: UserProfile | null) => setProfile(data))
      .finally(() => setLoading(false));
  }, [user, session, authLoading]);

  async function handleSave(values: ProfileFormValues) {
    if (!session?.access_token) return;
    setSubmitting(true);
    setSaved(false);
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
          region: values.region || null,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        syncProfileProperties(updated);
        setSaved(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">프로필 설정</h1>
        <p className="text-sm text-gray-500 mb-6">더 나은 분석을 위한 정보입니다. 언제든 수정할 수 있어요.</p>

        {authLoading || loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : !user ? (
          <p className="text-sm text-gray-400">로그인 후 이용해주세요.</p>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <ProfileForm initial={profile} submitting={submitting} submitLabel="저장" onSubmit={handleSave} />
            {saved && <p className="text-xs text-green-600 mt-3">저장되었습니다.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

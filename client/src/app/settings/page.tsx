'use client';

import { useEffect, useState } from 'react';
import Header from '@/app/components/Header';
import { useAuth } from '@/app/context/AuthContext';
import { useLanguage, Language } from '@/app/context/LanguageContext';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { syncProfileProperties } from '@/lib/analytics';
import { getUiStrings } from '@/lib/i18n/uiStrings';
import { UserProfile } from '@/types';
import ProfileForm, { ProfileFormValues } from '@/app/components/profile/ProfileForm';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function SettingsPage() {
  const { user, session, loading: authLoading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const t = getUiStrings(language).settings;
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
        <h1 className="text-xl font-semibold text-gray-900 mb-1">{t.title}</h1>
        <p className="text-sm text-gray-500 mb-6">{t.subtitle}</p>

        {authLoading || loading ? (
          <p className="text-sm text-gray-400">{t.loading}</p>
        ) : !user ? (
          <p className="text-sm text-gray-400">{t.loginRequired}</p>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t.languageSectionTitle}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['en', 'ko'] as Language[]).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                      language === lang
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {lang === 'ko' ? t.languageKo : t.languageEn}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-6">
              <ProfileForm initial={profile} submitting={submitting} submitLabel={t.saveLabel} onSubmit={handleSave} />
              {saved && <p className="text-xs text-green-600 mt-3">{t.saveSuccess}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

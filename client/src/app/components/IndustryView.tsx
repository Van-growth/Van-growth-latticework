'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { getUiStrings } from '@/lib/i18n/uiStrings';

const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error('NEXT_PUBLIC_API_URL is not set');
  return url;
})();

interface IndustryRow {
  sicCode: string;
  sicDescription: string;
  companyCount: number;
}

interface IndustryCompany {
  cik: string;
  name: string;
  ticker: string | null;
  revenue: number;
  fiscalYear: string | null;
}

// Top 10만 실제 데이터 연동, 나머지는 "준비 중" 뱃지만 노출(요청사항 스코프).
const LIMIT_OPTIONS = [10, 30, 50, 100];

function formatRevenue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `$${(v / 1_000_000).toFixed(0)}M`;
  return `$${v.toLocaleString()}`;
}

// SIC 기준 산업 목록 → 선택 시 financial_cache(EDGAR) 최신 매출 기준 Top10 리스트.
// /industries 라우트(client/src/app/industries/page.tsx)에서 마운트 — 클릭 시
// onSelectCompany로 회사를 넘기면 sessionStorage 브릿지를 거쳐 "/"(기업분석 홈)의
// 기존 typeahead 선택(resolve) 플로우로 이어진다. 새 분석 플로우를 만들지 않는다.
export default function IndustryView({ onSelectCompany }: {
  onSelectCompany: (company: { cik: string; name: string; ticker: string | null }) => void;
}) {
  const { language } = useLanguage();
  const t = getUiStrings(language).industryView;

  const [industries, setIndustries] = useState<IndustryRow[] | null>(null);
  const [listError, setListError] = useState(false);
  const [selected, setSelected] = useState<IndustryRow | null>(null);
  const [companies, setCompanies] = useState<IndustryCompany[] | null>(null);
  const [companiesError, setCompaniesError] = useState(false);
  // financial_cache가 Russell 1000 기준 부분 커버리지라 서버가 항상 내려주는 고정 안내 문구.
  const [coverageNote, setCoverageNote] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/industries`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { setIndustries(data.industries ?? []); setCoverageNote(data.coverageNote ?? ''); })
      .catch(() => setListError(true));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setCompanies(null);
    setCompaniesError(false);
    fetch(`${API_URL}/api/industries/${encodeURIComponent(selected.sicCode)}/companies?limit=10`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setCompanies(data.companies ?? []))
      .catch(() => setCompaniesError(true));
  }, [selected]);

  if (selected) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setSelected(null); setCompanies(null); }}
          className="text-sm text-navy-600 hover:text-navy-800 mb-4"
        >
          {t.back}
        </button>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{selected.sicDescription}</h2>

        <div className="flex gap-2 mb-4">
          {LIMIT_OPTIONS.map(n => (
            <button
              key={n}
              type="button"
              disabled={n !== 10}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                n === 10
                  ? 'bg-navy-600 border-navy-600 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
              }`}
            >
              Top {n}{n !== 10 ? ` (${t.comingSoon})` : ''}
            </button>
          ))}
        </div>

        {companiesError ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
            {t.loadError}
          </div>
        ) : !companies ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
            {t.companyLoading}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
            {t.companyEmpty}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="px-4 py-2.5 font-medium">{t.columnRank}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnCompany}</th>
                  <th className="px-4 py-2.5 font-medium">{t.columnTicker}</th>
                  <th className="px-4 py-2.5 font-medium text-right">{t.columnRevenue}</th>
                  <th className="px-4 py-2.5 font-medium text-right">{t.columnFiscalYear}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c, i) => (
                  <tr
                    key={c.cik}
                    onClick={() => onSelectCompany({ cik: c.cik, name: c.name, ticker: c.ticker })}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{c.ticker ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{formatRevenue(c.revenue)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-400">{c.fiscalYear ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {coverageNote && <p className="text-xs text-gray-400 text-center mt-4">{coverageNote}</p>}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-6 text-center">{t.subtitle}</p>
      {listError ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          {t.loadError}
        </div>
      ) : !industries ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          {t.loading}
        </div>
      ) : industries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8 py-10 text-center text-gray-400 text-sm">
          {t.companyEmpty}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {industries.map(ind => (
            <button
              key={ind.sicCode}
              type="button"
              onClick={() => setSelected(ind)}
              className="flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 text-left hover:border-navy-200 hover:bg-navy-50/40 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{ind.sicDescription}</span>
              <span className="text-xs text-gray-400 shrink-0">{t.industryCompanyCount(ind.companyCount)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

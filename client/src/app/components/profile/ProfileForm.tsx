'use client';

import { useState } from 'react';
import { UserProfile } from '@/types';
import {
  getProfileLabels, ORG_SIZE_CODES, INDUSTRY_CODES, JOB_ROLE_CODES, JOB_LEVEL_CODES, PURPOSE_CODES, REGION_CODES,
  OrgSizeCode, IndustryCode, JobRoleCode, JobLevelCode, PurposeCode, RegionCode,
} from '@/lib/i18n/profileLabels';

// TODO(영문화): 앱에 실제 로케일 컨텍스트가 생기면 여기 'ko' 대신 그 값을 쓸 것.
const labels = getProfileLabels('ko');

export interface ProfileFormValues {
  company_name: string;
  org_size: OrgSizeCode | '';
  industry: IndustryCode | '';
  job_role: JobRoleCode | '';
  job_level: JobLevelCode | '';
  purpose: PurposeCode[];
  purpose_other: string;
  region: RegionCode | '';
}

function toFormValues(p?: Partial<UserProfile> | null): ProfileFormValues {
  return {
    company_name: p?.company_name ?? '',
    org_size: (p?.org_size ?? '') as OrgSizeCode | '',
    industry: (p?.industry ?? '') as IndustryCode | '',
    job_role: (p?.job_role ?? '') as JobRoleCode | '',
    job_level: (p?.job_level ?? '') as JobLevelCode | '',
    purpose: p?.purpose ?? [],
    purpose_other: p?.purpose_other ?? '',
    region: (p?.region ?? '') as RegionCode | '',
  };
}

function ChoiceGroup<T extends string>({ options, labelFor, value, onChange, cols = 4 }: {
  options: readonly T[];
  labelFor: Record<T, string>;
  value: T | '';
  onChange: (v: T | '') => void;
  cols?: number;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map(opt => (
        <button
          type="button"
          key={opt}
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
            value === opt
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
          }`}
        >
          {labelFor[opt]}
        </button>
      ))}
    </div>
  );
}

export default function ProfileForm({ initial, onSubmit, submitLabel, submitting }: {
  initial?: Partial<UserProfile> | null;
  onSubmit: (values: ProfileFormValues) => void;
  submitLabel: string;
  submitting?: boolean;
}) {
  const [values, setValues] = useState<ProfileFormValues>(() => toFormValues(initial));

  function togglePurpose(p: PurposeCode) {
    setValues(v => ({
      ...v,
      purpose: v.purpose.includes(p) ? v.purpose.filter(x => x !== p) : [...v.purpose, p],
    }));
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(values); }} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">회사명</label>
        <input
          type="text"
          value={values.company_name}
          onChange={e => setValues(v => ({ ...v, company_name: e.target.value }))}
          placeholder="예: Acme Inc."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">지역</label>
        <ChoiceGroup
          options={REGION_CODES}
          labelFor={labels.region}
          value={values.region}
          onChange={v => setValues(s => ({ ...s, region: v }))}
          cols={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">조직 규모</label>
        <ChoiceGroup
          options={ORG_SIZE_CODES}
          labelFor={labels.orgSize}
          value={values.org_size}
          onChange={v => setValues(s => ({ ...s, org_size: v }))}
          cols={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">산업</label>
        <ChoiceGroup
          options={INDUSTRY_CODES}
          labelFor={labels.industry}
          value={values.industry}
          onChange={v => setValues(s => ({ ...s, industry: v }))}
          cols={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">직무</label>
        <ChoiceGroup
          options={JOB_ROLE_CODES}
          labelFor={labels.jobRole}
          value={values.job_role}
          onChange={v => setValues(s => ({ ...s, job_role: v }))}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">직급</label>
        <ChoiceGroup
          options={JOB_LEVEL_CODES}
          labelFor={labels.jobLevel}
          value={values.job_level}
          onChange={v => setValues(s => ({ ...s, job_level: v }))}
          cols={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">사용 목적 (복수 선택 가능)</label>
        <div className="grid grid-cols-2 gap-2">
          {PURPOSE_CODES.map(p => (
            <button
              type="button"
              key={p}
              onClick={() => togglePurpose(p)}
              className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                values.purpose.includes(p)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}
            >
              {labels.purpose[p]}
            </button>
          ))}
        </div>
        {values.purpose.includes('other') && (
          <input
            type="text"
            value={values.purpose_other}
            onChange={e => setValues(v => ({ ...v, purpose_other: e.target.value }))}
            placeholder="기타 목적을 입력해주세요"
            className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {submitting ? '저장 중...' : submitLabel}
      </button>
    </form>
  );
}

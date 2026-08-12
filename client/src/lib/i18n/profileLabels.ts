// 온보딩/설정 폼의 선택형 필드 라벨 사전. DB에는 언어중립 영문 소문자 코드로 저장하고,
// 화면 표시 문자열만 로케일별로 분기한다. 호출부는 LanguageContext의 useLanguage()로 얻은
// 값을 넘긴다(client/src/app/context/LanguageContext.tsx).

export type Locale = 'ko' | 'en';

export const ORG_SIZE_CODES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;
export type OrgSizeCode = (typeof ORG_SIZE_CODES)[number];

// sector_mapping의 12개 sector_tag 분류를 소문자로 재사용 — 기업 분류축과 유저 자신의
// 산업을 동일 축으로 맞춰야 세그먼트 분석에서 바로 비교 가능함.
export const INDUSTRY_CODES = [
  'saas', 'manufacturing', 'biotech_healthcare', 'retail_commerce', 'finance',
  'media_content', 'hardware_semiconductor', 'energy', 'logistics_transport',
  'consumer_goods', 'real_estate_construction', 'other',
] as const;
export type IndustryCode = (typeof INDUSTRY_CODES)[number];

export const JOB_ROLE_CODES = ['sales', 'bd', 'strategy', 'other'] as const;
export type JobRoleCode = (typeof JOB_ROLE_CODES)[number];

export const JOB_LEVEL_CODES = ['junior', 'mid', 'senior', 'team_lead', 'executive'] as const;
export type JobLevelCode = (typeof JOB_LEVEL_CODES)[number];

export const PURPOSE_CODES = ['meeting_prep', 'partner_research', 'competitor_analysis', 'other'] as const;
export type PurposeCode = (typeof PURPOSE_CODES)[number];

export const REGION_CODES = ['kr', 'us', 'other'] as const;
export type RegionCode = (typeof REGION_CODES)[number];

interface ProfileLabelDict {
  orgSize: Record<OrgSizeCode, string>;
  industry: Record<IndustryCode, string>;
  jobRole: Record<JobRoleCode, string>;
  jobLevel: Record<JobLevelCode, string>;
  purpose: Record<PurposeCode, string>;
  region: Record<RegionCode, string>;
}

const ko: ProfileLabelDict = {
  orgSize: {
    '1-10': '1-10명', '11-50': '11-50명', '51-200': '51-200명',
    '201-500': '201-500명', '501-1000': '501-1000명', '1000+': '1000명 이상',
  },
  industry: {
    saas: 'SaaS',
    manufacturing: '제조업',
    biotech_healthcare: '바이오/헬스케어',
    retail_commerce: '리테일/커머스',
    finance: '금융',
    media_content: '미디어/콘텐츠',
    hardware_semiconductor: '하드웨어/반도체',
    energy: '에너지',
    logistics_transport: '물류/운송',
    consumer_goods: '소비재',
    real_estate_construction: '부동산/건설',
    other: '기타',
  },
  jobRole: { sales: '세일즈', bd: 'BD', strategy: '전략', other: '기타' },
  jobLevel: { junior: '주니어', mid: '미들', senior: '시니어', team_lead: '팀 리드', executive: '대표·임원(C-level)' },
  purpose: {
    meeting_prep: '미팅 준비',
    partner_research: '파트너 리서치',
    competitor_analysis: '경쟁사 분석',
    other: '기타',
  },
  region: { kr: '한국', us: '미국', other: '기타' },
};

const en: ProfileLabelDict = {
  orgSize: {
    '1-10': '1-10', '11-50': '11-50', '51-200': '51-200',
    '201-500': '201-500', '501-1000': '501-1000', '1000+': '1000+',
  },
  industry: {
    saas: 'SaaS',
    manufacturing: 'Manufacturing',
    biotech_healthcare: 'Biotech/Healthcare',
    retail_commerce: 'Retail/Commerce',
    finance: 'Finance',
    media_content: 'Media/Content',
    hardware_semiconductor: 'Hardware/Semiconductor',
    energy: 'Energy',
    logistics_transport: 'Logistics/Transport',
    consumer_goods: 'Consumer Goods',
    real_estate_construction: 'Real Estate/Construction',
    other: 'Other',
  },
  jobRole: { sales: 'Sales', bd: 'BD', strategy: 'Strategy', other: 'Other' },
  jobLevel: { junior: 'Junior', mid: 'Mid', senior: 'Senior', team_lead: 'Team Lead', executive: 'Executive (C-level)' },
  purpose: {
    meeting_prep: 'Meeting prep',
    partner_research: 'Partner research',
    competitor_analysis: 'Competitor analysis',
    other: 'Other',
  },
  region: { kr: 'Korea', us: 'United States', other: 'Other' },
};

const DICTS: Record<Locale, ProfileLabelDict> = { ko, en };

export function getProfileLabels(locale: Locale = 'ko'): ProfileLabelDict {
  return DICTS[locale] ?? DICTS.ko;
}

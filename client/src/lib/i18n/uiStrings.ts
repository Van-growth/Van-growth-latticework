// 솔루션 앱 전체(랜딩페이지 제외) 정적 UI 문자열 사전 — 헤더/설정/히스토리/모달/검색화면/
// 리포트 탭 라벨. profileLabels.ts와 동일한 Locale/사전/getXxx(locale) 패턴.
// AE Skills 탭(AeSkillsView.tsx)은 콘텐츠 자체가 더미 스텁이라 이 사전 대상에서 제외 —
// 계속 한국어 고정(언어 정책 SSOT 참고). PDF(AnalysisPdf.tsx)는 파일이 이미 커서 자체
// 로컬 t(ko,en) 헬퍼로 별도 처리.

import type { Language } from '@/app/context/LanguageContext';

interface UiStringDict {
  header: {
    analysis: string;
    history: string;
    settings: string;
    logout: string;
    logoutAria: string;
    loginWithGoogle: string;
  };
  settings: {
    title: string;
    subtitle: string;
    loading: string;
    loginRequired: string;
    saveLabel: string;
    saveSuccess: string;
    languageSectionTitle: string;
    languageKo: string;
    languageEn: string;
  };
  history: {
    title: string;
    loadError: string;
    loading: string;
    loginRequired: string;
    empty: string;
    emptyCta: string;
  };
  loginModal: {
    closeAria: string;
    title: string;
    bodyWithCompany: (company: string) => string;
    bodyGeneric: string;
    bodySub: string;
    continueWithGoogle: string;
  };
  onboarding: {
    saveError: string;
    title: string;
    intro: string;
    submitLabel: string;
    skip: string;
  };
  home: {
    startNew: string;
    analyzing: string;
    analyze: string;
    checking: string;
    viewNow: string;
    reanalyze: string;
    reanalyzeNew: string;
    topTabCompany: string;
    topTabPain: string;
    topTabAeSkills: string;
    aeSkillsFreeBadge: string;
    scanMessages: string[];
    finishingUp: (company: string) => string;
    firstLookupHint: string;
    defaultCompanyName: string;
    linkCopied: string;
    shareCreateFailed: string;
    shareRevoked: string;
    shareRevokeFailed: string;
    loadResultFailed: string;
    painInfoMissing: string;
    painStarted: string;
    painFailed: string;
    connectionUnstable: string;
    analysisError: string;
    serverUnreachable: string;
    companyInfoCheckFailed: string;
    premiumComingSoon: string;
    emailUnavailable: string;
    freeTrialSubject: (email: string) => string;
    freeTrialUserLine: (email: string) => string;
    freeTrialRequestedAtLine: (requestedAt: string) => string;
    freeTrialUsageLine: (used: number, limit: number) => string;
    freeTrialLastCompanyLine: (company: string) => string;
    nudgeIndustry: string;
    nudgeFinancials: string;
    nudgeCompetitors: string;
    nudgeStrategy: string;
    nudgeFounder: string;
    nudgeAnalyzing: string;
    nudgeComplete: string;
    heroTitle: string;
    heroSubtitle: string;
    searchPlaceholder: string;
    selectFromListTitle: string;
    adminFreeTextOption: (query: string) => string;
    lastAnalyzedLabel: (company: string, days: number) => string;
    premiumUnlimited: string;
    freeUsageCount: (used: number, limit: number) => string;
    loginForFreeAnalyses: string;
    batchProgress: (completed: number, total: number) => string;
    loadingResult: string;
    previousResultBanner: (dt: string) => string;
    requestFreeTrial: string;
    upgradeUnlimited: string;
    sharingActive: string;
    copyLink: string;
    unshare: string;
    share: string;
    creatingShare: string;
  };
  tabs: {
    summary: { label: string; tooltip: string };
    value_chain: { label: string; tooltip: string };
    business_model: { label: string; tooltip: string };
    competitors: { label: string; tooltip: string };
    strategy: { label: string; tooltip: string };
    financials: { label: string; tooltip: string };
    founder: { label: string; tooltip: string };
    growth_scenario: { label: string; tooltip: string };
    cross_industry_nudge: { label: string; tooltip: string };
    industry_history: { label: string; tooltip: string };
    tech_evolution: { label: string; tooltip: string };
    icp_insight: { label: string; tooltip: string };
  };
  tabGroups: { company: string; pain: string };
  actions: {
    reanalyzeSection: string;
    startPainDiagnosis: string;
    copyAll: string;
    copyTab: string;
    copyTabShort: string;
    copied: string;
    sectionGeneratingSuffix: string;
    painDiagnosisIntro: string;
  };
  benchmarkChart: {
    thisCompany: string;
    industryMedian: string;
  };
  icpInsight: {
    hintEmptyIcp: string;
    goToSettings: string;
    generateButton: string;
    regenerateButton: string;
    generatedAgo: (days: number) => string;
    loading: string;
    failed: string;
    noSignals: string;
    questionsTitle: string;
    sectionLabel: Record<string, string>;
    ratingPrompt: string;
    ratingCommentPlaceholder: string;
    ratingSubmit: string;
    ratingSubmitted: string;
    ratingFailed: string;
  };
  profileForm: {
    companyName: string;
    companyNamePlaceholder: string;
    region: string;
    orgSize: string;
    industry: string;
    jobRole: string;
    jobLevel: string;
    purpose: string;
    purposeOtherPlaceholder: string;
    icpSectionTitle: string;
    icpHelperText: string;
    icpProduct: string;
    icpProductPlaceholder: string;
    icpTargetIndustry: string;
    icpTargetIndustryPlaceholder: string;
    icpTargetRole: string;
    icpTargetRolePlaceholder: string;
    saving: string;
  };
}

const ko: UiStringDict = {
  header: {
    analysis: '분석',
    history: '히스토리',
    settings: '설정',
    logout: '로그아웃',
    logoutAria: '로그아웃',
    loginWithGoogle: '구글로 로그인',
  },
  settings: {
    title: '프로필 설정',
    subtitle: '더 나은 분석을 위한 정보입니다. 언제든 수정할 수 있어요.',
    loading: '불러오는 중...',
    loginRequired: '로그인 후 이용해주세요.',
    saveLabel: '저장',
    saveSuccess: '저장되었습니다.',
    languageSectionTitle: '리포트 언어',
    languageKo: '한국어',
    languageEn: 'English',
  },
  history: {
    title: '분석 히스토리',
    loadError: '분석 목록을 불러오지 못했습니다.',
    loading: '불러오는 중...',
    loginRequired: '로그인 후 이용할 수 있습니다.',
    empty: '아직 분석 결과가 없습니다.',
    emptyCta: '첫 번째 기업을 분석해보세요 →',
  },
  loginModal: {
    closeAria: '닫기',
    title: '시작하고 무료로 분석해보세요',
    bodyWithCompany: (company: string) => `${company} 분석을 시작하려면 로그인이 필요해요.`,
    bodyGeneric: '기업 분석을 시작하려면 로그인이 필요해요.',
    bodySub: '로그인하면 무료로 2회 기업 분석을 이용할 수 있어요.',
    continueWithGoogle: '구글로 계속하기',
  },
  onboarding: {
    saveError: '저장에 실패했어요. 다시 시도해주세요.',
    title: '몇 가지만 알려주세요',
    intro: '1min을 어떻게 쓰실지 알면 더 도움이 되는 분석을 드릴 수 있어요.',
    submitLabel: '시작하기',
    skip: '나중에 할게요',
  },
  home: {
    startNew: '새 분석 시작',
    analyzing: '분석 중...',
    analyze: '분석하기',
    checking: '확인 중...',
    viewNow: '바로 보기',
    reanalyze: '재분석하기',
    reanalyzeNew: '새로 분석하기',
    topTabCompany: 'Company Intelligence',
    topTabPain: 'Pain Diagnosis',
    topTabAeSkills: 'AE Skills',
    aeSkillsFreeBadge: '무료',
    scanMessages: [
      'SEC 공시 문서 분석 중...',
      '10-K 497페이지 정독 중...',
      '밸류체인 끝까지 추적 중...',
      '경쟁사 포지셔닝 파악 중...',
      '재무 데이터 교차 검증 중...',
      '창업자 히스토리 조사 중...',
      '산업 구조 매핑 중...',
    ],
    finishingUp: (company: string) => `${company} 분석 마무리 중...`,
    firstLookupHint: '처음 조회하는 기업이라 조금 더 걸려요',
    defaultCompanyName: '기업',
    linkCopied: '링크 복사됨!',
    shareCreateFailed: '공유 링크 생성 실패',
    shareRevoked: '공유가 해제되었습니다.',
    shareRevokeFailed: '공유 해제 실패',
    loadResultFailed: '분석 결과를 불러오지 못했습니다.',
    painInfoMissing: '분석 정보를 아직 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    painStarted: 'pain 진단을 시작했어요 — 최대 10분 정도 걸릴 수 있어요.',
    painFailed: 'pain 진단 생성에 실패했어요. 다시 시도해주세요.',
    connectionUnstable: '연결이 불안정해 분석 완료를 확인하지 못했어요. 잠시 후 히스토리에서 다시 확인해주세요.',
    analysisError: '분석 중 오류가 발생했습니다.',
    serverUnreachable: '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.',
    companyInfoCheckFailed: '기업 정보를 확인하지 못했습니다. 다시 시도해주세요.',
    premiumComingSoon: '프리미엄 플랜 준비 중입니다',
    emailUnavailable: '(이메일 확인 불가)',
    freeTrialSubject: (email: string) => `[1min] 무료 이용권 요청 - ${email}`,
    freeTrialUserLine: (email: string) => `유저 이메일: ${email}`,
    freeTrialRequestedAtLine: (requestedAt: string) => `요청 일시: ${requestedAt}`,
    freeTrialUsageLine: (used: number, limit: number) => `사용한 무료 분석 횟수: ${used}/${limit}`,
    freeTrialLastCompanyLine: (company: string) => `마지막 검색 시도 기업: ${company}`,
    nudgeIndustry: '산업분석',
    nudgeFinancials: '재무',
    nudgeCompetitors: '경쟁사',
    nudgeStrategy: '전략',
    nudgeFounder: '창업자',
    nudgeAnalyzing: '분석 중',
    nudgeComplete: '분석 완료',
    heroTitle: '기업 심층 분석',
    heroSubtitle: '산업역사, 기술변화, 밸류체인, BM, 재무를 한번에',
    searchPlaceholder: '기업명 입력 (예: 삼성전자, Apple, NVIDIA)',
    selectFromListTitle: '검색 목록에서 기업을 선택하세요',
    adminFreeTextOption: (query: string) => `“${query}” 직접 입력해서 분석하기 (비상장 등, 관리자 전용)`,
    lastAnalyzedLabel: (company: string, days: number) => `${company} — 최근 분석 ${days}일 전`,
    premiumUnlimited: '프리미엄 · 무제한 분석',
    freeUsageCount: (used: number, limit: number) => `최근 7일 무료 분석 ${used}/${limit}회 사용`,
    loginForFreeAnalyses: '로그인 후 무료 2회 분석 가능',
    batchProgress: (completed: number, total: number) => `분석 중 배치 ${completed} / ${total} 완료`,
    loadingResult: '불러오는 중...',
    previousResultBanner: (dt: string) => `이전 분석 결과입니다 (${dt})`,
    requestFreeTrial: '무료 이용권 요청하기',
    upgradeUnlimited: '프리미엄으로 무제한 이용하기',
    sharingActive: '공유 중',
    copyLink: '링크 복사',
    unshare: '공유 해제',
    share: '공유',
    creatingShare: '생성 중...',
  },
  tabs: {
    summary:              { label: '요약',         tooltip: '이 회사가 뭐 하는 곳인지 한눈에 확인할 수 있어요' },
    value_chain:          { label: '밸류체인',     tooltip: '이 회사가 산업 내 어디에 위치하는지 확인할 수 있어요' },
    business_model:       { label: '비즈니스모델', tooltip: '어떻게 돈을 버는지 확인할 수 있어요' },
    competitors:          { label: '경쟁사',       tooltip: '주요 경쟁사와 차별점을 확인할 수 있어요' },
    strategy:             { label: '전략',         tooltip: '앞으로의 성장 전략을 확인할 수 있어요' },
    financials:           { label: '재무',         tooltip: '매출, 이익, 현금흐름 등 재무 데이터를 확인할 수 있어요' },
    founder:              { label: '창업자',       tooltip: '창업자 배경과 이력을 확인할 수 있어요' },
    growth_scenario:      { label: '성장 시나리오', tooltip: '몬테카를로 시뮬레이션 기반 매출 성장 시나리오를 확인할 수 있어요 (프리미엄)' },
    cross_industry_nudge: { label: '넛지',         tooltip: '이 업종의 공통 pain과 타산업 해결 사례를 확인할 수 있어요' },
    industry_history:     { label: '산업역사',     tooltip: '이 산업이 어떻게 발전해왔는지 확인할 수 있어요' },
    tech_evolution:       { label: '기술변화',     tooltip: '현재 기술 트렌드와 앞으로의 방향을 확인할 수 있어요' },
    icp_insight:          { label: 'ICP 인사이트', tooltip: '내 ICP 기준으로 이 회사와 관련해 무엇이 중요한지 확인할 수 있어요' },
  },
  tabGroups: { company: '기업분석', pain: 'pain 진단' },
  actions: {
    reanalyzeSection: '↻ 이 섹션 다시 분석',
    startPainDiagnosis: 'pain 진단 시작',
    copyAll: '전체 복사',
    copyTab: '이 탭 복사',
    copyTabShort: '탭 복사',
    copied: '복사됨',
    sectionGeneratingSuffix: ' 생성 중... (최대 10분 정도 소요될 수 있어요)',
    painDiagnosisIntro: '산업 역사와 기술 변화를 함께 진단해요.\n약 7~10분 소요될 수 있어요.',
  },
  benchmarkChart: {
    thisCompany: '이 회사',
    industryMedian: '업종 중앙값',
  },
  icpInsight: {
    hintEmptyIcp: '설정에서 ICP를 입력하면 더 정확한 인사이트를 받을 수 있어요',
    goToSettings: '설정으로 이동',
    generateButton: 'ICP 인사이트 생성하기',
    regenerateButton: '↻ 다시 생성',
    generatedAgo: (days: number) => (days === 0 ? '이 ICP로 오늘 생성됨' : `이 ICP로 ${days}일 전 생성됨`),
    loading: 'ICP 인사이트를 생성하고 있어요...',
    failed: '인사이트 생성에 실패했어요. 잠시 후 다시 시도해주세요.',
    noSignals: '지금은 참고할 만한 신호가 부족해요. 분석이 더 진행되면 다시 시도해보세요.',
    questionsTitle: '디스커버리 질문',
    sectionLabel: {
      summary_v2: '요약',
      financials_v2: '재무',
      business_model_v2: '비즈니스모델',
      competitors_v2: '경쟁사',
      value_chain_v2: '밸류체인',
      strategy_v2: '전략',
      industry_history_v2: '산업역사',
      tech_evolution_v2: '기술변화',
      founder_v2: '창업자',
      cross_industry_nudge_v1: '넛지',
    },
    ratingPrompt: '이 인사이트, 도움이 됐나요?',
    ratingCommentPlaceholder: '왜 별로였나요? (선택)',
    ratingSubmit: '제출',
    ratingSubmitted: '평가해주셔서 감사합니다',
    ratingFailed: '평가 저장에 실패했어요. 다시 시도해주세요.',
  },
  profileForm: {
    companyName: '회사명',
    companyNamePlaceholder: '예: Acme Inc.',
    region: '지역',
    orgSize: '조직 규모',
    industry: '산업',
    jobRole: '직무',
    jobLevel: '직급',
    purpose: '사용 목적 (복수 선택 가능)',
    purposeOtherPlaceholder: '기타 목적을 입력해주세요',
    icpSectionTitle: 'ICP (이상적 고객 프로필)',
    icpHelperText: '구체적으로 작성할수록 더 정확한 인사이트를 받을 수 있어요',
    icpProduct: '제품/서비스',
    icpProductPlaceholder: '예: 영업 인력용 AI 콜 코칭 SaaS',
    icpTargetIndustry: '타겟 산업',
    icpTargetIndustryPlaceholder: '예: 핀테크, 헬스케어',
    icpTargetRole: '타겟 직무/역할',
    icpTargetRolePlaceholder: '예: VP Sales, RevOps 리더',
    saving: '저장 중...',
  },
};

const en: UiStringDict = {
  header: {
    analysis: 'Analyze',
    history: 'History',
    settings: 'Settings',
    logout: 'Log out',
    logoutAria: 'Log out',
    loginWithGoogle: 'Continue with Google',
  },
  settings: {
    title: 'Profile settings',
    subtitle: 'This helps us tailor your analysis. You can change it anytime.',
    loading: 'Loading...',
    loginRequired: 'Please log in to continue.',
    saveLabel: 'Save',
    saveSuccess: 'Saved.',
    languageSectionTitle: 'Report language',
    languageKo: '한국어',
    languageEn: 'English',
  },
  history: {
    title: 'Analysis history',
    loadError: 'Failed to load your analysis list.',
    loading: 'Loading...',
    loginRequired: 'Please log in to view your history.',
    empty: "You don't have any analyses yet.",
    emptyCta: 'Analyze your first company →',
  },
  loginModal: {
    closeAria: 'Close',
    title: 'Sign up and analyze for free',
    bodyWithCompany: (company: string) => `Log in to start analyzing ${company}.`,
    bodyGeneric: 'Log in to start analyzing a company.',
    bodySub: 'Once you log in, you get 2 free company analyses.',
    continueWithGoogle: 'Continue with Google',
  },
  onboarding: {
    saveError: 'Failed to save. Please try again.',
    title: 'Tell us a bit about yourself',
    intro: 'Knowing how you plan to use 1min helps us tailor more useful analysis.',
    submitLabel: 'Get started',
    skip: "I'll do this later",
  },
  home: {
    startNew: 'Start new analysis',
    analyzing: 'Analyzing...',
    analyze: 'Analyze',
    checking: 'Checking...',
    viewNow: 'View now',
    reanalyze: 'Re-analyze',
    reanalyzeNew: 'Start new analysis',
    topTabCompany: 'Company Intelligence',
    topTabPain: 'Pain Diagnosis',
    topTabAeSkills: 'AE Skills',
    aeSkillsFreeBadge: 'Free',
    scanMessages: [
      'Analyzing SEC filings...',
      'Reading through the 10-K...',
      'Mapping the value chain...',
      'Sizing up competitor positioning...',
      'Cross-checking financial data...',
      'Digging into founder history...',
      'Mapping industry structure...',
    ],
    finishingUp: (company: string) => `Wrapping up the analysis of ${company}...`,
    firstLookupHint: "First time we're looking this one up, so it may take a bit longer",
    defaultCompanyName: 'this company',
    linkCopied: 'Link copied!',
    shareCreateFailed: 'Failed to create share link',
    shareRevoked: 'Sharing turned off.',
    shareRevokeFailed: 'Failed to turn off sharing',
    loadResultFailed: 'Failed to load the analysis result.',
    painInfoMissing: "We haven't loaded the analysis yet — please try again in a moment.",
    painStarted: 'Pain diagnosis started — this can take up to 10 minutes.',
    painFailed: 'Pain diagnosis failed to generate. Please try again.',
    connectionUnstable: "Your connection was unstable, so we couldn't confirm the analysis finished. Check your history in a bit.",
    analysisError: 'Something went wrong during analysis.',
    serverUnreachable: "Can't reach the server. Please check that it's running.",
    companyInfoCheckFailed: "Couldn't verify that company. Please try again.",
    premiumComingSoon: 'Premium plan is coming soon',
    emailUnavailable: '(email unavailable)',
    freeTrialSubject: (email: string) => `[1min] Free trial request - ${email}`,
    freeTrialUserLine: (email: string) => `User email: ${email}`,
    freeTrialRequestedAtLine: (requestedAt: string) => `Requested at: ${requestedAt}`,
    freeTrialUsageLine: (used: number, limit: number) => `Free analyses used: ${used}/${limit}`,
    freeTrialLastCompanyLine: (company: string) => `Last company searched: ${company}`,
    nudgeIndustry: 'Industry',
    nudgeFinancials: 'Financials',
    nudgeCompetitors: 'Competitors',
    nudgeStrategy: 'Strategy',
    nudgeFounder: 'Founder',
    nudgeAnalyzing: 'Analyzing',
    nudgeComplete: 'Analysis complete',
    heroTitle: 'Deep company analysis',
    heroSubtitle: 'Industry history, tech shifts, value chain, business model, and financials — all in one place',
    searchPlaceholder: 'Enter a company name (e.g. Apple, NVIDIA, Samsung Electronics)',
    selectFromListTitle: 'Select a company from the search results',
    adminFreeTextOption: (query: string) => `Analyze "${query}" directly (unlisted companies, admin only)`,
    lastAnalyzedLabel: (company: string, days: number) => `${company} — last analyzed ${days} day${days === 1 ? '' : 's'} ago`,
    premiumUnlimited: 'Premium · Unlimited analyses',
    freeUsageCount: (used: number, limit: number) => `${used}/${limit} free analyses used in the last 7 days`,
    loginForFreeAnalyses: 'Log in for 2 free analyses',
    batchProgress: (completed: number, total: number) => `Analyzing — batch ${completed} / ${total} complete`,
    loadingResult: 'Loading...',
    previousResultBanner: (dt: string) => `Showing a previous analysis (${dt})`,
    requestFreeTrial: 'Request free trial',
    upgradeUnlimited: 'Go unlimited with Premium',
    sharingActive: 'Sharing',
    copyLink: 'Copy link',
    unshare: 'Turn off sharing',
    share: 'Share',
    creatingShare: 'Creating...',
  },
  tabs: {
    summary:              { label: 'Summary',         tooltip: 'See at a glance what this company does' },
    value_chain:          { label: 'Value Chain',     tooltip: 'See where this company sits in its industry value chain' },
    business_model:       { label: 'Business Model',  tooltip: 'See how this company makes money' },
    competitors:          { label: 'Competitors',     tooltip: 'See key competitors and what sets this company apart' },
    strategy:             { label: 'Strategy',        tooltip: "See this company's forward growth strategy" },
    financials:            { label: 'Financials',      tooltip: 'See revenue, profit, cash flow, and other financial data' },
    founder:               { label: 'Founder',         tooltip: "See the founder's background and track record" },
    growth_scenario:       { label: 'Growth Scenario', tooltip: 'See a Monte Carlo simulation-based revenue growth scenario (Premium)' },
    cross_industry_nudge:  { label: 'Nudge',           tooltip: 'See a common pain point in this industry and how another industry solved it' },
    industry_history:      { label: 'Industry History', tooltip: 'See how this industry has evolved over time' },
    tech_evolution:        { label: 'Tech Evolution',  tooltip: 'See current tech trends and where they’re headed' },
    icp_insight:           { label: 'ICP Insight',     tooltip: "See what matters about this company for your ICP" },
  },
  tabGroups: { company: 'Company Intel', pain: 'Pain Diagnosis' },
  actions: {
    reanalyzeSection: '↻ Re-analyze this section',
    startPainDiagnosis: 'Start pain diagnosis',
    copyAll: 'Copy all',
    copyTab: 'Copy this tab',
    copyTabShort: 'Copy tab',
    copied: 'Copied',
    sectionGeneratingSuffix: ' generating... (can take up to 10 minutes)',
    painDiagnosisIntro: 'We diagnose industry history and tech evolution together.\nThis can take about 7-10 minutes.',
  },
  benchmarkChart: {
    thisCompany: 'This company',
    industryMedian: 'Industry median',
  },
  icpInsight: {
    hintEmptyIcp: 'Set your ICP in Settings for more accurate insights',
    goToSettings: 'Go to Settings',
    generateButton: 'Generate ICP insight',
    regenerateButton: '↻ Regenerate',
    generatedAgo: (days: number) => (days === 0 ? 'Generated today for this ICP' : `Generated ${days} day${days === 1 ? '' : 's'} ago for this ICP`),
    loading: 'Generating your ICP insight...',
    failed: 'Failed to generate insight. Please try again shortly.',
    noSignals: "There isn't enough signal to work with yet. Try again once the analysis has progressed further.",
    questionsTitle: 'Discovery questions',
    sectionLabel: {
      summary_v2: 'Summary',
      financials_v2: 'Financials',
      business_model_v2: 'Business Model',
      competitors_v2: 'Competitors',
      value_chain_v2: 'Value Chain',
      strategy_v2: 'Strategy',
      industry_history_v2: 'Industry History',
      tech_evolution_v2: 'Tech Evolution',
      founder_v2: 'Founder',
      cross_industry_nudge_v1: 'Nudge',
    },
    ratingPrompt: 'Was this insight helpful?',
    ratingCommentPlaceholder: "What didn't work? (optional)",
    ratingSubmit: 'Submit',
    ratingSubmitted: 'Thanks for the feedback',
    ratingFailed: 'Failed to save your feedback. Please try again.',
  },
  profileForm: {
    companyName: 'Company name',
    companyNamePlaceholder: 'e.g. Acme Inc.',
    region: 'Region',
    orgSize: 'Org size',
    industry: 'Industry',
    jobRole: 'Role',
    jobLevel: 'Level',
    purpose: 'Purpose (select all that apply)',
    purposeOtherPlaceholder: 'Tell us your purpose',
    icpSectionTitle: 'ICP (Ideal Customer Profile)',
    icpHelperText: 'The more specific you are, the more accurate your insights will be',
    icpProduct: 'Product/service',
    icpProductPlaceholder: 'e.g. AI call coaching SaaS for sales teams',
    icpTargetIndustry: 'Target industry',
    icpTargetIndustryPlaceholder: 'e.g. Fintech, Healthcare',
    icpTargetRole: 'Target role',
    icpTargetRolePlaceholder: 'e.g. VP Sales, RevOps lead',
    saving: 'Saving...',
  },
};

const DICTS: Record<Language, UiStringDict> = { ko, en };

export function getUiStrings(language: Language = 'en'): UiStringDict {
  return DICTS[language] ?? DICTS.en;
}

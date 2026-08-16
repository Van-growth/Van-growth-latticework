// 솔루션 앱 전체(랜딩페이지 제외) 정적 UI 문자열 사전 — 헤더/설정/히스토리/모달/검색화면/
// 리포트 탭 라벨. profileLabels.ts와 동일한 Locale/사전/getXxx(locale) 패턴.
// AE Skills 탭(AeSkillsView.tsx)은 콘텐츠 자체가 더미 스텁이라 이 사전 대상에서 제외 —
// 계속 한국어 고정(언어 정책 SSOT 참고). PDF(AnalysisPdf.tsx)는 파일이 이미 커서 자체
// 로컬 t(ko,en) 헬퍼로 별도 처리.

import type { Language } from '@/app/context/LanguageContext';

interface UiStringDict {
  header: {
    analysis: string;
    industries: string;
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
    favoritesTitle: string;
    favoritesEmpty: string;
    recentTitle: string;
    recentEmpty: string;
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
    favoriteAdd: string;
    favoriteRemove: string;
    purposeSectionTitle: string;
    purposeMa: string;
    purposeInvestment: string;
    purposePartnership: string;
    purposeCustomer: string;
    purposeOther: string;
    purposeDetailPlaceholder: string;
    progressCardSources: string;
    progressCardPainDiagnosis: string;
    scanMessages: string[];
    finishingUp: (company: string) => string;
    firstLookupHint: string;
    defaultCompanyName: string;
    linkCopied: string;
    shareCreateFailed: string;
    shareRevoked: string;
    shareRevokeFailed: string;
    loadResultFailed: string;
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
  industryView: {
    subtitle: string;
    loading: string;
    loadError: string;
    industryCompanyCount: (n: number) => string;
    back: string;
    companyLoading: string;
    companyEmpty: string;
    comingSoon: string;
    columnRank: string;
    columnCompany: string;
    columnTicker: string;
    columnRevenue: string;
    columnFiscalYear: string;
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
  };
  actions: {
    reanalyzeSection: string;
    copyAll: string;
    copyTab: string;
    copyTabShort: string;
    copied: string;
    copySection: string;
    scrollToTop: string;
    sectionGeneratingSuffixShort: string;
    sectionFailedEmpty: string;
    // 재무제표 자체가 없는 기업(EDGAR/DART 둘 다 미공시, 예: 비상장/비영리) 전용 — 재분석해도
    // 달라지지 않으므로 sectionFailedEmpty와 별개 문구(재분석 CTA 없음, 2026-08-16 작업 D).
    financialsNoOfficialData: string;
  };
  benchmarkChart: {
    thisCompany: string;
    industryMedian: string;
  };
  ben: {
    panelTitle: string;
    emptyState: string;
    placeholder: string;
    quickQuestions: string[];
    mungerPromptLabel: string;
    mungerPrompt: string;
    resetButton: string;
    signInToChat: string;
    rateLimited: (usedCount: number, limit: number) => string;
    genericError: string;
    widthDefault: string;
    widthWide: string;
    openAria: string;
    hint: string;
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
    nickname: string;
    nicknameHelperText: string;
    nicknamePlaceholder: string;
    saving: string;
  };
}

const ko: UiStringDict = {
  header: {
    analysis: '기업분석',
    industries: '산업별 보기',
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
    title: '히스토리',
    loadError: '분석 목록을 불러오지 못했습니다.',
    loading: '불러오는 중...',
    loginRequired: '로그인 후 이용할 수 있습니다.',
    empty: '아직 분석 결과가 없습니다.',
    emptyCta: '첫 번째 기업을 분석해보세요 →',
    favoritesTitle: '★ 즐겨찾기',
    favoritesEmpty: '즐겨찾기한 분석이 없습니다. 분석 결과 화면에서 ★ 버튼으로 추가해보세요.',
    recentTitle: '최근 조회',
    recentEmpty: '아직 조회한 분석이 없습니다.',
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
    favoriteAdd: '즐겨찾기에 추가',
    favoriteRemove: '즐겨찾기 해제',
    purposeSectionTitle: '분석 목적',
    purposeMa: '인수합병',
    purposeInvestment: '투자',
    purposePartnership: '파트너십',
    purposeCustomer: '고객',
    purposeOther: '기타',
    purposeDetailPlaceholder: '예: OO가 인수할 수 있는 OO 분야 회사를 찾아, fit과 재무 건전성을 파악하기 위함',
    progressCardSources: '출처',
    progressCardPainDiagnosis: 'Pain Diagnosis',
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
  industryView: {
    subtitle: 'SIC 업종별 매출 상위 기업을 확인할 수 있어요 (EDGAR 배치 데이터 기준).',
    loading: '산업 목록을 불러오는 중...',
    loadError: '산업 목록을 불러오지 못했습니다.',
    industryCompanyCount: (n: number) => `${n}개 기업`,
    back: '← 산업 목록으로',
    companyLoading: '기업 목록을 불러오는 중...',
    companyEmpty: '아직 데이터가 준비된 기업이 없어요.',
    comingSoon: '준비 중',
    columnRank: '순위',
    columnCompany: '기업',
    columnTicker: '티커',
    columnRevenue: '매출',
    columnFiscalYear: '회계연도',
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
  },
  actions: {
    reanalyzeSection: '↻ 이 섹션 다시 분석',
    copyAll: '전체 복사',
    copyTab: '이 탭 복사',
    copyTabShort: '탭 복사',
    copied: '복사됨',
    copySection: '이 섹션 복사',
    scrollToTop: '맨 위로 이동',
    sectionGeneratingSuffixShort: ' 생성 중... (최대 1~2분 정도 소요될 수 있어요)',
    sectionFailedEmpty: '이 섹션은 생성에 실패했습니다. 재분석을 시도해보세요.',
    financialsNoOfficialData: '이 기업은 SEC(EDGAR)나 DART에 공식 재무제표를 공시하지 않아 재무 데이터를 제공할 수 없어요.',
  },
  benchmarkChart: {
    thisCompany: '이 회사',
    industryMedian: '업종 중앙값',
  },
  ben: {
    panelTitle: 'Ben',
    emptyState: '기업을 먼저 분석해주세요. 분석이 끝나면 이 리포트를 바탕으로 질문할 수 있어요.',
    placeholder: '질문을 입력하세요...',
    quickQuestions: ['핵심 리스크 요약', '경쟁사 대비 포지션', '이 회사에 대해 더 알아야 할 게 있을까요?'],
    mungerPromptLabel: '멍거 체크리스트',
    mungerPrompt: `찰리 멍거 관점에서 이 기업을 체크리스트로 평가해줘. 아래 5개 프레임 각각에 대해 현재 분석 데이터 기반으로 간결하게 답해줘:

1. 비즈니스 퀄리티: 진입장벽 / Pricing power / 10년 내구성
2. 해자(Moat): 전환비용 / 규모의 경제 / 네트워크 효과
3. 경영진: 자본배분 / 가이던스 실행력 / SBC 수준
4. 재무: ROE·ROIC vs 자본비용 / FCF vs 순이익 괴리 / 부채 안전성
5. 밸류에이션: 현재 가격에 반영된 성장 가정 / 최악 시나리오 손실 / 5년 후 이 가격이 싸 보일 조건

각 항목은 ✅ 양호 / ⚠️ 주의 / ❌ 취약 으로 시작하고 한 줄 근거를 붙여줘.`,
    resetButton: '대화 초기화',
    signInToChat: '로그인 후 Ben과 대화할 수 있어요.',
    rateLimited: (usedCount: number, limit: number) => `오늘 사용 가능한 메시지(${limit}개)를 모두 사용했어요 (${usedCount}/${limit}). 내일 다시 시도해주세요.`,
    genericError: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    widthDefault: '기본',
    widthWide: '넓게',
    openAria: 'Ben 열기',
    hint: '이 분석 결과를 기반으로 질문해보세요.',
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
    nickname: '닉네임',
    nicknameHelperText: '공유 링크/PDF에서 이 분석을 만든 사람을 표시할 때 쓰여요 (이메일은 노출되지 않아요). 비워두면 이름 없이 표시돼요.',
    nicknamePlaceholder: '예: Ben',
    saving: '저장 중...',
  },
};

const en: UiStringDict = {
  header: {
    analysis: 'Company Analysis',
    industries: 'By Industry',
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
    title: 'History',
    loadError: 'Failed to load your analysis list.',
    loading: 'Loading...',
    loginRequired: 'Please log in to view your history.',
    empty: "You don't have any analyses yet.",
    emptyCta: 'Analyze your first company →',
    favoritesTitle: '★ Favorites',
    favoritesEmpty: 'No favorites yet. Tap the ★ button on a report to add one.',
    recentTitle: 'Recent',
    recentEmpty: "You haven't viewed any analyses yet.",
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
    favoriteAdd: 'Add to favorites',
    favoriteRemove: 'Remove from favorites',
    purposeSectionTitle: 'Purpose of this analysis',
    purposeMa: 'M&A',
    purposeInvestment: 'Investment',
    purposePartnership: 'Partnership',
    purposeCustomer: 'Customer',
    purposeOther: 'Other',
    purposeDetailPlaceholder: 'e.g. Finding acquisition targets in the OO space for OO, to assess fit and financial health',
    progressCardSources: 'Sources',
    progressCardPainDiagnosis: 'Pain Diagnosis',
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
  industryView: {
    subtitle: 'See top companies by revenue within each SIC industry (based on EDGAR batch data).',
    loading: 'Loading industry list...',
    loadError: 'Failed to load the industry list.',
    industryCompanyCount: (n: number) => `${n} companies`,
    back: '← Back to industries',
    companyLoading: 'Loading companies...',
    companyEmpty: 'No companies with ready data yet.',
    comingSoon: 'Coming soon',
    columnRank: 'Rank',
    columnCompany: 'Company',
    columnTicker: 'Ticker',
    columnRevenue: 'Revenue',
    columnFiscalYear: 'Fiscal Year',
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
  },
  actions: {
    reanalyzeSection: '↻ Re-analyze this section',
    copyAll: 'Copy all',
    copyTab: 'Copy this tab',
    copyTabShort: 'Copy tab',
    copied: 'Copied',
    copySection: 'Copy this section',
    scrollToTop: 'Scroll to top',
    sectionGeneratingSuffixShort: ' generating... (can take up to 1-2 minutes)',
    sectionFailedEmpty: 'This section failed to generate. Try re-analyzing it.',
    financialsNoOfficialData: "This company doesn't file official financials with SEC (EDGAR) or DART, so financial data isn't available.",
  },
  benchmarkChart: {
    thisCompany: 'This company',
    industryMedian: 'Industry median',
  },
  ben: {
    panelTitle: 'Ben',
    emptyState: 'Analyze a company first. Once it finishes, you can ask questions grounded in this report.',
    placeholder: 'Ask a question...',
    quickQuestions: ['Summarize the core risks', 'How does this stack up against competitors?', 'What else should I know about this company?'],
    mungerPromptLabel: 'Munger checklist',
    mungerPrompt: `Evaluate this company as a checklist from Charlie Munger's perspective. Answer each of the 5 frames below concisely based on the current analysis data:

1. Business quality: barriers to entry / pricing power / 10-year durability
2. Moat: switching costs / economies of scale / network effects
3. Management: capital allocation / guidance execution / SBC levels
4. Financials: ROE/ROIC vs. cost of capital / FCF vs. net income gap / debt safety
5. Valuation: growth assumptions priced in today / worst-case downside / conditions under which this price looks cheap in 5 years

Start each item with ✅ Good / ⚠️ Caution / ❌ Weak, followed by a one-line rationale.`,
    resetButton: 'Reset chat',
    signInToChat: 'Sign in to chat with Ben.',
    rateLimited: (usedCount: number, limit: number) => `You've used all ${limit} messages available today (${usedCount}/${limit}). Please try again tomorrow.`,
    genericError: 'Something went wrong. Please try again shortly.',
    widthDefault: 'Default',
    widthWide: 'Wide',
    openAria: 'Open Ben',
    hint: 'Ask questions grounded in this report.',
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
    nickname: 'Nickname',
    nicknameHelperText: "Shown as the author on shared links/PDFs (your email is never exposed). Leave it blank to show no name.",
    nicknamePlaceholder: 'e.g. Ben',
    saving: 'Saving...',
  },
};

const DICTS: Record<Language, UiStringDict> = { ko, en };

export function getUiStrings(language: Language = 'en'): UiStringDict {
  return DICTS[language] ?? DICTS.en;
}

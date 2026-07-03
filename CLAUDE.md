# Latticework — CLAUDE.md

## Project overview
기업 분석 플랫폼. 기업명 입력 시 Claude Sonnet + Web Search로 심층 분석 후 결과를 Supabase에 저장·표시.

## Stack
- **client/** — Next.js 15, TypeScript, Tailwind CSS (App Router, `src/` 구조)
- **server/** — Node.js, Express, TypeScript
- **DB** — Supabase (PostgreSQL)
- **AI** — Anthropic Claude claude-sonnet-4-6 + web_search_20250305 tool

## Folder structure
```
latticework/
  client/          Next.js app
  server/          Express API
  scripts/         Dev helper scripts (migration-hook.mjs 등)
  supabase/
    migrations/    SQL migration files — MCP로 자동 적용됨
  .claude/
    settings.json  PostToolUse hook 설정 (migration 자동화)
  .env.example     Required env vars
  CLAUDE.md        This file
```

## Environment setup
1. Copy `.env.example` → `.env` in repo root, `server/`, and `client/`
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
3. DB 마이그레이션은 Supabase MCP가 자동 처리 (아래 참고)

## Supabase MCP 마이그레이션 워크플로우

**Supabase 프로젝트 ID**: `rtpcmbxijcxhzvortwxf`

### 규칙: 새 마이그레이션 파일 작성 시 반드시 MCP로 즉시 적용

`supabase/migrations/*.sql` 파일을 Write 할 때마다 **반드시** 같은 응답 안에서
`mcp__plugin_supabase_supabase__apply_migration`을 호출하여 적용해야 함.

```
apply_migration(
  project_id = "rtpcmbxijcxhzvortwxf",
  name       = "<파일명에서 .sql 제거>",
  query      = "<파일 전체 SQL>"
)
```

- PostToolUse hook(`scripts/migration-hook.mjs`)이 파일 감지 후 적용 정보를 출력함
- 마이그레이션 SQL은 항상 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`로 멱등성 보장
- 마이그레이션 적용 확인: `list_migrations(project_id="rtpcmbxijcxhzvortwxf")`

## Dev
```bash
# Server (port 4000)
cd server && npm install && npm run dev

# Client (port 3000)
cd client && npm install && npm run dev
```

## API
| Method | Path          | Body                      | Response              |
|--------|---------------|---------------------------|-----------------------|
| POST   | /api/analyze  | `{ companyName: string }` | `{ content, ... }`    |
| GET    | /health       | —                         | `{ status: "ok" }`    |

## DB schema (현재 적용 완료)

**companies**: `id`, `name` (unique), `created_at`

**analyses**: `id`, `company_id` (FK→companies), `summary`, `industry_history`,
`tech_evolution`, `value_chain_overview`, `business_model`, `financials`,
`moat_analysis` (JSONB), `risk_analysis` (JSONB), `sources` (JSONB),
`competitors` (JSONB), `strategy` (JSONB), `created_at`

**value_chain_players**: `id`, `analysis_id` (FK→analyses), `role`, `player_name`, `description`, `created_at`

**linkedin_drafts**: `id`, `analysis_id` (FK→analyses), `draft_number` (1–3), `content`, `created_at`

**analyses**(추가 컬럼): `growth_scenario_v2` (JSONB — 몬테카를로 성장 시나리오, 3차 배치)

**corp_master**(추가 컬럼): `ksic_code`, `sector_tag` — DART 상장기업(3,971개) 전수 적재 완료

**cik_master**(추가 컬럼): `sic_code`, `sic_description`, `sector_tag` — EDGAR 전체(8,021개) 적재 중

**sector_mapping**: `id`, `source`('DART'|'EDGAR'), `original_code`(KSIC division/SIC major group·상세코드),
`original_name`, `sector_tag`(12개 공통 태그: SAAS/MANUFACTURING/BIOTECH_HEALTHCARE/RETAIL_COMMERCE/
FINANCE/MEDIA_CONTENT/HARDWARE_SEMICONDUCTOR/ENERGY/LOGISTICS_TRANSPORT/CONSUMER_GOODS/
REAL_ESTATE_CONSTRUCTION/OTHER)

**analysis_usage**: `id`, `user_id`(로그인 시 auth.users.id, 비로그인 시 클라이언트 임시 식별자),
`analysis_target`, `created_at` — 무료 분석 횟수 제한(rolling 7일 2회) 추적용

**profiles** (2026-07-03, 구글 로그인 도입): `id`(PK, auth.users(id) 참조), `email`,
`is_premium_override`(BOOLEAN, 기본 false — Stripe 연동 전 로그인 유저 개별 프리미엄 우회용),
`created_at`. auth.users에 신규 행(최초 구글 로그인) 생성 시 트리거로 자동 1행 생성.

## Data SSOT 기준

### 1. 데이터 신뢰도 계층
내부 분류 (코드에서만 사용, 유저에게 노출 금지):

| 내부 코드 | 유저 표시 | 소스 예시 |
|-----------|-----------|-----------|
| L1 | 🟢 공식 | SEC EDGAR, DART, 회사 IR |
| L2 | 🟡 참고 | Bloomberg, 한경, StockAnalysis |
| L3 | ⚪ 추정 | 웹검색, Claude 추정 |

규칙: 같은 항목에 상위 레벨 데이터 있으면 하위 레벨 무시.
유저에게는 반드시 🟢공식 / 🟡참고 / ⚪추정 으로만 표시.
L1/L2/L3 텍스트 유저 화면에 절대 노출 금지.

### 2. 섹션별 데이터 소스 우선순위
```
재무수치:   DART > EDGAR > FMP > StockAnalysis > 웹검색
시세/밸류:  TradingView > KIS > 웹검색
텍스트분석: Claude 웹검색 기반 (L2/L3)
창업자정보: LinkedIn > Crunchbase > TheVC > 언론
```

### 3. 캐시 무효화 기준
| 데이터 유형 | 갱신 주기 |
|-------------|-----------|
| 재무제표 | 분기별 (3개월) |
| 시세/밸류에이션 | 실시간 (TradingView 위젯) |
| 창업자 정보 | 6개월 |
| 텍스트 분석 | 분석 요청 시마다 새로 생성 |

### 4. 판단불가 값 처리 규칙
- `-999`, `-999%` 등 placeholder 값은 `—` (em dash)로 표시 — `isPlaceholder()` 함수가 `DataValue`/`MetricCard`에서 처리
- 데이터 없는 항목은 `확인 필요` 대신 `—` 표시
- 추정값은 반드시 `(추정)` 뱃지 표시

### 5. 출처 표시 규칙 (전 탭 공통 — 가장 중요)
- 모든 탭 (요약/산업역사/기술변화/밸류체인/비즈니스모델/경쟁사/전략/재무/창업자) 출처 표시 필수
- 재무 탭뿐 아니라 웹검색 기반 텍스트 데이터도 반드시 출처 포함
- 출처 없는 수치/사실 데이터 표시 금지

유저에게 보이는 형태:
매출 $601.8M [1] 🟢
[1] SEC EDGAR — 10-K FY2025 🟢 공식

성장률 38% [2] ⚪
[2] StockAnalysis — FY2025 추정 ⚪ 추정

규칙:
- 본문 수치/사실 옆 [n] superscript 뱃지
- 탭 하단 출처 목록에 🟢공식 / 🟡참고 / ⚪추정 뱃지 표시
- PDF 각 섹션 하단 + 마지막 페이지 통합 출처 목록
- Claude 프롬프트에서 sources 생성 시 reliability를
  'official' | 'reference' | 'estimated' 로 반환
  (프론트에서 🟢/🟡/⚪ 로 변환)

## 제품 SSOT 기준

### 제품 철학
- 단순하게, 빠르게가 핵심
- UI보다 기능이 먼저
- 미국 B2B: 문제 해결되면 돈 냄, UI는 나중
- 복잡한 기능 추가보다 핵심 기능 완성도
- "5명이 매일 쓰는 게 목표"

### 핵심 타겟 유저
- 세일즈 담당자: 미팅 전 고객사 빠른 파악
- BD 담당자: 파트너/협력사 리서치
- 전략 담당자: 경쟁사 분석 / 밸류체인 / M&A 대상 탐색

공통 use case: 미팅/협상/의사결정 전 빠르게 기업 파악
타겟 시장: 미국 우선 (세일즈 담당자만 미국 ~1,500만 명)

### 개발 우선순위 원칙
베타 오픈 전 반드시 해결 순서:

1순위 — 속도 + 서버 안정성 (이게 안 되면 아무도 안 씀)
- 탭 전환 100ms 이하 목표
- 배치 타임아웃 없이 전 섹션 완료
- gatherResearch 통합 웹검색 (중복 제거)
- 히스토리 즉시 로드

2순위 — 데이터 신뢰성 (틀리면 신뢰 잃음)
- 출처 [n] 각주 정확히 표시
- 0% / -999 같은 오류 값 완전 제거
- EDGAR/DART 태그 매핑 정확도
- 추정값 반드시 "(추정)" 표시

3순위 — UI/UX (불편하면 안 씀)
- 탭별 핵심 먼저 + 더 보기 구조
- 스켈레톤 UI
- 시각적 개선 (화살표, 차트 등)

원칙: 속도 느리면 이탈, 데이터 틀리면 신뢰 잃음, UI 불편하면 안 씀.

### 콘텐츠 원칙
- 데이터 나열 금지 → 비즈니스 의사결정 직결 인사이트 우선
- 투자자 전용 언어 금지 (밸류에이션/수익률/PER 단독 언급)
- Bull/Bear 금지 → 성장 모멘텀/핵심 리스크
- "확인 필요" 남발 금지 → 추정값이라도 출처와 함께 제공

### 성능 원칙
- 외부 실시간 위젯 (iframe) 금지 — 정적 이미지로 대체
- 탭 콘텐츠 조건부 렌더링 (unmount) 유지
- 긴 리스트/테이블은 가상화 적용
- 스켈레톤 UI: 데이터 로딩 전 레이아웃 미리 표시
- 탭 전환 목표: 100ms 이하
- 최초 요약 탭 표시 목표: 3초 이하
- 전체 분석 완료 목표: 60초 이하

### 플랜 경계
- 기본: 웹검색 기반 전략 인사이트 (속도 우선)
- 프리미엄: DART/EDGAR 정확한 재무 완전판 + 경쟁사 재무 비교
- 프리미엄 전용 기능은 `isPremium` 플래그로 명시
- 기본에서 프리미엄 기능 노출 시 업그레이드 CTA 표시

### 무료/프리미엄 모델 (2026-07-03~)
- 콘텐츠 섹션(요약/산업역사/기술변화/밸류체인/비즈니스모델/경쟁사/전략/재무/창업자)은
  무료·프리미엄 동일하게 전체 노출 — 섹션 잠금 방식 아님
- 무료 유저는 **분석 "횟수"로만 제한**: rolling 7일 내 신규 분석(신규 기업 첫 분석 +
  "새로 분석하기" 강제 재분석) 2회. 이미 분석된 기업의 단순 재조회(캐시 그대로 보여주기)는 카운트 제외
- 제한 도달 시 "다음 사용 가능 시점" 안내 + 프리미엄 업그레이드 CTA
- 프리미엄 유저는 횟수 제한 없음 (기록은 남기되 체크 스킵)
- **로그인 방식은 구글 OAuth 단일 지원** (2026-07-03 도입, Supabase Auth
  `signInWithOAuth({ provider: 'google' })`) — 카카오 등 추가 provider 없음.
  로그인은 선택 사항, 비로그인도 계속 체험 가능 (온보딩 설문은 별도 미착수 항목).
  `analysis_usage.user_id`는 로그인 시 `auth.users.id` 우선 사용, 비로그인 시 기존
  클라이언트 임시 식별자(localStorage UUID)로 폴백 — `server/src/lib/authUser.ts`가
  `Authorization: Bearer <access_token>`을 `supabase.auth.getUser()`로 검증
- **성장 시나리오(몬테카를로 매출 시뮬레이션) 탭은 횟수 제한과 별개로 기능 자체가
  프리미엄 전용** — 무료 유저는 항상 잠금 + 업그레이드 CTA, 콘텐츠 게이팅과 무관
- `isPremium` 판정(`server/src/lib/premium.ts`, async)은 Stripe 연동 전까지 두 우회
  경로의 OR로 결정: (1) `PREMIUM_OVERRIDE_CLIENT_IDS` 환경변수 — 비로그인 내부
  테스트 클라이언트ID, (2) `profiles.is_premium_override` — 로그인 유저 개별 플래그
  (DB에서 수동 설정, 로그인 안 하면 이 경로 자체가 평가 안 됨)

### UI/UX 원칙
- 라이트 테마 고정
- 탭별 검정 배경 한줄 요약 블록 필수
- 탭별 핵심 먼저 표시 + 더 보기 구조
- 국가 표시: 국기 이모지
- 모바일 반응형 유지

### 언어 정책
- 기본값: 브라우저 언어 감지 (ko → KR, 그 외 → EN)
- 우측 상단 EN/KR 토글로 변경 가능, localStorage에 저장
- 분석 시 선택 언어로 Claude 프롬프트 분기
- DB: analyses.language 컬럼으로 KR/EN 캐시 분리
- KR 캐시 ≠ EN 캐시 (동일 기업이라도 언어별 별개 저장)
- Claude 프롬프트에 언어 명시: "Generate all content in Korean/English"

### 브랜딩
- 제품명: 1min (Latticework는 내부 코드명)
- 포지셔닝: "What used to take hours, now takes minutes"
- "1분 안에" 약속 금지 — 실제 소요 3~5분
- 투자자 타겟 포지셔닝 금지
- 1min은 리드 레이어(Cognism/Apollo류 — 연락처/워크플로우 DB)가 아니라
  리포트 레이어(기업 자체에 대한 구조화된 AI 리서치)를 다루는 제품

### 분석 배치 구조 (1차/2차/3차)
- **1차** (목표 60초 이내, 완료 즉시 요약/재무 탭 렌더링):
  - 1배치 (병렬 1개): summary_v2
  - fin_preview: EDGAR/DART 캐시·라이브 raw 데이터로 재무 탭 즉시 프리뷰 (batch4 Claude 응답 이전)
- **2차** (1차 이후 백그라운드로 계속 처리, 기존 Promise.all 그대로):
  - 2배치 (병렬 3개): industry_history_v2, business_model_v2, competitors_v2
  - 3배치 (병렬 3개): tech_evolution_v2, value_chain_v2, strategy_v2
  - 4배치 (병렬 2개): financials_v2, sources
  - 5배치: founder_v2
- **3차** (2차 전체 완료 후, revenue_history 3개년 이상 확보된 기업만):
  - 6배치: growth_scenario_v2 — 몬테카를로 매출 시뮬레이션 (순수 계산, 프리미엄 전용 탭)
- 각 배치 완료 시 즉시 Supabase DB 저장 + SSE(`batch` 이벤트)로 프론트엔드 반영
- 캐시 미스(EDGAR/DART 라이브 조회)로 1차가 60초를 넘길 수 있는 경우 `meta` 이벤트로
  `isFirstLookup: true` 전달 → 프론트에 "처음 조회하는 기업이라 조금 더 걸려요" 안내
- 배치 타임아웃: 75초
- 배치 실패 시 해당 섹션만 "—" 표시, 나머지 계속 진행
- 상단 진행바: "배치 N/5 완료" 표시 (6배치는 진행률 계산에서 제외 — 프리미엄 전용이라 대부분 유저에게 미노출)

### 보안
- RLS 전 테이블 적용 완료 (2026-07-03, 로그인 구현을 기다리지 않고 선적용 — 상세는 Security Principles 섹션 참고)
- 백엔드는 SUPABASE_SERVICE_ROLE_KEY로 접속 (anon key 아님 — RLS를 우회해야 하므로)
- 환경변수: .env에만 관리, 코드 하드코딩 금지
- 필수 API 키: ANTHROPIC_API_KEY, DART_API_KEY, FMP_API_KEY, KIS_APP_KEY, KIS_APP_SECRET
- 시크릿 키는 서버(.env) 한 곳에만 — 클라이언트(client/.env.local)에 중복 저장 금지

### GTM 방향
- 1차 타겟: 미국 시장 (영어 버전 우선)
- 채널: Product Hunt, Reddit (r/sales, r/BusinessDevelopment, r/startups)
- 랜딩페이지: Framer 무료 플랜
- 결제: 앱 내 Stripe만 (랜딩페이지 결제 없음)
- 도메인: 1min.so 또는 get1min.com (미정)
- 온보딩: 구글 로그인 + 설문 (직무/지역/목적/회사규모)
- 행동 로그: Posthog
- 라이브 채팅: Crisp

## 기능 정의

### 핵심 기능 (Core) — 이게 안 되면 제품이 아님
① 기업 검색 및 분석 생성
   - 기업명 입력 → Claude + 웹검색으로 분석 생성
   - 한국/미국 기업 모두 지원 (DART + EDGAR)
   - 24시간 캐시 히트 (동일 기업 재조회 시 즉시 로드)
   - 배치 구조로 요약 탭 먼저 표시 → 나머지 순차 로드

② 기업 개요 (요약 탭)
   - 한줄 포지셔닝 (업종 + 밸류체인 위치)
   - 핵심 KPI (매출/영업이익률/시가총액/YoY)
   - 주가 차트 (Finviz/네이버 정적 이미지)
   - 주요 제품/서비스 + 매출 비중
   - 주요 고객사 + 집중도 리스크
   - 성장 모멘텀 / 핵심 리스크

③ 산업/경쟁 분석
   - 산업역사 타임라인
   - 기술변화 단계
   - 밸류체인 내 위치
   - 경쟁사 포지셔닝 (전략 중심)

④ 비즈니스 모델
   - 수익 구조 + 성장 모션
   - Unit Economics
   - 경쟁 해자 (MOAT)

⑤ 재무 데이터
   - 손익계산서 / 재무상태표 / 현금흐름
   - EDGAR/DART 공식 데이터 우선
   - 출처 [n] 각주 표시

⑥ 창업자/경영진 프로파일
   - 기본 정보 + 커리어 궤적
   - 창업 이력 (1st time / Serial)
   - 평판 + 네트워크

⑦ PDF 내보내기
   - 전체 섹션 포함
   - 출처 목록 마지막 페이지

⑧ 히스토리
   - 분석 기록 저장 + 즉시 로드

### 부가 기능 (Nice to Have) — 있으면 좋고 없어도 됨
① 세일즈 특화
   - 임직원수 + 채용 트렌드
   - C레벨 LinkedIn 포스팅 요약
   - CEO 유튜브/팟캐스트 발언 요약
   - Glassdoor 평판
   - 미팅 전 체크리스트 자동 생성
   - 기술 스택

② 산업군별 정리
   - 동일 산업 유사기업 리스트
   - 산업 내 점유율/순위
   - 주요 플레이어 빠른 비교

③ 비교 분석
   - A vs B 기업 비교 리포트 (프리미엄)
   - 경쟁사 재무 수치 비교 (프리미엄)

④ 직무별 앵글
   - 세일즈/BD/전략 담당자별 해석 다르게 출력

⑤ AI 비서
   - 분석 결과 기반 질문/답변 (현재 우측 패널)

⑥ 공유
   - 분석 결과 링크 공유

⑦ 온보딩/계정
   - 구글 로그인
   - 유저 설문 (직무/지역/목적)
   - Posthog 행동 로그
   - Crisp 라이브 채팅

⑧ 결제
   - Stripe 프리미엄 플랜

### 핵심 기능 완성도 기준
모든 핵심 기능(①~⑧)이 아래 조건을 만족하면 베타 오픈 가능:

**속도**
- 요약 탭 30초 이내 표시
- 전체 완료 75초 이내
- 탭 전환 즉시 반응 (100ms 이하)

**안정성**
- 배치 타임아웃 없이 전 섹션 완료
- 히스토리 즉시 로드

**신뢰성 (가장 중요)**
- 모든 탭 출처 [n] 각주 표시 필수
  (재무탭뿐 아니라 산업역사/기술변화/밸류체인/비즈니스모델/경쟁사/전략/창업자 전부)
- 웹검색 기반 데이터도 반드시 URL 출처 포함
- -999 / 0% 오류 값 완전 제거
- 추정값 반드시 "(추정)" 표시
- 출처 없는 수치 데이터 표시 금지

**UX**
- 탭별 더 보기 구조
- 스켈레톤 UI
- 모바일 반응형

**출처 표시 규칙 (전 탭 공통)**
- 본문 수치/사실 옆 [n] superscript 뱃지
- 탭 하단 출처 목록: [1] 출처명 — 설명 (L1/L2/L3)
- PDF 각 섹션 하단 + 마지막 페이지 통합 목록
- L1(공식공시) > L2(공신력 미디어) > L3(웹검색 추정) 우선순위

## 백로그

### 🔴 1순위 (베타 전 필수)
- [ ] 탭 전환 100ms 이하 (실측 미완)
- [ ] 온보딩 설문 (직무/지역/목적/회사규모) — 구글 로그인 자체는 완료(아래 ✅ 참고),
  로그인 후 프로필 설문만 미착수

### 🟡 2순위 (데이터/기능)
- [ ] EDGAR 태그 매핑 강화 + FMP 폴백
- [ ] 한국 주식 KRX 티커 매핑
- [ ] 세일즈 특화 기능 (임직원수/채용/LinkedIn/Glassdoor)
- [ ] 산업군별 정리
- [ ] AI 비서 재활성화 (현재 코드 주석 처리됨)

### 🟢 3순위 (GTM)
- [ ] Framer 랜딩페이지
- [ ] 영문화 (EN/KR 토글)
- [ ] Reddit 포스팅 (r/sales, r/BusinessDevelopment, r/startups)
- [ ] Posthog 행동 로그
- [ ] Crisp 라이브 채팅
- [ ] Stripe 결제 연동
- [ ] Product Hunt 런칭
- [ ] 도메인 구매 (1min.so)

### ✅ 완료
- [x] 창업자 탭 추가
- [x] 출처 각주 시스템 (🟢공식/🟡참고/⚪추정)
- [x] 배치 구조 + 캐시 히트
- [x] DART/EDGAR 매핑 118k/8k
- [x] -999 placeholder 처리
- [x] 성장 모멘텀/핵심 리스크 교체
- [x] Finviz 정적 차트
- [x] CLAUDE.md SSOT 완성
- [x] 밸류체인 세로 구조 (업스트림→다운스트림 ↓ 화살표)
- [x] 더 보기/접기 토글 (ShowMore)
- [x] PDF 온디맨드 생성 (pdf().toBlob())
- [x] AI 비서 우측 패널 임시 제거 (단일 컬럼)
- [x] 스켈레톤 UI (sentinel completedBatches Set([-1]))
- [x] gatherResearch 통합 웹검색 (1 pass 공유, 중복 제거, maxRounds=4)
- [x] SEC EDGAR fetch 차단 (속도 개선, 5s timeout)
- [x] Revenue Streams 통합 표시 (항상 전체 노출)
- [x] 메인 앱 중앙 정렬 (max-w-4xl mx-auto)
- [x] 탭 호버 툴팁 (툴팁 스트립 탭 바 아래)
- [x] KPI 카드 간소화 (숫자+연도+화살표)
- [x] 요약 탭 → 재무/비즈니스모델/경쟁사/전략 탭 이동 버튼
- [x] PDF 목차 페이지 + 공유 URL 웹 링크
- [x] 공유 링크 로그인/회원가입 CTA (토스트 "준비 중")
- [x] KPI 3-col 레이아웃 + no-truncate, bar chart full-width, Finviz w-full
- [x] one_liner → key_bullets 전환 (검정블록 3-bullet 배열, 전 탭·PDF·서버 일괄)
- [x] PDF 로딩 오버레이 (9개 wit 메시지 회전, 바운싱 도트)
- [x] PDF 경량화 (NotoSansKR 700 weight 제거)
- [x] 섹터 매핑 (sector_mapping 테이블, KSIC/SIC → 12개 공통 sector_tag, 상장 12k개 기업 적재)
- [x] financial_cache 다년치 시계열 확인 + 라이브 EDGAR/DART 조회 경로도 4개년 시계열 확장
- [x] 몬테카를로 성장 시나리오 엔진 (server/src/services/monteCarloService.ts, 순수 계산)
- [x] 배치 1차/2차/3차 스플릿 (요약+재무 즉시 → 나머지 백그라운드 → 몬테카를로) + 캐시미스 안내
- [x] 무료 분석 횟수 제한 (analysis_usage 테이블, rolling 7일 2회, 임시 클라이언트 식별자)
- [x] 성장 시나리오 탭 프리미엄 게이팅 (isPremium 스텁, PRO 배지 + 업그레이드 CTA)
- [x] growth_scenario_v2 서버사이드 프리미엄 필터링 (:id/share.ts/실시간 스트림 응답 조립 단계에서 필터)
- [x] Supabase 보안 점검 — service_role 전환 + 전 테이블 RLS 활성화 + /api/chat 라우트 제거 + 보안 헤더 추가
- [x] ⑬ 프리미엄 - 성장 시나리오 시뮬레이션 (몬테카를로, 상장사+섹터벤치마크 하이브리드)
- [x] ⑮ 기업명 자동완성 (중복 분석 방지) — `GET /api/companies/autocomplete?q=` (2글자 미만 빈 배열,
  최근 분석일순 최대 8개, 이미 분석 이력 있는 기업만), 검색창 300ms 디바운스 드롭다운 +
  키보드 위/아래·Enter·Esc, 선택 시 `/api/analyze/stream` 대신 `GET /api/analyses/:id`로 직접
  로드(history 탭과 동일 경로) — 신규 Claude 호출도 무료 횟수 카운트도 발생하지 않음
- [x] 구글 로그인 (Supabase Auth, 2026-07-03) — 로그인 방식은 구글 OAuth 단일 지원.
  클라이언트: `@supabase/supabase-js` anon 키로 `signInWithOAuth`/세션 관리만 수행
  (데이터 조회는 여전히 서버 경유만, RLS가 anon 키로는 전 테이블 차단). `AuthContext`
  전역 세션 훅 + 공용 `Header` 컴포넌트(로그인 버튼/아바타·이메일·로그아웃).
  서버: `Authorization: Bearer <access_token>`을 `resolveAuthUser()`가
  `supabase.auth.getUser()`로 검증. `analysis_usage.user_id`는 로그인 시 auth user id
  우선, 비로그인 시 기존 client_id 폴백. `profiles.is_premium_override` 컬럼 +
  auto-insert 트리거 추가, `isPremiumUser`가 override 클라이언트ID OR 이 플래그로 판정.
  CSP도 갱신(connect-src에 Supabase URL, img-src에 구글 아바타 도메인 lh3.googleusercontent.com).
  실제 구글 계정으로 로그인 완료 후 analysis_usage 기록 확인은 사용자가 직접 테스트 필요
  (자동화 불가 — Google 실계정 인증 단계).

## Security Principles (SSOT)

### 원칙 1: 과금/권한 경계는 반드시 서버에서
프론트엔드 UI로 가리는 것(잠금 화면, 블러 처리)은 UX이지 보안이 아니다.
서버가 응답에 데이터를 실어 보내는 순간, 개발자도구 Network 탭으로 누구나 볼 수 있다.
→ 프리미엄 전용 데이터는 서버 응답 조립 단계에서 권한 체크 후 제외한다.

### 원칙 2: RLS는 기본이 아니라 직접 켜야 하는 것
Supabase는 신규 테이블 생성 시 RLS가 기본적으로 꺼져 있다.
→ 새 테이블 추가 시 반드시 RLS 활성화 여부 확인을 배포 체크리스트에 포함.
→ 백엔드가 anon key로 접속 중이면 RLS를 켜는 순간 서비스 장애 가능
  (service_role 전환이 선행되어야 함).

### 원칙 3: 클라이언트에 시크릿 키 중복 저장 금지
서버용 API 키(Anthropic 등)를 클라이언트(Next.js) .env에도 별도로 두면,
사용하지 않는 API 라우트가 인증 없이 노출될 경우 크레딧 소진 공격에 취약해진다.
→ 시크릿 키는 서버 한 곳에만 보관, 클라이언트는 서버를 경유해서만 접근.

### 원칙 4: UI에서 제거된 기능도 라우트/코드는 별도로 점검
"화면에서 뺐다"와 "배포에서 뺐다"는 다르다.
비활성화된 기능의 API 라우트가 코드베이스에 남아있으면 여전히 공격 표면이다.

### 실전 발견 이력 (반복 방지용 기록, 2026-07-03)
1. growth_scenario_v2가 :id/share.ts/실시간 스트림 라우트에서 premium 체크 없이
   항상 응답에 포함되던 이슈 → Playwright 브라우저 테스트로 발견
   (타입체크/빌드로는 안 잡힘) → 서버단 필터링으로 수정
2. 전체 11개 테이블 RLS 비활성화 상태였음 (Supabase 기본값) →
   server/src/lib/supabase.ts를 SUPABASE_SERVICE_ROLE_KEY로 전환 후
   11개 테이블 전부 RLS 활성화(정책 0개, 완전 차단) → anon 키 직접 호출 테스트로
   실제 차단 확인(companies 테이블 186행 존재하는데도 [] 반환 확인)
3. client/.env.local에 서버와 별개로 ANTHROPIC_API_KEY 사본이 존재,
   이를 쓰는 /api/chat 라우트가 인증/레이트리밋 없이 노출되어 있었음
   (UI에서는 제거됐지만 라우트는 살아있던 케이스) → 라우트 제거 +
   client의 중복 키 제거로 정리
4. next.config.ts에 보안 헤더 전무 → CSP(prod 한정)/X-Frame-Options/
   X-Content-Type-Options/HSTS/Referrer-Policy/Permissions-Policy 추가
5. (2026-07-04, 긴급) 위 4번 CSP의 `script-src 'self'`가 Next.js App Router의
   hydration용 inline script를 차단해 프로덕션 화면이 완전히 안 뜨는 장애 발생
   ("Executing inline script violates CSP" 콘솔 에러 다수 + 부작용으로 "Connection
   closed" 에러) → `script-src`에 `'unsafe-inline'` 추가해 즉시 복구.
   **이건 임시 완화 조치** — script-src에 unsafe-inline이 남아있는 한 XSS 방어
   효과가 사실상 없음. 추후 middleware.ts에서 요청마다 nonce를 생성해 CSP
   헤더와 실제 script 태그에 동일 nonce를 적용하는 방식으로 전환 필요.
   교훈: CSP처럼 프레임워크 내부 동작과 상호작용하는 헤더는 로컬 dev 서버
   테스트만으로 안전을 확신할 수 없음 — 프로덕션 빌드(`next build && next start`
   또는 실제 배포)로 반드시 재검증할 것.
6. (2026-07-03) Quality Gate Rule 2가 전 섹션 공용 필드 체인
   (`oneLiner ?? narrative ?? industry_name ?? tech_name ?? value_flow ??
   growth_motion_detail ?? strategy_coherence`)으로 섹션 유효성을 판정해서,
   business_model_v2처럼 체인 앞쪽 필드가 스키마에 아예 없는 섹션은
   growth_motion_detail 하나만 비어도 revenue_streams/segments/moat 등 실제로
   채워진 데이터까지 통째로 폐기됨 (DB 실측 폐기율 22%, 형제 섹션 대비 최대 2배)
   → Supabase에서 Astera Labs 레코드를 직접 조회해 DEFAULT_ANALYSIS_DATA와 완전히
   동일함을 확인하며 발견. 같은 원인으로 Rule 1(-999 감지)도 필드 하나 때문에
   섹션 전체를 폐기하고 있었음 → 두 룰 모두 "섹션 전체 폐기"에서 "필드 단위 폐기"로
   변경(`SECTION_CONTENT_SIGNALS`로 스키마별 실제 존재하는 필드만 명시, 배열은
   length>0 체크를 우선 신호로 사용). 근본 원인은 한 겹 더 있었음:
   business_model_v2의 숫자 필드(operating_margin 등)에 확인 불가 시 어떻게
   쓸지 프롬프트 지시가 없어 Claude가 -999를 쓰거나 심지어
   `"operating_margin": 확인필요` 같은 유효하지 않은 JSON을 내놓아 파싱 자체가
   실패하는 경우도 있었음 → 스키마 프롬프트에 "확인 불가 숫자 필드는 0 반환"을
   명시(프론트가 이미 0을 "데이터 없음"으로 처리하는 기존 컨벤션과 일치)해 해결.
   교훈: 여러 스키마에 공용으로 쓰는 판정 로직(canary 필드 체인 등)은 스키마 추가
   시마다 그 필드가 실제로 존재하는지 검증할 것 — 존재하지 않는 필드로 조용히
   넘어가는 `??` 체인은 디버깅 없이는 알아차릴 수 없음. 배열 기반 필드가 있는
   섹션은 텍스트 canary 하나보다 배열 length 체크를 우선 신호로 쓸 것.
7. (2026-07-03) 위 5번의 "긴급" script-src 완화(unsafe-inline)를 배포한 뒤에도
   프로덕션에서 CSP 에러가 계속 발생한다는 신고 → 5번 fix는 hydration 블랭크
   페이지만 해결했을 뿐, 그 뒤에 실행되는 코드가 걸리는 CSP 위반은 애초에
   확인된 적이 없었음(블랭크 페이지 상태에선 그 뒤 코드가 실행조차 안 되니
   콘솔에 안 잡혔던 것). 코드 검토로 확인된 것:
   - **script-src / WebAssembly**: PDF 내보내기(`@react-pdf/renderer` →
     `@react-pdf/layout` → `yoga-layout`)가 브라우저에서 flexbox 엔진을
     `WebAssembly.instantiate`로 로드하는데 CSP에 wasm 관련 허용이 전혀
     없었음 → `script-src`에 `'wasm-unsafe-eval'` 추가로 해결 (`'unsafe-eval'`
     전체가 아니라 wasm 컴파일만 허용하는 좁은 값 사용).
   - **connect-src**: `` `connect-src 'self' ${apiUrl}` `` 에서 `apiUrl`은
     `NEXT_PUBLIC_API_URL` — Next.js 빌드 타임에 번들에 박히는 값이라, Render
     클라이언트 서비스의 **빌드 환경변수**로 설정 안 돼 있으면 조용히 빈 문자열이
     되어 `connect-src 'self'`만 남고 API 서버(다른 오리진) 호출이 전부 CSP로
     막힘 — 5번과 동일한 "조용히 프로덕션에서만 터지는" 패턴. 런타임에서 에러
     던지는 걸로는 이미 늦으므로(배포가 끝난 뒤에야 드러남) `next.config.ts`
     자체에서 `NODE_ENV=production`인데 `apiUrl`이 비어있으면 빌드를 실패시키는
     가드를 추가 — Render 대시보드에서 빌드타임 env var 누락을 즉시 드러내도록.
   - **img-src**: 코드상 외부 이미지 소스는 `finviz.com`·`fchart.stock.naver.com`
     둘뿐이고 둘 다 이미 허용 목록에 있음 — 코드 레벨 원인을 못 찾음. 배포가
     실제로 최신 커밋을 반영했는지 자체가 불확실했던 상태라(이 대화 시작 시점에
     배포 완료 여부를 확인할 방법이 없었음), 스테일 배포일 가능성이 더 유력함.
   교훈: CSP 위반은 "고쳤다"고 끝이 아니라, 그 CSP를 통과해야 도달하는 코드
   경로(PDF 내보내기처럼 자주 안 쓰는 기능 포함)를 전부 실행해봐야 다음 위반이
   드러남 — 프로덕션 빌드로 첫 화면만 띄워보는 걸로는 불충분. 빌드타임에만
   존재하는 env var(`NEXT_PUBLIC_*`)가 배포 플랫폼에 실제로 설정됐는지는
   런타임 체크가 아니라 **빌드 자체를 실패시키는 가드**로 확인할 것.

### 새 프로젝트/기능 착수 시 체크리스트
- [ ] 신규 테이블 생성 시 RLS 활성화 여부 확인
- [ ] 신규 API 라우트에 인증/레이트리밋 여부 확인 (특히 유료 외부 API 호출 라우트)
- [ ] 프리미엄/과금 데이터는 서버 응답 조립 단계에서 필터링되는지 확인
- [ ] 기능 제거 시 UI뿐 아니라 API 라우트도 실제로 비활성화했는지 확인
- [ ] 시크릿 키가 여러 위치에 중복 저장되어 있지 않은지 확인

## Data Aggregation Principles (SSOT)

### 원칙: 소규모 표본/극단치 방어는 모든 통계 집계 로직에 기본 적용
표본 집단에 극소값(분모가 작은 경우 특히)이 섞이면 평균/표준편차가
비상식적으로 왜곡된다. (실전 사례: SAAS 섹터 벤치마크에서 페니스톡 기업의
$450→$504,000 매출 변화가 "+111,900% 성장"으로 잡혀 313개사 평균 전체를 오염시킴)

방어 순서:
1. 분모(비교 기준값)가 의미 있는 최소 규모 이상인지 먼저 필터링
   (이번 케이스: 전년 매출 $1M 미만 제외)
2. 필터링 후에도 남는 값은 윈저라이징(상하위 클리핑)으로
   극단치 영향 제한 (이번 케이스: [-90%, +300%] 클리핑)
3. 최소 표본 수 미달 시(이번 케이스: 5개 미만) null 반환,
   억지로 계산해서 신뢰도 낮은 값을 내보내지 않기
4. 결과값에 대한 상식성 체크를 코드에 내장
   (예: P10≤P50≤P90, 값이 음수가 아닌지 등) — 사람이 매번 눈으로
   검증하지 않아도 되게

앞으로 새로운 통계 집계 기능(평균/표준편차/분포 계산) 추가 시
이 네 단계를 기본으로 적용.

## 코드 작성 원칙 (ponytail 7단계)
새 코드를 짜기 전에 반드시 이 순서로 검토:
1. 이거 굳이 만들어야 하나? (안 만드는 게 최선)
2. 코드베이스에 이미 있나? → 재사용
3. 표준 라이브러리가 해주나? → 사용
4. 언어/플랫폼 기본 기능인가? → 사용
5. 이미 깔린 라이브러리로 되나? → 사용
6. 한 줄로 되나? → 한 줄로
7. 그제서야: 동작하는 최소한의 코드

절대 게으르면 안 되는 것 (코드 줄여도 이건 절대 생략 금지):
- 입력값 검증 (CIK 없는 기업, 빈 응답 등)
- 데이터 손실 막는 에러 처리 (실패 시 null 저장, 프로세스 중단 금지)
- API rate limit 초과 시 재시도 로직
- 환경변수 누락 시 명시적 에러

## Quality Gate 원칙
Claude API 응답에서 아래 이상값 감지 시 해당 섹션만 "—" 처리, 전체 중단 금지:
- 숫자 필드에 -999, -999% 등 placeholder 값
- 빈 문자열 또는 null이어야 할 자리에 "확인 필요" 텍스트
- 재무 수치가 전년 대비 10배 이상 변동 시 (추정) 뱃지 필수

위 이상값은 반드시 **해당 필드 단위**로 처리 — 필드 하나가 이상값이라고 같은 섹션의
나머지 정상 필드(배열 등)까지 폐기 금지. 섹션 전체 폐기는 모든 신호(대표 텍스트
필드 + 배열 필드)가 동시에 비어있을 때만 (2026-07-03 business_model_v2 22% 폐기
버그, 실전 발견 이력 6번 참고 — `server/src/lib/claude.ts`의
`SECTION_CONTENT_SIGNALS`).

골든셋 검증 기준 (분석 완료 후 체크):
- summary에 기업명이 포함되어 있는가?
- financials에 최소 1개 이상의 실제 수치가 있는가?
- sources 배열이 비어있지 않은가?
- 모든 섹션이 "—" 또는 null이 아닌가? (전체 실패 감지)
---

## 버전 히스토리

| 버전 | 내용 |
|---|---|
| v1.0.0 | 초기 출시 — 순차 배치, 24시간 캐시, 기본 분석 |
| v2.0.0 | 2026-06-29 — EDGAR/DART 배치 적재(9,583개), 배치 병렬화(75s→35s), founder 독립 batch5, financial_cache 우선순위 + 출처 뱃지, TTL 무기한, Quality Gate, Prompt Caching, 로딩 애니메이션, 탭 상태 아이콘, nudge 배너, 탭별 재분석 버튼, Render Cron Job 매월 1일 자동화 |
| v2.0.1 | 2026-07-03 — 섹터 매핑(sector_mapping, KSIC/SIC→12개 태그), financial_cache/라이브 조회 4개년 시계열, 몬테카를로 성장 시나리오 엔진, 배치 1차(요약+재무)/2차(백그라운드)/3차(몬테카를로) 스플릿, 무료 분석 횟수 제한(rolling 7일 2회, 임시 식별자), 성장 시나리오 탭 프리미엄 게이팅 |
| v2.1.0 | 구글 로그인(완료, 2026-07-03) + 온보딩 설문(미착수) |
| v2.2.0 | 영문화 (언어 토글 EN/KR) |
| v3.0.0 | 유료 플랜 출시 (Stripe) |
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

### 분석 배치 구조
- 1배치 (병렬 1개): summary_v2 → 완료 시 요약 탭 즉시 표시
- 2배치 (병렬 3개): industry_history_v2, business_model_v2, competitors_v2
- 3배치 (병렬 3개): tech_evolution_v2, value_chain_v2, strategy_v2
- 4배치 (병렬 3개): financials_v2, founder_v2, sources
- 각 배치 완료 시 즉시 Supabase DB 저장 + 프론트엔드 반영
- 배치 타임아웃: 75초
- 배치 실패 시 해당 섹션만 "—" 표시, 나머지 계속 진행
- 상단 진행바: "배치 N/4 완료" 표시

### 보안
- RLS 적용 필수 (현재 UNRESTRICTED — 로그인 구현 후 적용)
- 환경변수: .env에만 관리, 코드 하드코딩 금지
- 필수 API 키: ANTHROPIC_API_KEY, DART_API_KEY, FMP_API_KEY, KIS_APP_KEY, KIS_APP_SECRET

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
- [ ] 구글 로그인 + 온보딩 설문 (직무/지역/목적/회사규모)

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

# Latticework — CLAUDE.md

## Handoff

> **세션 시작 규칙**: 새 세션을 시작하는 Claude Code는 작업을 시작하기 전에 이 섹션을
> 먼저 읽고, "지난 세션에서 [마지막 진행 상황]까지 진행됐고, 다음은 [다음 우선순위]입니다"
> 형식으로 한 줄 요약한 뒤 작업에 들어갈 것. 이 섹션은 `/done` 커맨드
> (`.claude/commands/done.md`) 실행 시마다 통째로 덮어쓰기(overwrite)된다 — 이전 세션
> 내용이 누적되지 않고 항상 최신 상태 하나만 유지되므로, 과거 세션 기록이 필요하면
> git log/커밋 메시지를 참고할 것.

**마지막 업데이트**: 2026-07-26

### 오늘 변경/작업한 파일과 기능
- `client/src/app/components/AnalysisCard.tsx`, `server/src/lib/claude.ts` —
  Rocket Lab 분석에서 요약 탭 "성장 모멘텀"/"핵심 리스크" 카드와 비즈니스모델
  탭 "Growth Motion" 카드가 빈 박스로 렌더링되던 버그 수정. 원인은 사용자가
  처음 짐작한 `financials_v2.outlook.keyRisks` vs `key_risks` 케이스(camelCase/
  snake_case) 불일치가 **아니었음** — 실제로는 `summary_v2.bull_case`/`bear_case`,
  `business_model_v2.growth_motion_detail`이 빈 문자열일 때 조건부 렌더링
  가드가 없어 빈 박스가 그대로 그려지던 것. 값 있을 때만 카드 렌더링하도록
  수정 + Quality Gate 룰 승격 대신 이 세 필드가 비었을 때 빈도 관찰용
  `console.warn` 로그만 추가(SECTION_CONTENT_SIGNALS는 건드리지 않음 — 승격 시
  business_model_v2 22% 폐기율 버그 재현 위험, 실전 발견 이력 6번 참고).
- `client/src/app/components/AnalysisCard.tsx` — 리포트 마크다운 복사 기능 신규.
  9개 V2 섹션(요약/산업역사/기술변화/밸류체인/비즈니스모델/경쟁사/전략/재무/
  창업자) + 성장시나리오 각각을 마크다운으로 변환하는 공용 함수 추가, 빈 필드는
  출력에서 제외(빈 헤딩 안 남김). 처음엔 각 탭 콘텐츠 상단에 개별 복사 버튼을
  뒀다가, 후속 지시로 **리포트 헤더로 이동** — 지금은 헤더에 "전체 복사"(전
  섹션 이어붙임) + "이 탭 복사"(현재 활성 탭만, 같은 변환 함수 재사용) 두
  버튼만 있고 탭 콘텐츠 안엔 없음. 재무 탭 "이 탭 복사"는 새로고침 상태
  (`financialsV2Local`)를 반영해 화면에 보이는 값과 항상 일치.
- 세션 중 추가 조사(수정은 안 함, 보고만): `financials_v2.outlook`(shortTerm/
  midLongTerm/keyRisks)이 PDF 내보내기(`AnalysisPdf.tsx`)에만 렌더링되고 웹
  탭에는 전혀 없음(PDF는 관리자 전용이라 실질적으로 아무도 안 보는 데이터를
  매 분석마다 생성 중) / `SectionSource` 타입에 `date`·`isEstimate` 필드가
  없어서 8개 탭 전부 출처 목록에 날짜·"(추정)" 뱃지가 거의 안 뜨는 구조적
  이슈 발견(백엔드가 애초에 섹션 임베디드 sources에 이 필드들을 생성하도록
  프롬프트 지시가 없음) — 둘 다 아래 "발견했지만 처리 안 한 이슈" 참고.
- 이전 세션(2026-07-16)에 로컬에만 있던 보안 수정 커밋 7개를 발견 —
  origin에 한 번도 push 안 된 상태였음(10일간 프로덕션 미반영). 전부 push
  완료, 오늘 작업분은 hunk 단위로 2개 커밋으로 분리 후 push 완료.

### Git 커밋 상태
- 커밋 완료 — `caee208` fix: 요약/비즈니스모델 탭 빈 필드 조건부 렌더링 + quality-gate 로깅
- 커밋 완료 — `95eb8b2` feat: 리포트 마크다운 복사 기능
- 위 2개 + 이전 세션 미푸시 7개(`ef689f5`~`aff2bba`) 전부 origin/main에 push 완료,
  현재 origin과 완전 동기화(0 ahead / 0 behind)
- `CLAUDE.md`(이 Handoff 섹션 포함)는 아직 커밋 안 됨 — `/done`은 커밋을 실행하지
  않으므로 이번 갱신분은 사용자가 명시적으로 지시해야 커밋됨

### 완료된 작업
- [x] Rocket Lab 요약/비즈니스모델 탭 빈 필드 렌더링 버그 원인 규명 + 수정
- [x] 리포트 마크다운 복사 기능 (섹션별 변환 함수 + 전체복사/탭복사 버튼)
- [x] 이전 세션 미푸시 보안 수정 커밋 7개 + 오늘 작업 커밋 2개, 전부 push

### 남은 작업
- [ ] STEP 2 — 게이팅 해제: 성장 시나리오(프리미엄 전용) + PDF(관리자 전용)를
  베타 기간 동안 모든 로그인 유저에게 개방. 요구사항: 게이팅 코드 삭제 금지,
  각각 상수/플래그 하나로 껐다 켤 수 있게 구현, 무료 횟수 제한(7일 2회)은
  그대로 유지, 플래그 위치(파일+줄번호) 보고, 관리자 아닌 계정 기준 검증까지
  → 사용자가 아직 "진행" 지시를 안 내림, 다음 세션 시작하자마자 이어서 진행
- [ ] STEP 3 — 웹/PDF 패리티 감사 + 성장 시나리오 PDF 추가 (사용자가 명시적으로
  "별도 세션에서 다룬다"고 지정 — 이번 세션 범위 아님)

### 발견했지만 처리 안 한 이슈
- Rocket Lab 분석에서 산업역사/기술변화 탭이 "생성 중..." 스피너에서 무한정
  멈춰있던 증상 — 세션 초반에 조사를 시작했으나(온디맨드 생성 트리거 로직
  `maybeAutoGenerate`/`isReanalyzing`까지는 확인) 사용자가 곧바로 다른(더
  구체적인) 버그로 작업 범위를 좁혀서 근본 원인까지 못 감. 원인 미규명 상태.
- `financials_v2.outlook`(shortTerm/midLongTerm/keyRisks) 생성은 되는데 PDF
  (관리자 전용)에서만 쓰이고 웹 탭엔 렌더링이 없음 — 웹에 카드 추가할지,
  생성 자체를 없앨지 제품 판단 필요.
- `SectionSource` 타입에 `date`/`isEstimate`가 없어서(백엔드가 8개 섹션
  스키마 어디에도 이 필드를 생성하도록 지시한 적이 없음) 웹 탭 출처 목록에
  날짜와 "(추정)" 뱃지가 거의 항상 안 뜸 — 8개 탭 전부 영향, 수정 범위는
  스키마 프롬프트 추가 또는 프론트 sources 우선순위(`??`) 반전 중 택1.

### 다음 세션 우선순위 (1개)
- STEP 2(게이팅 해제) 진행 — 성장 시나리오 + PDF를 로그인 유저 전원에게
  개방하되 상수 하나로 되돌릴 수 있는 구조로. 사용자의 "진행" 지시를 세션
  시작 직후 받을 가능성 높음(직전 세션 마지막 메시지가 이 확인 대기였음).

## Vision & Mission

### Vision
AI 시대, 살아남는 사람은 정보를 빠르게 구조화하는 사람이다.
기업 분석, 재무 분석, 밸류체인, 산업과 기술의 역사 — 지금까지는 며칠이 걸렸다.
1min은 그 리서치를 단 1분으로 줄인다. 핵심만.

### Mission
더 정확한 정보가 더 나은 결정을 만든다.
1min은 누구에게나 그 정보를 1분 안에 전달한다.
More right info, better decisions. In just 1 minute, for everyone.

- 포지셔닝: 1분 기업분석
- 핵심 워크플로우: 기업 리서치(Latticework) + 재무데이터(DART/EDGAR) + Claude HTML 리포트 생성
- 아웃풋: 이메일 전송 또는 PDF 다운로드

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

**Supabase 프로젝트 ID (prod)**: `rtpcmbxijcxhzvortwxf`
**Supabase 프로젝트 ID (dev)**: `ininmbvzzdqplnfdnisf` (2026-07 생성)

✅ **2026-07-10부터 MCP가 prod/dev 둘 다 정상 연결됨** — 두 프로젝트 모두 "Van-growth"
조직(`hcreensppxfymzapzmnb`) 아래 있고, `apply_migration`/`list_migrations` 전부 정상 동작
확인함. 아래는 그 전까지 겪었던 문제와 최종 조치 기록(재발 방지용, dev가 다시 다른 조직으로
분리되는 일이 생기면 참고할 것):
- dev는 처음에 별도 조직("1min-dev")에 생성돼서 MCP(Claude Code 플러그인, OAuth 기반이라
  조직 하나만 스코프로 잡힘)가 못 봤음 → dev 프로젝트를 Van-growth 조직으로 **Transfer**해서 해결.
  (시도했던 대안 — 계정을 상대 조직에 멤버 초대만 하는 방법은 재인증 시 조직을 하나만 골라야 해서
  근본적으로 안 됨 — 프로젝트를 한 조직으로 합치는 게 유일한 정공법이었음)
- MCP 연결 전까지는 dev 마이그레이션 적용을 Session Pooler(`aws-1-ap-northeast-2.pooler.
  supabase.com:5432`, direct connection은 이 환경에서 IPv6 전용이라 안 됨) + `pg` 패키지 direct
  접속으로 우회했음 — `supabase_migrations.schema_migrations` 테이블도 대시보드로 만든 새
  프로젝트엔 기본 생성이 안 돼있어서 직접 만들어야 했음
- ⚠️ **direct 접속으로 새 테이블을 만들면 두 가지가 자동으로 안 붙음** — Supabase가 대시보드/CLI/MCP
  `apply_migration`으로 마이그레이션을 적용할 때 내부적으로 처리해주는 것들인데, `postgres` role로
  직접 `CREATE TABLE`하면 빠짐:
  1. `service_role`/`anon`/`authenticated` 테이블 권한 — 없으면 서버가 `SUPABASE_SERVICE_ROLE_KEY`로
     접속해도 `permission denied for table ...` 에러가 남 (2026-07 dev 이관 후 라이브 서버 테스트에서
     발견 — 원인 파악까지 데이터/RLS 문제로 오인하기 쉬우니 주의). 조치:
     ```sql
     GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
     GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
     GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
     GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
     ```
     (`supabase/migrations/20260710_public_schema_grants.sql`로 정식 기록됨 — RLS가 전 테이블에
     활성화(정책 0개)돼있어서 anon/authenticated에 테이블 권한을 줘도 row 단위로는 여전히 완전
     차단, prod와 동일한 보안 구조라 안전함)
  2. `supabase_migrations.schema_migrations.idempotency_key`의 **UNIQUE 제약** — 이게 없으면
     MCP `apply_migration`이 `there is no unique or exclusion constraint matching the ON
     CONFLICT specification` 에러로 실패함(직접 겪음). direct 접속으로 이 테이블을 만들 때
     `CREATE TABLE ... (version text PRIMARY KEY, statements text[], name text, created_by text,
     idempotency_key text, rollback text[])`만으로는 부족 — 반드시
     `ALTER TABLE supabase_migrations.schema_migrations ADD CONSTRAINT
     schema_migrations_idempotency_key_key UNIQUE (idempotency_key);`까지 같이 실행할 것.

### 규칙: 새 마이그레이션 파일 작성 시 반드시 MCP로 즉시 적용 — **prod + dev 둘 다**

`supabase/migrations/*.sql` 파일을 Write 할 때마다 **반드시** 같은 응답 안에서
`mcp__plugin_supabase_supabase__apply_migration`을 **두 프로젝트 각각에** 호출하여 적용해야 함.
하나만 적용하고 잊으면 dev/prod 스키마가 갈라져(schema drift) 이후 마이그레이션이 dev에서만
성공하거나 prod에서만 실패하는 사고로 이어짐 — 별도 프로젝트로 분리한 대가로 생긴 프로세스
부담이니 절대 생략하지 말 것.

```
# 1) prod
apply_migration(
  project_id = "rtpcmbxijcxhzvortwxf",
  name       = "<파일명에서 .sql 제거>",
  query      = "<파일 전체 SQL>"
)

# 2) dev — project_id만 다르고 나머지 동일
apply_migration(
  project_id = "ininmbvzzdqplnfdnisf",
  name       = "<파일명에서 .sql 제거>",
  query      = "<파일 전체 SQL>"
)
```

**새 마이그레이션 작성 시 체크리스트** (SQL Editor 직접 실행 금지 등 일반 원칙은 전역 `~/.claude/CLAUDE.md` 참고)
- [ ] SQL이 `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` 등으로 멱등성 보장하는지 확인
- [ ] prod(`rtpcmbxijcxhzvortwxf`)에 `apply_migration` 적용
- [ ] dev(`ininmbvzzdqplnfdnisf`)에 적용 — **빠뜨리기 가장 쉬운 단계, 반드시 확인**
- [ ] 두 프로젝트 모두 `list_migrations(project_id=...)`로 적용 확인
- [ ] RLS가 필요한 신규 테이블이면 두 프로젝트 모두에서 RLS 활성화 여부 확인 (Security Principles 원칙 2 참고 — 신규 테이블은 기본적으로 RLS 꺼진 상태로 생성됨)

(참고: 2026-07 dev 마이그레이션 이관 중 로컬 `.sql` 파일이 없는 `20260703_sector_benchmark_cache_rls`가
prod에 적용돼 있던 걸 발견 — SQL Editor 직접 실행 금지 규칙이 이 사고를 계기로 전역 원칙으로 승격됨)

- PostToolUse hook(`scripts/migration-hook.mjs`)이 파일 감지 후 적용 정보를 출력함 — dev 프로젝트 ID도 반영됨(`ininmbvzzdqplnfdnisf`)

## Dev
```bash
# Server (port 4000)
cd server && npm install && npm run dev

# Client (port 3000)
cd client && npm install && npm run dev
```

- 서버 기동 로그에 찍히는 `APP_ENV`(`server/src/lib/env.ts`, 클라이언트는
  `NEXT_PUBLIC_APP_ENV`/`client/src/lib/env.ts`)는 배포 환경 구분용 자체 플래그 —
  `next build`가 `NODE_ENV`를 배포 환경과 무관하게 항상 `production`으로 고정시켜서
  별도로 필요했음(2026-07-09). dev 배포는 `render.dev.yaml`(Render Blueprint) 사용.

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

**analyses**(추가 컬럼, 2026-07-16): `created_by`(uuid, NULL 허용, FK→auth.users) — 이
마이그레이션 이전 생성된 기존 행은 전부 NULL(생성자 미기록). `POST /api/analyses/:id/share`,
`DELETE /api/analyses/:id/share`의 소유권(403) 체크 전용 컬럼 — `reanalyze`/
`refresh-financials`는 이 컬럼을 참조하지 않음(아래 실전 발견 이력 16번 참고, analyses는
여전히 전 유저 공용 캐시이고 이 컬럼은 "생성자"만 기록할 뿐 "유일한 열람/수정 권한자"를
뜻하지 않음).

**corp_master**(추가 컬럼): `ksic_code`, `sector_tag` — DART 상장기업(3,971개) 전수 적재 완료

**cik_master**(추가 컬럼): `sic_code`, `sic_description`, `sector_tag` — EDGAR 전체(8,021개) 적재 중

**company_listings** (2026-07-16, v2.1.0): `id`, `company_id`(FK→companies), `source`
('EDGAR'|'DART'), `identifier`(EDGAR: cik, DART: corp_code), `ticker`, `exchange`(대부분
null — corp_master/cik_master 둘 다 거래소 정보가 없음), `created_at`. UNIQUE(source,
identifier). **지연 생성(lazy)** — corp_master/cik_master 전체를 일괄 적재하지 않고,
유저가 typeahead에서 실제로 클릭한 회사만 `POST /api/companies/resolve`가 그 순간
upsert. 다중상장 회사(EDGAR+DART 둘 다 있는 회사)는 이 테이블에 같은 company_id로
2행이 생긴다.

**company_dual_listings_manual** (2026-07-16, v2.1.0): `dart_corp_code`(PK),
`edgar_cik`(UNIQUE), `note`. 다중상장 회사 수동 큐레이션 매핑 — DART(한글)와
EDGAR(영문) 회사명은 자동 이름매칭이 불가능해서 손으로 관리한다. typeahead 검색
결과 병합 + resolve 시 참조. 현재 7행(KB금융/한국전력공사/LG디스플레이/신한지주/
SK텔레콤/우리금융지주/SK하이닉스 — 상세는 아래 실전 발견 이력 참고).

**sector_mapping**: `id`, `source`('DART'|'EDGAR'), `original_code`(KSIC division/SIC major group·상세코드),
`original_name`, `sector_tag`(12개 공통 태그: SAAS/MANUFACTURING/BIOTECH_HEALTHCARE/RETAIL_COMMERCE/
FINANCE/MEDIA_CONTENT/HARDWARE_SEMICONDUCTOR/ENERGY/LOGISTICS_TRANSPORT/CONSUMER_GOODS/
REAL_ESTATE_CONSTRUCTION/OTHER)

**analysis_usage**: `id`, `user_id`(로그인 시 auth.users.id, 비로그인 시 클라이언트 임시 식별자),
`analysis_target`, `created_at`, `is_cache_view`(BOOLEAN, 기본 false — 2026-07-16 추가) —
무료 분석 횟수 제한(rolling 7일 2회) 추적 + `GET /api/analyses`(내 히스토리) 소스, 두 역할
겸용. `checkAnalysisUsage`는 `is_cache_view=false`인 행만 카운트 — 캐시 조회는 히스토리엔
남지만 무료 횟수는 안 깎음

**profiles** (2026-07-03, 구글 로그인 도입): `id`(PK, auth.users(id) 참조), `email`,
`is_premium_override`(BOOLEAN, 기본 false — Stripe 연동 전 로그인 유저 개별 프리미엄 우회용),
`created_at`. auth.users에 신규 행(최초 구글 로그인) 생성 시 트리거로 자동 1행 생성.
**온보딩 설문 컬럼**(2026-07-10 추가, `region`만 2026-07-16 추가): `company_name`,
`org_size`(1-10/11-50/51-200/201-500/501-1000/1000+), `industry`(sector_mapping과 동일
12개 sector_tag 소문자), `job_role`(sales/bd/strategy/other), `job_level`(junior/mid/
senior/team_lead/executive), `purpose`(ARRAY, meeting_prep/partner_research/
competitor_analysis/other), `purpose_other`, `region`(kr/us/other),
`onboarding_completed_at`(NULL이면 미완료 — `OnboardingModal`이 로그인 직후 이 값이
비어있으면 강제 노출, 스킵해도 채워짐).

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
재무수치:    DART > EDGAR > FMP > StockAnalysis > 웹검색
시세/밸류:   TradingView > KIS > 웹검색
텍스트분석:  Claude 웹검색 기반 (L2/L3)
창업자정보:  LinkedIn > Crunchbase > TheVC > 언론
트리거이벤트: EDGAR 8-K > DART 유상증자공시 > 웹검색
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

### 5. 다중상장 회사 재무 우선순위 (v2.1.0)
- company_listings에 EDGAR + DART 둘 다 있으면 재무 데이터는 EDGAR 우선 사용
  (미국 타겟 GTM 기준 — 한미 병기/자동전환은 하지 않음, 추후 백로그)
- EDGAR 없으면 DART, 둘 다 없으면 웹추정 (기존 우선순위 원칙과 동일 폴백 체인 재사용)
- 구현: `fetchFinancialContext(companyName, listings?)`(`server/src/lib/financialContext.ts`)가
  `listings`에 EDGAR+DART가 모두 있을 때만 이름 기반 한글 휴리스틱(`isKoreanCompany`)을
  건너뛰고 알려진 identifier(cik/corp_code)로 직접 조회 — `fetchEdgarDataByCik`/
  `fetchDartDataByCorpCode`(각각 `edgar.ts`/`dart.ts`, lookup 단계만 건너뛰는 순수
  extract-function이라 기존 이름 기반 경로는 회귀 없음). `analyze.ts`가 요청의
  `companyId` → `company_listings` 조회 → 이 함수로 전달.
- 실측(2026-07-16, SK텔레콤): EDGAR 우선 시도 → CIK 정상 조회됐지만 XBRL
  `us-gaap` concept가 전부 비어있어(외국 민간 발행인이 IFRS 태그로 20-F 제출,
  us-gaap 태깅 자체가 없는 경우가 흔함) rev/opInc/netInc 모두 null → 자동으로 DART
  폴백 → 정상적으로 한글 재무 수치 반환. "EDGAR에 CIK가 있다"와 "EDGAR에 쓸 수 있는
  재무 데이터가 있다"는 다르다는 걸 실측으로 확인 — 폴백 체인이 정확히 이 케이스를
  위해 필요함.

### 6. 출처 표시 규칙 (전 탭 공통 — 가장 중요)
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

### 핵심 타겟 유저 (주 타겟 — 제품/GTM 방향 결정 기준)
- AE(Account Executive): 제안/디스커버리 미팅 전 고객사 심층 파악 (사업모델·재무상태·전략 이해 → 미팅에서 신뢰도 있는 대화)
- BD 담당자: 파트너/협력사 리서치
- 전략 담당자: 경쟁사 분석 / 밸류체인 / M&A 대상 탐색

공통 use case: 미팅/협상/의사결정 전 빠르게 기업 파악
타겟 시장: 미국 우선 (세일즈 담당자만 미국 ~1,500만 명)

#### 부가 유저층 (참고용 — 타겟팅 우선순위 변경 아님)
- 취준생: 면접 전날 지원 기업 파악
- 투자자: 종목 기초 리서치

주의: 위 부가 유저층 때문에 콘텐츠 원칙(투자자 전용 언어 금지,
밸류에이션/수익률/PER 단독 언급 금지)을 완화하지 않음.
제품 설계/기능 우선순위는 세일즈·BD·전략 담당자 기준으로 계속 결정.

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
  로그인은 선택 사항, 비로그인도 계속 체험 가능. 온보딩 설문(회사명/지역/조직규모/
  산업/직무/직급/목적)은 2026-07-10 완료, `region` 추가는 2026-07-16 — 아래 ✅ 참고.
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

### 검색-캐시 조회 흐름 (v2.1.0)
- 검색창은 자유 텍스트 아님 — companies/company_listings 기반 typeahead
  (`GET /api/companies/typeahead`, corp_master/cik_master를 그때그때 직접 조회)
- 유저가 리스트에서 엔티티 클릭 = disambiguation 완료 (별도 "이 회사 맞나요?" 확인 절대 없음)
- 클릭 즉시 `POST /api/companies/resolve`가 company_id로 analyses 조회 → 조건부 렌더링
  - 캐시 있음: "최근 분석 n일 전" + 바로보기/재분석하기 버튼만 노출
  - 캐시 없음: 새 분석 시작 CTA만 노출
- 절대 금지: 프론트엔드 토글/탭으로 "캐시 있음/없음" 두 상태를 유저가 선택하게 하는 UI
  (이건 순수 서버사이드 조건 분기이며 유저는 하나의 결과 화면만 봄 — `HomeContent.tsx`의
  `resolveResult.cached` 하나로만 분기)
- 기존 24시간 캐시/무기한 TTL 정책 그대로 재사용, 실제 분석 로드도 기존
  `GET /api/analyses/:id` 그대로 재사용 — 새 캐시 정책 안 만듦
- `GET /api/companies/autocomplete`(이미 분석 이력 있는 기업만 보여주던 중복 방지용
  typeahead)는 이 흐름으로 완전히 대체되어 제거됨

### 회사-상장 데이터 모델 (v2.1.0)
- 배경: SK하이닉스가 2026-07-10 나스닥에 ADR(SKHY) 상장하며 DART(원주)+EDGAR(ADR)
  동시 상장 케이스 발생 — "회사 1개 = 데이터소스 1개" 전제가 깨짐
- companies(회사 1행, 기존 그대로) / company_listings(상장 N행, source별 신규) 구조로
  분리 — DB schema 섹션 참고
- **지연 생성(lazy)**: corp_master/cik_master 전체를 일괄 적재하지 않음 — 유저가
  typeahead에서 실제로 클릭한 회사만 그 순간 companies/company_listings에 upsert.
  companies가 12만 행으로 급증하지 않고, corp_master/cik_master 배치 리싱크마다
  company_listings를 별도로 재동기화해줄 필요도 없음
- 다중상장 병합은 수동 큐레이션 테이블 `company_dual_listings_manual`로 처리(자동
  한글↔영문 이름매칭은 안 함 — 하지 않는 게 최선인 문제)
- 캐시 조회는 company_id 단위로 통합 (분석은 회사당 1세트)
- typeahead 다중상장 회사는 국기 병기 표시(EDGAR→🇺🇸, DART→🇰🇷 + ticker)
- 재무 우선순위: EDGAR > DART > 웹추정 (미국 타겟 GTM 기준, 한미 병기는 하지 않음 —
  상세는 Data SSOT 기준 > 5번 참고)

### 분석 배치 구조 (1차/2차/3차)
- **1차** (목표 60초 이내, 완료 즉시 요약/재무 탭 렌더링):
  - 1배치 (병렬 1개): summary_v2
  - fin_preview: EDGAR/DART 캐시·라이브 raw 데이터로 재무 탭 즉시 프리뷰 (batch4 Claude 응답 이전)
- **2차** (1차 이후 백그라운드로 계속 처리, 기존 Promise.all 그대로):
  - 2배치 (병렬 2개): business_model_v2, competitors_v2
  - 3배치 (병렬 2개): value_chain_v2, strategy_v2
  - 4배치 (병렬 2개): financials_v2, sources
  - 5배치: founder_v2
- **온디맨드** (2026-07~, 초기 배치에서 제외): industry_history_v2(산업역사), tech_evolution_v2(기술변화) —
  해당 탭을 처음 열 때만 `/api/analyze/reanalyze`(기존 "탭별 재분석" 경로 재사용)로 그 시점에 생성,
  생성 중엔 스피너 + "생성 중..." 표시, 완료되면 DB 저장 + 이후 재방문·다른 유저 조회 시 캐시 히트.
  DB 컬럼은 생성 전까지 `null` — "생성 실패"와 "아직 생성 안 함"을 구분하기 위해 빈 placeholder
  객체 대신 명시적 null 사용(2배치/3배치 캐시 히트 판정에서도 이 두 필드는 제외됨).
  실측(2026-07-09, Datadog, 개발 서버 1회 측정 — 배치 완료 시간은 병렬 호출 중 가장 느린 것에
  의해 결정되므로 기업별 편차 있음): 2배치 30.4s(business_model_v2 26.7s, competitors_v2 30.4s),
  3배치 36.7s(value_chain_v2 36.7s, strategy_v2 29.3s) — 이전에는 각 배치에 industry_history_v2/
  tech_evolution_v2가 3번째 병렬 호출로 더해져 있었음. 셋 중 가장 느린 호출이 배치 완료 시간을
  결정하는 구조라, 제거로 인한 체감 단축 폭은 그 두 섹션이 해당 배치에서 병목이었는지에 따라
  기업마다 다름(느슨한 상한 감소는 항상 있음: 동시 API 호출·실패 표면 감소).
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
- 필수 API 키: ANTHROPIC_API_KEY, DART_API_KEY, FMP_API_KEY, KIS_APP_KEY, KIS_APP_SECRET

### GTM 방향
- 1차 타겟: 미국 시장 (영어 버전 우선)
- 채널: Product Hunt, Reddit (r/sales, r/BusinessDevelopment, r/startups)
- 투트랙 메시징:
  ① AE 개인 대상 — "고객사 이해 격차 해소" (Reddit/PH 통한 바텀업 발견 → 개인 셀프서브)
  ② 대표/CBO/세일즈리드 대상 — "팀 영업 퀄리티 평준화, 온보딩 단축" (직접 아웃리치/창업자 커뮤니티 통한 탑다운 도입)
- 랜딩페이지: Framer 무료 플랜 — 메인은 AE 언어, "팀으로 도입" 별도 섹션/CTA 분리
- 결제: 앱 내 Stripe만 (랜딩페이지 결제 없음)
- 도메인: 1min.so 또는 get1min.com (미정)
- 온보딩: 구글 로그인 + 설문 (직무/지역/목적/회사규모)
- 행동 로그: Posthog
- 라이브 채팅: Crisp

### 제품 원칙 (Vision 문서 기준)
- 속도와 정확도가 전부 — 예쁜 것보다 믿을 수 있는 데이터
- 아웃풋 포맷은 유저가 결정 — 우리는 좋은 인풋을 준다
- 온보딩 데이터 수집 — 직무/목적/조사대상 3~4개 질문으로 DB 쌓기
- MVP는 단순하게 — 기능 추가보다 5명이 매일 쓰는 게 목표

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
   - 주요 제품/서비스 + 매출 비중
   - 주요 고객사 + 집중도 리스크
   - 성장 모멘텀 / 핵심 리스크
   - 최근 트리거 이벤트 (투자유치/유상증자/대규모딜, 최근 12개월·최대 3개, 없으면 섹션 미노출)

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

### 🟡 2순위 (데이터/기능)
- [ ] EDGAR 태그 매핑 강화 + FMP 폴백
- [ ] 한국 주식 KRX 티커 매핑
- [ ] 산업군별 정리
- [ ] AI 비서 재활성화 (현재 코드 주석 처리됨)

### 🟢 3순위 (GTM)
- [ ] Framer 랜딩페이지
- [ ] 영문화 (EN/KR 토글)
- [ ] Reddit 포스팅 (r/sales, r/BusinessDevelopment, r/startups)
- [ ] Crisp 라이브 채팅
- [ ] Stripe 결제 연동
- [ ] 세일즈 특화 기능 (임직원수/채용트렌드/LinkedIn/Glassdoor) — 우선순위 하향(🟡→🟢, 2026-07):
  AE 콜 프렙 중심으로 재포지셔닝하며 SDR 볼륨 프로스펙팅용 기능은 우선순위 밖으로 이동.
  SDR 볼륨 리서치는 Apollo/ZoomInfo/Clay가 이미 커버하는 영역이라 직접 경쟁할 필요 없음
- [ ] Product Hunt 런칭
- [ ] 도메인 구매 (1min.so)
- [ ] 주요 기업 사전 분석 캐시 (top 50-100 기업, 미국 S&P100 + 한국 코스피 상위 50) —
  `server/scripts/precomputeTopCompanies.ts`(2026-06-29)는 구글 로그인 도입(2026-07-03,
  커밋 `89f45e2`)으로 인증 없이 `/api/analyze`를 호출하다 깨진 상태 — 되살리려면
  HTTP 계층 우회 리팩터링 필요, 착수 전(2026-07-16 확인, 실전 발견 이력 14번 참고)

### ✅ 완료
- [x] 창업자 탭 추가
- [x] 출처 각주 시스템 (🟢공식/🟡참고/⚪추정)
- [x] 배치 구조 + 캐시 히트
- [x] DART/EDGAR 매핑 118k/8k
- [x] -999 placeholder 처리
- [x] 성장 모멘텀/핵심 리스크 교체
- [x] Finviz 정적 차트 → 제거됨 (투자자 포지셔닝 방지 목적, 2026-07)
- [x] CLAUDE.md SSOT 완성
- [x] 밸류체인 세로 구조 (업스트림→다운스트림 ↓ 화살표)
- [x] 더 보기/접기 토글 (ShowMore)
- [x] PDF 온디맨드 생성 (pdf().toBlob()) (관리자 전용 노출, 2026-07)
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
  로드(history 탭과 동일 경로) — 신규 Claude 호출도 무료 횟수 카운트도 발생하지 않음.
  **(2026-07-16, 검색-캐시 조회 흐름 v2.1.0으로 완전히 대체되어 이 라우트는 제거됨 —
  아래 참고, 키보드 네비게이션 등 UX 패턴은 그대로 이어받음)**
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
- [x] CSP img-src에 `charts2-node.finviz.com` 추가 (finviz 차트 이미지 리다이렉트
  타겟 차단 수정) + `gatherResearch` 웹서치 라운드 초과 시 예외 대신 부분 결과
  폴백 처리 (`runWithWebSearch`에 `label` 파라미터로 로그 태깅 추가,
  `gatherResearch1`/`2`에 방어적 try/catch 추가) — 2026-07-06 삼성전기 분석 전체
  실패 사고 수정, 상세는 Security Principles 실전 발견 이력 10번 참고.
- [x] 검색-캐시 조회 흐름 v2.1.0 + 회사-상장 데이터 모델 (2026-07-16) —
  `companies`/`company_listings`(신규, lazy 생성) 분리, `GET /api/companies/typeahead`
  (corp_master+cik_master 직접 조회, `company_dual_listings_manual`로 다중상장 병합)
  + `POST /api/companies/resolve`(lazy upsert + 캐시조회 통합) 신규, 기존
  `GET /api/companies/autocomplete` 제거. `HomeContent.tsx` 자유 텍스트 제출 차단,
  드롭다운 클릭 필수, `resolveResult.cached` 단일 분기로 바로보기/재분석하기 vs
  새 분석 시작 렌더링. 계기: SK하이닉스 2026-07-10 나스닥 ADR(SKHY) 상장으로
  "회사 1개 = 데이터소스 1개" 전제가 깨짐 — 실제 조사해보니 `companies`/
  `analyses.company_id` FK는 이미 있었고(cik/corp_code 기반 연결은 애초에 없었음),
  `financial_cache`도 이미 소스별 identifier 키라 다중소스 공존 가능했음 — 진짜
  빠진 건 `fetchFinancialContext`의 라우팅(회사명 한글 포함 여부로 DART/EDGAR
  결정하는 휴리스틱이라 "두 시장에 다 있다"는 사실 자체를 몰랐음)뿐이었음.
- [x] 다중상장 회사 재무 우선순위 (2026-07-16) — `fetchFinancialContext(name, listings?)`가
  EDGAR+DART 둘 다 아는 회사면 이름 휴리스틱 대신 identifier로 직접 조회, EDGAR 우선
  → 실패/데이터없음 시 DART 폴백(`fetchEdgarDataByCik`/`fetchDartDataByCorpCode`,
  기존 함수에서 lookup 단계만 건너뛰는 순수 추출이라 회귀 없음). 다중상장 확정 7건
  (KB금융/한국전력공사/LG디스플레이/신한지주/SK텔레콤/우리금융지주/SK하이닉스) —
  SK하이닉스는 cik_master 배치 동기화가 아직 못 따라잡아 웹 조사로 실제 CIK(2120882,
  ticker SKHY, Form F-6)를 찾아 수동 시드. 포스코홀딩스는 corp_master에서 지주사
  자체 corp_name을 못 찾아 보류. 실측(SK텔레콤)으로 확인한 함정: EDGAR에 CIK가
  있어도 재무 데이터가 있다는 보장은 없음 — 외국 민간 발행인은 IFRS 태그로 20-F를
  내는 경우가 흔해 `us-gaap` XBRL concept가 통째로 비어있을 수 있음(SK텔레콤 실측:
  rev/opInc/netInc 전부 null) → 폴백 체인이 이 케이스를 정확히 잡아서 DART로
  넘어가는 것까지 확인함.
- [x] 로그인 유도 모달 + 로그인 후 자동 재개 (2026-07-16) — `LoginPromptModal.tsx`
  신규(라이트 테마, 12px 라운드 카드, 배경 클릭/X로 닫힘, 타이틀 "시작하고 무료로
  분석해보세요"). typeahead 드롭다운 클릭 시 비로그인 상태면 기존처럼
  `signInWithGoogle()` 바로 리다이렉트 대신 이 모달을 먼저 띄우고, "구글로 계속하기"
  클릭 시에만 리다이렉트(이 시점에 선택했던 회사를 `sessionStorage`에 저장).
  `signInWithGoogle()`이 전체 페이지가 새로고침되는 OAuth 리다이렉트라 React state로는
  로그인 후 복원이 안 되는데, `sessionStorage`는 페이지 리로드에도 살아남으므로 로그인
  후 마운트되는 effect가 이 값을 읽어 자동으로 resolve를 이어감(처음부터 다시 검색 안
  해도 됨) — 처음엔 스코프 아웃했던 항목인데 바로 다음 요청에서 함께 구현됨. 실전
  발견 이력 11번에서 추가한 `resolve` 401 응답 케이스도 동일하게 모달로 전환.
- [x] 온보딩 설문 "지역" 필드 추가 (2026-07-16) — 온보딩 설문 자체(회사명/조직규모/
  산업/직무/직급/목적, 6문항)는 사실 2026-07-10에 이미 완성·배포되어 있었음
  (`OnboardingModal.tsx`가 `AppShell.tsx`에 이미 마운트되어 로그인마다 실제로 뜨는
  중이었고, 커밋 `96aa559`/`31b52d9`/`3a477d6`로 이미 반영됨) — 아래 실전 발견 이력
  12번 참고. 이번 요청에서 빠져있던 건 "지역"(한국/미국/기타) 하나뿐이라 기존 폼에
  `region` 컬럼/질문만 추가(`profileLabels.ts`/`ProfileForm.tsx`/`OnboardingModal.tsx`/
  `settings/page.tsx`/`server/src/routes/profile.ts` 전부 갱신), 나머지 5문항과
  6구간 조직규모는 그대로 유지.
- [x] Posthog 행동 로그 + Microsoft Clarity (2026-07-09, 커밋 `d15c479`) — 둘 다
  `client/src/app/components/Analytics.tsx`(전역, `layout.tsx`에 마운트 — 공유 링크
  페이지도 트래킹 대상이라 `AppShell` 밖에 둠)에서 초기화. Posthog는
  `client/src/lib/analytics.ts`의 `trackEvent`/`identifyUser`/`syncProfileProperties`로
  검색 실행·리포트 생성·온보딩 프로필 등 이벤트/유저 속성 전송, Clarity는 키만 있으면
  스크립트 삽입(세션 리플레이/히트맵, 대시보드 쪽 추가 설정 없음). 둘 다 키 없으면
  no-op. 백로그 🟢 3순위에 "Posthog 행동 로그"가 남아있던 것 + Clarity가 CLAUDE.md
  어디에도 없던 것 둘 다 2026-07-16 감사에서 발견해 정리(아래 실전 발견 이력 13번).
- [x] dev/prod 배포 인프라 분리 (2026-07-09, 커밋 `8b0088e`) — `APP_ENV`/
  `NEXT_PUBLIC_APP_ENV` 플래그(`server/src/lib/env.ts`, `client/src/lib/env.ts`) 신규.
  `NODE_ENV`는 `next build`가 배포 환경과 무관하게 항상 `production`으로 고정돼서
  별도 플래그가 필요했음. `render.dev.yaml`(dev용 Render Blueprint) 추가,
  `scripts/migration-hook.mjs`가 prod/dev 둘 다 안내하도록 확장.
- [x] `/history` 페이지 로그인 게이트 통일 (2026-07-16) — `GET /api/analyses`가
  `resolveAuthUser` 하드 401로 전환(client_id 폴백 제거), `history/page.tsx`는
  `!session`이면 목록 요청 자체를 안 보내고 `LoginPromptModal` 노출. 검색
  typeahead와 무관한 별개 경로였던 만큼 실전 발견 이력 15번에 경위 기록.
- [x] 경쟁사 카드 국기 미표시 버그 수정 (2026-07-16) — "PC에서만 국기 없이
  텍스트만 보인다"는 신고로 조사, 원인은 플랫폼/폰트가 아니라 **레거시
  `CompetitorCard`(competitors_v2 없는 구버전 캐시 데이터일 때만 쓰이는 폴백
  컴포넌트)가 `flagOf()` 호출 자체를 안 하고 있었던 것** — `CompetitorsV2Tab`
  등 나머지 4곳은 전부 정상 호출 중이었음. `flagOf()` 호출 추가 + `COUNTRY_FLAG`에
  ISO 2자리 코드(KR/CN/JP/DE/FR/GB/IN) 방어적 추가(country 필드 포맷이
  프롬프트에 강제돼있지 않아 Claude가 가끔 국가명 대신 코드로 반환할 가능성 대비).
  **Windows Segoe UI Emoji가 국기 이모지를 코드 텍스트로 폴백하는 알려진 OS
  이슈일 가능성도 별도로 있어 이번 수정 후에도 PC에서 재발하면 SVG 국기 아이콘
  전환이 필요함 — 아직 미확정, 재현 테스트로 확인 필요.**

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

### 원칙 3: UI에서 제거된 기능도 라우트/코드는 별도로 점검
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
8. (2026-07-04, 긴급, 개인정보 노출) 로그인한 유저가 `/history`에서 다른 유저가
   분석한 기업까지 보인다는 신고 → 확인 결과 **구글 로그인 작업 중 필터가
   빠진 게 아니라, `GET /api/analyses` 목록 라우트가 애초부터 (`router.get('/',
   async (_req: Request, ...)` — `_req` 자체가 미사용 파라미터) 전 유저의 최근
   50개 분석을 무조건 반환하는 구조였음**. `analyses`/`companies` 테이블에는
   소유자 컬럼이 원래 없다(전 유저 공용 캐시로 설계 — 동일 기업 재분석 방지가
   목적, 오늘 만든 기업명 자동완성도 이 공용 캐시 전제로 동작). 로그인이 없던
   동안은 "누구의 기록"이라는 개념 자체가 없어 드러나지 않다가, 구글 로그인으로
   실제 신원(이메일)이 생기면서 "누가 어떤 기업을 조사했는지"가 실질적 개인정보/
   경쟁정보 노출로 바뀐 것 — git diff로 오늘 커밋(`89f45e2`)이 이 라우트를 건드리지
   않았음을 직접 확인해 원인을 정정.
   → `analysis_usage`(유저별 분석 요청 이력 테이블, 로그인 도입 때 이미 만들어둔
   것)를 "내 히스토리"의 소스로 사용하도록 변경: 요청자 식별자(authUserId ??
   clientId)로 `analysis_usage`를 먼저 조회해 이 유저가 실제로 요청한 회사명만
   추출한 뒤 `analyses`/`companies`와 조인. **식별자가 전혀 없으면 빈 배열
   반환(fail-closed)** — 레이트리밋 체크의 "식별자 없으면 통과(fail-open)"와는
   반대 방향임에 주의(전자는 불편, 후자는 정보 유출이라 리스크 방향이 다름).
   `GET /api/analyses/:id`(개별 상세 조회)는 의도적으로 그대로 둠 — 이건 여전히
   "누가 봐도 되는 공용 캐시 콘텐츠"이고(자동완성이 그 위에서 동작), 유출되는 건
   "누가 언제 조회했는가"라는 활동 로그이지 콘텐츠 자체가 아니기 때문.
   검증: 서로 다른 두 식별자로 실제 curl + Playwright 브라우저 양쪽에서
   상대방 기업이 안 보이는 것 확인, 식별자 없는 요청은 빈 배열 확인.
   교훈: 새 식별자 개념(client_id → user_id)을 도입할 때는 "이 식별자를 써야
   했는데 안 쓴 곳"뿐 아니라 **"애초에 아무 식별자도 안 쓰던 목록성 엔드포인트"**를
   전부 감사할 것 — 후자는 원래도 버그였지만 신원이 없던 시절엔 리스크가
   드러나지 않아 방치되기 쉽다. `_req`처럼 인자가 밑줄로 미사용 처리된 라우트는
   "권한 체크를 의도적으로 생략한 공개 API"인지 "그냥 아무도 안 넣은 것"인지
   구분이 안 되므로, 로그인/식별자 개념을 새로 넣는 시점에 전 라우트를 훑어서
   명시적으로 확인할 것.
9. (2026-07-04, 최우선) NVIDIA/Apple/Berkshire 전부에서 "성장 시나리오 항상 3개년
   미만 잠김" + "영업이익률 항상 확인 필요(매출은 정상)" + "YoY 의심스러운 값" +
   (Apple만) "재무제표 전체 (추정) 오분류" 신고 → 코드 변경 이력(git log)엔 이 경로를
   건드린 커밋이 없어서, 범인은 코드가 아니라 **XBRL concept 선택 로직의 오래된
   설계 결함**이었음. 세 가지 독립된 원인이 겹쳐 있었음:
   - **`pickConceptSeries`/`pickConcept`이 "처음 매칭되는 concept" 선택** — 우선순위
     후보 목록(예: `Revenues` → `RevenueFromContractWithCustomerExcludingAssessedTax`)은
     동의어 나열이지 우선순위가 아닌데, 첫 번째로 비어있지 않은 concept에서 멈춤.
     Apple은 ASC 606 전환기(2018년)에 `Revenues` 태그를 1개년만 남기고
     새 concept으로 넘어갔는데, 코드가 그 옛 1개년짜리를 그대로 채택 →
     `financial_cache.raw_edgar`가 revenue=2018년 1개, operatingIncome/netIncome=null인
     채로 배치 캐시에 박혀 있었음(실측 확인: SEC live API로 `Revenues`=[2018]뿐,
     `RevenueFromContract...`=2019~2025 37건). → 최신 연도 → 데이터 개수 순으로
     선택하도록 변경 (`server/src/lib/edgar.ts`, `server/scripts/edgarBatchPrecompute.ts`
     양쪽 다 — 후자는 크론 스크립트라 별도 실행 컨텍스트라서 로직이 복제돼 있음).
   - **단일 연도 스냅샷(`ef.operatingIncome` 등)이 revenue와 같은 회계연도인지
     검증 안 함** — concept마다 태깅이 끊긴 시점이 다를 수 있는데(Berkshire는
     `OperatingIncomeLoss`를 2012년 이후 아예 안 태깅), "그 concept의 최신값"을
     "이번 연도" 라벨을 달고 그대로 노출 → **13년 전(2012년) 영업이익 수치가
     "2025년 영업이익률 5.4%"로 표시되는 사고**로 이어짐(Claude가 이 잘못된
     값으로 마진을 계산해 그럴듯한 숫자를 만들어낸 것 — 숫자 자체가 그럴듯해서
     더 위험한 케이스). → revenue의 회계연도와 정확히 일치할 때만 손익계산서
     항목(매출총이익/영업이익/순이익/EBITDA용 감가상각)을 채택하도록 수정.
   - **"조회 실패"와 "이 기업 구조상 원래 없음"을 구분하는 방법이 없었음** —
     Berkshire처럼 지주회사/보험/복합 사업구조라 연결 영업이익 자체를 SEC에
     보고하지 않는 경우, 컨텍스트에 아무 신호가 없으니 Claude는 규칙대로
     "확인 필요"만 반환 → 사용자 입장에선 "파싱 실패"처럼 보임. → 서버가
     `rawSeries` 전체가 null인 필드를 감지하면 컨텍스트에 "해당없음(구조적
     미보고)" 명시적 주석을 넣고, `SECTION_SYSTEM` 프롬프트에 "확인 필요"(찾아봤지만
     못 찾음)와 "해당없음"(그 기업 구조상 애초에 없음)을 구분해서 쓰라고 지시.
     프론트(`DataValue`/`FinancialValue`/`MetricCard`)도 "해당없음"을 "확인 필요"와
     다르게(기울임 없이, 툴팁 포함) 렌더링하도록 분기 추가.
   검증: SEC live API로 Apple 가설 직접 확인 후 수정 → 세 회사 전부 forceRefresh
   재분석해서 growth_scenario_v2 생성 확인(전부 false→true), Apple 영업이익률
   32.0%·YoY 6.4%로 정상화, financials_v2 다년도 테이블에서 (추정) 오분류 사라짐,
   Berkshire 영업이익이 "해당없음"으로 정확히 구분 표시됨을 DB에서 직접 확인.
   교훈: (1) "최근에 뭐 고쳤길래"로 시작하지 말고 먼저 원본 데이터(이번 경우
   `financial_cache.raw_edgar`)를 직접 열어볼 것 — git log 뒤지느라 쓴 시간보다
   DB 조회 한 번이 빨랐음. (2) 외부 데이터 소스(SEC XBRL)를 다루는 "여러 후보
   중 하나 선택" 로직은 전부 암묵적으로 "최신·최다 데이터가 이긴다"를 가정하고
   짜야 함 — 그냥 첫 매칭을 쓰면 조용히 오래된 데이터를 선택하는 사고가 반복됨.
   (3) "이 필드가 있으면 쓴다" 이상으로, 서로 다른 필드가 정말 같은 기간을
   가리키는지 앵커(이번 경우 회계연도)로 검증하지 않으면, 숫자 자체는 진짜인데
   기간이 틀려서 훨씬 알아채기 어려운 오답이 나온다.
10. (2026-07-06) "삼성전기" 분석 시 Render 로그에 `Error: Max conversation rounds
    exceeded` (스택: runWithWebSearch → analyzeCompany → routes/analyze.ts) 발생,
    분석 전체 실패 신고 — 동시에 CSP 콘솔 위반 3건(이미지·폰트 차단)도 함께 발견.
    - **원인**: `runWithWebSearch`(웹서치 라운드 루프)가 `maxRounds` 소진 시
      `throw new Error(...)`로 종료했는데, 이를 호출하는 `gatherResearch1`/
      `gatherResearch2`가 `analyzeCompany` 안에서 **`runBatch`의 try/catch
      바깥에서 직접 `await`**되고 있었음(batch2~5와 달리 배치 격리가 없는 코드
      경로). 로그에 라벨을 붙여 확인한 결과 범인은 `financials_v2`나 개별 섹션
      배치(`competitors_v2`/`strategy_v2`/`industry_history_v2` 등)가 아니라
      **`gatherResearch2`(maxRounds=2로 타이트하게 설정된 공유 리서치 단계)** —
      이 섹션들은 애초에 자체 웹서치를 하지 않고 `gatherResearch1`/`2`가 모아온
      공유 컨텍스트만 소비하는 구조라 라운드 초과 자체가 불가능한 경로였음.
      `financial_cache HIT DART`(캐시 히트)와는 무관 — 그건 `fetchFinancialContext`
      경로이고, 리서치 라운드 소진은 완전히 별개의 웹서치 경로.
    - **수정**: `runWithWebSearch`에 `label` 파라미터 추가해 라운드별 로그에
      `[gatherResearch][라벨]` 태깅, `maxRounds` 소진 시 예외 대신 그때까지 모은
      부분 텍스트로 폴백(Quality Gate 원칙 참고). `gatherResearch1`/`gatherResearch2`
      자체에도 try/catch를 추가해 라운드 초과 이외의 에러(네트워크 등)까지 이중 격리.
    - CSP 건은 코드 대조로 확인: `img-src`에 `charts2-node.finviz.com`이 빠져있었음
      (`finviz.com/chart.ashx`가 실제 이미지를 이 CDN 서브도메인으로 리다이렉트해서
      서빙 — `finviz.com`만 허용해선 리다이렉트 타겟이 막힘). 반면 신고에 포함된
      `font-src`용 `frontend-cdn.perplexity.ai`는 코드베이스 전체를 검색해도 참조하는
      곳이 전혀 없었음(폰트는 전부 `/fonts/` 로컬 파일) — 근거 없이 CSP를 열어주는
      대신 사용자에게 확인 후 추가하지 않기로 결정.
    - 검증: 로컬에서 `삼성전기`로 재현 — `[gatherResearch][gatherResearch2]
      maxRounds(2) 소진 — 부분 결과로 폴백` 경고 로그 확인, 이후 batch1~5 전부
      정상 완료(`[POST /api/analyze/stream] Error` 없음). `next build`로 CSP
      문자열 문법 확인.
    교훈: (1) 배치 단위 격리(`runBatch` try/catch)가 있다고 해서 그 배치가 의존하는
    "배치 이전 단계"(공유 리서치 등)까지 격리되는 건 아니다 — 격리 경계를 그릴 때
    "이 함수가 어디서 await되는가"까지 확인할 것, 실패 격리는 호출부 기준이 아니라
    실제 await 지점 기준으로 판단해야 함. (2) 여러 병렬 작업 중 "어느 게 원인인지"를
    사용자 직관(섹션 이름)에만 의존해 짐작하지 말고, 로그에 태그를 붙여 실제 실행
    구조(이 경우 섹션 배치는 웹서치를 안 한다는 사실)를 먼저 확인할 것. (3) CSP
    도메인 추가 요청이라도 코드 근거가 없으면 그대로 반영하지 말고 확인할 것 —
    출처 불명 서드파티 도메인을 CSP에 넣는 것 자체가 불필요한 공격 표면 확장.
11. (2026-07-16) 검색-캐시 조회 흐름(v2.1.1) 구현 직후 발견 — 신규 `POST
    /api/companies/resolve`가 `/api/analyze/stream`과 동일한 로그인 게이트를
    빠뜨리고 있었음. curl로 직접 대조 확인: 헤더 없이 호출 시 `/api/analyze/stream`은
    401, `resolve`는 200 + `companies` row까지 정상 생성. 원인은 신규 엔드포인트
    작성 시 "이건 Claude를 호출하지 않고 캐시 존재 여부만 확인하니 기존
    `/api/companies/autocomplete`(원래도 무인증)와 같은 성격"이라고 판단해 인증을
    아예 안 넣은 것 — 그런데 이 엔드포인트의 "바로 보기" 결과가 `GET
    /api/analyses/:id`(이것도 원래 무인증)로 이어지면서, 결과적으로 로그인 없이
    캐시된 분석 전체를 열람할 수 있는 경로가 생겼음. `resolveAuthUser` 401 게이트를
    `resolve`에 추가 + 프론트 `handleSelectSuggestion`에 `!session` 체크를 넣어
    비로그인 클릭 시 `resolve` 호출 자체를 안 하고 구글 로그인 유도로 전환.
    같은 조사에서 "캐시 조회는 히스토리에 안 남는다"도 확인됐는데, 여기서
    `analysis_usage`가 "무료 횟수 카운터"와 "히스토리 목록 소스"(`GET
    /api/analyses`) 두 역할을 겸하고 있다는 게 드러남 — 캐시 조회도 그냥
    `recordAnalysisUsage`로 기록하면 히스토리엔 뜨지만 동시에 무료 2회 중 1회를
    "보기만 해도" 소진시키는 부작용이 생김. `analysis_usage.is_cache_view`
    컬럼(기본 false)을 추가해 `checkAnalysisUsage`가 `is_cache_view=false`만
    카운트하도록 분리, `recordAnalysisUsage(userId, target, isCacheView)`로 시그니처
    확장. 검증: 테스트 유저로 캐시조회 3번 기록 → `usedCount` 그대로 0, 실제분석
    2번 기록 → `usedCount=2`(차단) 확인, 전체 5행은 히스토리 소스 쿼리에 다 잡힘.
    교훈: (1) "이 엔드포인트는 비용이 안 드니 인증 필요 없다"는 판단은 그 엔드포인트가
    반환하는 데이터(이 경우 캐시된 분석 열람 경로로 이어지는 id)까지 감안해서
    다시 봐야 한다 — 비용 발생 여부와 접근 통제 필요 여부는 다른 축. (2) 기존
    필드/테이블을 새 목적(cache-view 기록)으로 재사용하기 전에 그 필드가 이미
    다른 로직(무료 횟수 카운트)의 입력으로 쓰이고 있는지 먼저 확인할 것 — 겸용
    테이블에 무심코 행을 추가하면 의도 안 한 곳에서 부작용이 남.
12. (2026-07-16, 보안 이슈는 아니고 문서-실제 불일치) "온보딩 설문 신규 구현" 요청을
    받고 코드부터 확인해보니 이미 2026-07-10에 완전히 구현·배포된 상태였음
    (`OnboardingModal.tsx` + `ProfileForm.tsx` + `server/src/routes/profile.ts`,
    `AppShell.tsx`에 마운트까지 되어 실제로 로그인마다 뜨고 있었고, git log상 커밋
    3개(`96aa559`/`31b52d9`/`3a477d6`)로 이미 완결) — 그런데 이 CLAUDE.md의 백로그
    🔴 1순위에는 "로그인 후 프로필 설문만 미착수"라고 6일째 그대로 남아있었음.
    그대로 지시대로 새 컴포넌트를 만들었다면 기존 것과 마운트 지점이 충돌하거나
    중복 렌더링됐을 것 — grep으로 `OnboardingModal` 사용처를 먼저 찾아보고서야
    발견함. 실제로 빠진 건 "지역" 질문 하나뿐이었음(기존 6문항엔 없었음).
    교훈: "이 기능 아직 안 만들어졌다"는 백로그 문서의 말도 믿지 말고, 구현을
    시작하기 전에 항상 컴포넌트/라우트 이름으로 직접 grep해서 이미 있는지 확인할
    것 — 이 프로젝트에서 반복돼온 "직접 짠 커밋 이후 CLAUDE.md 갱신을 깜빡함" 패턴이
    이번엔 백로그 쪽에서 터진 것뿐, 근본 원인은 동일함(작업 완료 후 문서 갱신을
    빠뜨리는 습관).
13. (2026-07-16) 12번 사고 직후 "CLAUDE.md 백로그/완료 항목과 실제 배포 기능을
    git log 기준 전수 대조"를 요청받아 확인 — 같은 종류의 문서 드리프트가
    최소 4곳 더 있었음: (1) "Posthog 행동 로그"가 🟢 3순위 백로그에 그대로 남아
    있었지만 실제로는 2026-07-09 커밋(`d15c479`)으로 이미 배포됨. (2) 같은 커밋으로
    같이 들어간 Microsoft Clarity는 백로그에도 완료 목록에도 아예 언급 자체가
    없었음 — grep으로 `client/src/app/components/Analytics.tsx`를 열어보고서야
    발견. (3) 버전 히스토리 표의 v2.1.0 행이 "온보딩 설문(미착수)"라고 적혀
    있었음 — 직전 턴(12번)에서 백로그 항목은 고쳤지만 버전 히스토리 표와
    "무료/프리미엄 모델" 섹션의 동일 문구는 놓쳤던 것. (4) 2026-07-09 커밋
    (`8b0088e`)으로 추가된 `render.dev.yaml`/`APP_ENV` dev-prod 인프라 분리가
    "Dev" 섹션 어디에도 반영 안 됨. 교차검증 삼아 KRX 티커 매핑/산업군별 정리/
    AI 비서/Crisp/영문화/Stripe 백로그 항목도 코드로 확인했는데 이건 전부 실제로
    미착수 상태 맞음(오탐 아님).
    교훈: (1) 같은 세션 안에서도 "이 항목 하나 고쳤다"가 "그 항목이 언급된 모든
    곳을 고쳤다"를 보장하지 않는다 — 같은 사실(온보딩 완료)이 백로그/버전
    히스토리/정책 설명 섹션 세 군데에 따로 적혀 있었는데 grep 없이 하나만
    고치고 넘어갔음. 문구를 고칠 땐 그 문구 자체가 아니라 "그 문구가 담고 있는
    사실"로 전체를 grep해서 다른 표현으로 반복된 곳이 더 있는지 확인할 것.
    (2) 신규 도구/기능 도입 커밋은 그 커밋 자체에서 CLAUDE.md를 갱신하지 않으면
    쉽게 누락된다(Clarity는 아예 처음부터 문서화가 안 됐음) — 기능 추가 커밋과
    문서 갱신 커밋이 분리될수록 드리프트 위험이 커짐.
14. (2026-07-16) 백로그 "주요 기업 사전 분석 캐시"가 `precomputeTopCompanies.ts`와
    같은 기능인지, cron에 왜 안 물려있는지, 지금 돌리면 되는지 진단 요청받아 확인.
    - **cron 미등록은 설계상**: 같은 날(2026-06-29) 커밋된 `dartBatchPrecompute.ts`/
      `edgarBatchPrecompute.ts`는 그날 바로 `render.yaml`에 월간 cron으로 등록됐지만,
      이 스크립트는 자체 주석부터 "서버 먼저 띄운 뒤 수동 실행"이라 애초에 1회성
      수동 스크립트였음 — 빠뜨린 게 아님.
    - **지금은 깨진 상태, 미완성이 아니라 나중에 생긴 변경으로 조용히 rot**:
      이 스크립트(2026-06-29)는 `POST /api/analyze`를 인증 헤더 없이 호출하는데,
      4일 뒤 커밋 `89f45e2`(2026-07-03, 구글 로그인 도입)에서 바로 그 라우트에
      `resolveAuthUser` 하드 401 게이트가 추가됨 — client_id 폴백도 서비스롤 우회
      경로도 없어서 지금 그대로 돌리면 150개 기업 전부 401로 실패.
    - **"헤더만 추가"로 못 고치는 이유**: 이 엔드포인트는 실제 구글 로그인 유저의
      Supabase JWT만 통과하는 구조라 배치 스크립트가 자동으로 얻을 토큰이 없음
      (`isPremiumUser`의 `PREMIUM_OVERRIDE_CLIENT_IDS` 같은 내부 우회 경로가 이
      라우트엔 없음). 반면 실제로 살아있는 `dartBatchPrecompute.ts`는 애초에 자기
      서버 HTTP API를 전혀 안 거치고 외부 API(DART) 직접 호출 + Supabase에
      service-role로 직접 저장 — 이게 이 코드베이스에서 검증된 배치 스크립트
      패턴. `precomputeTopCompanies.ts`만 유일하게 "자기 서버의 인증된 HTTP
      엔드포인트를 되불러오는" 방식이라 인증이 걸리자 혼자 깨짐.
    - 리팩터링(analyzeCompany()/fetchFinancialContext() 직접 호출로 HTTP 계층
      우회)은 요청받았으나 이번엔 진행 안 함 — 백로그 🟢 3순위에 각주로만 기록.
    교훈: 배치/cron 스크립트가 자기 앱의 인증된 HTTP API를 되불러오는 설계는
    깨지기 쉽다 — 그 API에 나중에 인증이 추가되는 순간(이번처럼 완전히 별개의
    기능 작업으로) 아무도 모르게 rot한다. 서버 내부 스크립트는 처음부터 HTTP
    계층을 거치지 말고 서비스 함수/DB를 직접 호출하는 편이 이런 종류의 결합을
    원천 차단한다.
15. (2026-07-16) 실전 발견 이력 11번(resolve 인증 우회) 수정 직후, 검색창
    typeahead 외에 로그인 없이 과거 분석에 도달하는 다른 경로가 있는지 재현
    요청받아 확인 — **`/history` 페이지에서 두 번째로 같은 종류의 인증 게이트
    누락을 발견함.** 오늘 손댄 typeahead/resolve/LoginPromptModal 작업과는
    완전히 무관한, 세션 시작 훨씬 전부터 있던 코드 경로라 그 작업들에서 전혀
    건드리지 않았던 것.
    - **원인**: `client/src/app/history/page.tsx`가 `!session` 체크 없이
      `GET /api/analyses`를 호출했고, 서버(`server/src/routes/analyses.ts`)가
      `authUser?.id ?? clientId`로 폴백해서 비로그인 상태에서도 localStorage
      client_id 기준 과거 기록(회사명 + 정확한 분석 날짜)을 그대로 반환했음.
      클릭 시(`handleSelect`)도 resolve나 로그인 모달을 전혀 거치지 않고 바로
      `GET /api/analyses/:id` + `router.push('/?id=...')`로 직행.
    - **수정**: 서버 — `GET /api/analyses`에 `resolveAuthUser` 하드 401 게이트
      추가(client_id 폴백 제거, 다른 라우트와 통일). 클라이언트 — `!session`이면
      목록 요청 자체를 안 보내고 `LoginPromptModal`(companyName 빈 값 → 범용
      로그인 안내 문구) 노출, 모달 닫으면 홈으로 리다이렉트.
    - 비로그인 유저에게 "기존 분석 존재"를 존재 여부만 안내하는 절충안(날짜만
      숨기고 목록은 보여주기) 대신 **목록 자체를 통째로 로그인 게이트 뒤로
      숨기는 쪽을 선택** — 검색 화면 쪽도 이미 로그인해야만 캐시 조회 결과가
      보이는 구조라, `/history`만 다른 기준을 적용할 이유가 없었음.
    - 검증: 헤더 없이 curl로 `GET /api/analyses` → 401(`/api/analyze/stream`과
      동일 응답) 확인, 타입체크/dev 서버 hot-reload 정상. 브라우저 실클릭 재현은
      이 세션에 브라우저 자동화 도구가 없어 못 함(코드 검토로 갈음).
    교훈: "이 기능을 오늘 고쳤다"가 "같은 문제를 가진 다른 진입점이 없다"를
    보장하지 않는다 — 로그인 요구사항처럼 앱 전역에 적용돼야 하는 정책 변경은
    그 정책이 새로 생긴 기능(오늘의 typeahead)뿐 아니라 **그 정책이 생기기
    전부터 있던 기존 페이지/라우트**에도 똑같이 적용됐는지 별도로 감사해야
    한다 — 새 기능 코드만 보면 이런 경로는 시야에 아예 안 들어온다.
16. (2026-07-16) 15번 직후 전체 API 라우트 인증정책 감사(보고 전용) 결과를 토대로
    실제 수정 진행 — **`POST /api/analyze/reanalyze`, `POST/DELETE
    /api/analyses/:id/share`, `POST /api/analyses/:id/refresh-financials` 4개
    라우트가 인증 체크 자체가 전혀 없어서 비로그인 상태로도 Claude/EDGAR/DART
    API를 호출하는 비용발생 요청을 무제한으로 보낼 수 있었음.**
    - **소유권(403) 모델 설계 이슈**: 처음 요청은 4개 라우트 전부에 "본인이
      생성한 분석이 아니면 403" 체크를 요구했는데, `analyses` 테이블에는
      애초에 owner 컬럼이 없다(실전 발견 이력 8번 — 전 유저 공용 캐시로 설계).
      게다가 `reanalyze`/`refresh-financials`는 "탭별 재분석" 버튼을 통해 지금
      **로그인 여부와 무관하게 누구나** 눌러서 공용 캐시를 갱신할 수 있는
      협업성 기능으로 이미 동작 중이었음 — 여기에 "생성자만" 제약을 걸면 다른
      유저가 먼저 조회해둔 회사의 오래된 탭을 갱신해주는 원래 기능 자체가
      깨짐. 반면 공개 공유 링크 on/off는 성격이 달라(더 개인적인 결정) 생성자
      제한이 타당함. → 사용자에게 세 가지 안(라우트 통일 소유권 강제 / 로그인만
      요구 / 라우트별 분리)을 제시해 **"라우트별로 다르게 적용"**으로 확정:
      `analyses.created_by`(uuid, NULL 허용) 컬럼 신설, `share`/`unshare`
      2개만 이 컬럼으로 403 체크(`created_by`가 NULL인 기존 111건은 예외적으로
      로그인 유저 전원 허용 — 소급 차단 없음), `reanalyze`/`refresh-financials`는
      하드 401만 추가하고 기존 협업 UX 그대로 유지.
    - **`/api/cron/daily`(2순위)**: render.yaml/render.dev.yaml 재확인 결과 실제
      cron 서비스는 `npx ts-node scripts/edgarBatchPrecompute.ts` 등 스크립트를
      직접 실행하고 이 HTTP 라우트는 어디서도(client 코드 전체 grep 포함) 호출되지
      않는 고아 코드로 재확인 — 라우트 유지 대신 **완전 제거**(`cron.ts` 파일 +
      `index.ts` mount 삭제, 이 라우트에서만 쓰이던 `selectDailyCompany`도 같이
      제거 — 살려두면 어차피 안 쓰이는 죽은 export).
    - **수정**: `supabase/migrations/20260716_analyses_created_by.sql`(prod+dev
      적용) + 서버 4개 라우트에 `resolveAuthUser` 하드 401(공통), `share`/`unshare`
      에 `assertShareOwner()` 403 체크 추가. 클라이언트(`HomeContent.tsx`,
      `AnalysisCard.tsx`)의 `handleReanalyzeTab`/`handleShare`/`handleRevoke`/
      `handleRefreshFinancials`도 `Authorization: Bearer` 헤더를 보내도록 수정하고,
      세션 없으면 `signInWithGoogle()`로 유도.
    - 검증: 4개 라우트 전부 curl로 미인증 401 확인, `/api/cron/daily`는 404(라우트
      사라짐) 확인, 서버/클라이언트 `tsc --noEmit` 통과. **403(비소유자) 경로는
      실제 구글 계정 2개로 로그인해 서로 다른 유저 토큰이 있어야 재현 가능한데
      이 세션엔 그 수단이 없어 자동화 불가**(같은 한계가 2026-07-03 구글 로그인
      도입 때도 있었음, Security Principles 참고) — 코드 리뷰로 갈음
      (`created_by`가 있고 다른 유저 id일 때만 403, NULL이면 통과하는 조건문
      직접 확인).
    - **이번 세션 전체에서 발견된 인증 우회 패턴 총정리** (resolve 엔드포인트 →
      `/history` 페이지 → 이번 4개 라우트+cron, 총 3라운드에 걸쳐 반복 발견):
      공통 근본원인 — **새 라우트를 추가할 때 "인증 미들웨어를 붙였는가"가
      코드리뷰/체크리스트 어디에도 강제 항목으로 없었다.** 각 라운드가 서로
      다른 시점에 다른 이유로 인증 없이 작성됐음(resolve는 초기 프로토타입 잔재,
      `/history`는 로그인 도입 이전 코드, 이번 4개는 "탭별 재분석" 등 원래
      비로그인 시절 설계된 기능이 로그인 필수화 이후에도 안 바뀐 채 방치) —
      즉 한 번의 실수가 아니라 "로그인 필수화"라는 정책이 도입된 시점에 **기존
      라우트 전수 재감사가 없었던 것**이 근본 원인. 아래 체크리스트에 항목 추가.

### 새 프로젝트/기능 착수 시 체크리스트
- [ ] 신규 테이블 생성 시 RLS 활성화 여부 확인
- [ ] 신규 API 라우트에 인증/레이트리밋 여부 확인 (특히 유료 외부 API 호출 라우트)
- [ ] 프리미엄/과금 데이터는 서버 응답 조립 단계에서 필터링되는지 확인
- [ ] 기능 제거 시 UI뿐 아니라 API 라우트도 실제로 비활성화했는지 확인
- [ ] 시크릿 키가 여러 위치에 중복 저장되어 있지 않은지 확인
- [ ] 유저 식별자 개념을 새로 도입/전환(예: client_id → user_id)할 때는 그 식별자를
  써야 하는 모든 조회 쿼리를 함께 감사할 것 — 특히 "필터 조건이 아예 없던"
  목록성(list) 엔드포인트가 새 신원 체계 하에서 개인정보 노출로 바뀌는지 확인
  (2026-07-04 `/history` 전 유저 노출 사고 참고, 실전 발견 이력 8번)
- [ ] "이 기능 신규 구현" 요청을 받으면 코드부터 짜기 전에 컴포넌트/라우트 이름으로
  grep해서 이미 있는지 먼저 확인할 것 — 백로그 문서가 "미착수"라고 적혀있어도 실제
  코드 상태와 다를 수 있음(2026-07-16, 실전 발견 이력 12번 참고)
- [ ] "로그인 필수화"처럼 앱 전역 인증 정책이 바뀌는 시점엔, 그 정책 도입 **이전에
  이미 존재하던 라우트 전체**를 인증 여부 기준으로 재감사할 것 — 새로 짜는 코드에만
  정책을 적용하고 기존 라우트를 그대로 두면 조용히 예외로 남는다(resolve →
  `/history` → reanalyze/share/refresh-financials/cron까지 한 세션에서 3라운드
  반복 발견, 실전 발견 이력 11·15·16번 참고)

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

## 코드 작성 시 생략 금지 항목 (1min 특화 — ponytail 7단계는 전역 `~/.claude/CLAUDE.md` 참고)
코드 줄여도 이건 절대 생략 금지:
- 입력값 검증 (CIK 없는 기업, 빈 응답 등)
- 데이터 손실 막는 에러 처리 (실패 시 null 저장, 프로세스 중단 금지)
- API rate limit 초과 시 재시도 로직
- 환경변수 누락 시 명시적 에러

## Quality Gate 원칙 (1min 구현 기준 — 이상값 감지 시 부분 처리 원칙 자체는 전역 CLAUDE.md 참고)
이상값 판정 기준:
- 숫자 필드에 -999, -999% 등 placeholder 값
- 빈 문자열 또는 null이어야 할 자리에 "확인 필요" 텍스트
- 재무 수치가 전년 대비 10배 이상 변동 시 (추정) 뱃지 필수

위 이상값은 반드시 **해당 필드 단위**로 처리 — 필드 하나가 이상값이라고 같은 섹션의
나머지 정상 필드(배열 등)까지 폐기 금지. 섹션 전체 폐기는 모든 신호(대표 텍스트
필드 + 배열 필드)가 동시에 비어있을 때만 (2026-07-03 business_model_v2 22% 폐기
버그, 실전 발견 이력 6번 참고 — `server/src/lib/claude.ts`의
`SECTION_CONTENT_SIGNALS`).

웹서치 리서치 단계(`gatherResearch1`/`gatherResearch2` 등 `runWithWebSearch` 호출)가
maxRounds에 도달해도 예외를 던지지 말고, 그 시점까지 모은 부분 결과로 폴백 처리 —
배치 단위 격리(runBatch try/catch) 밖에서 직접 await되는 리서치 단계가 예외를 던지면
격리 없이 analyzeCompany 전체가 죽는다 (2026-07-06 삼성전기 사고, 실전 발견 이력 10번 참고).

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
| v2.1.0 | 구글 로그인(완료, 2026-07-03) + 온보딩 설문(완료, 2026-07-10) + Posthog/Microsoft Clarity(완료, 2026-07-09) |
| v2.1.1 | 2026-07-16 — companies/company_listings 스키마 분리(지연 생성), 검색-캐시 조회
  흐름(typeahead + 서버사이드 캐시 조건부 렌더링), 다중상장 재무 우선순위(EDGAR>DART),
  다중상장 대응(SK하이닉스 등) |
| v2.2.0 | 영문화 (언어 토글 EN/KR) |
| v3.0.0 | 유료 플랜 출시 (Stripe) |
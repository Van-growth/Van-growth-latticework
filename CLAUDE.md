# Latticework — CLAUDE.md

## Handoff

> **세션 시작 규칙**: 새 세션을 시작하는 Claude Code는 작업을 시작하기 전에 이 섹션을
> 먼저 읽고, "지난 세션에서 [마지막 진행 상황]까지 진행됐고, 다음은 [다음 우선순위]입니다"
> 형식으로 한 줄 요약한 뒤 작업에 들어갈 것. 이 섹션은 `/done` 커맨드
> (`.claude/commands/done.md`) 실행 시마다 통째로 덮어쓰기(overwrite)된다 — 이전 세션
> 내용이 누적되지 않고 항상 최신 상태 하나만 유지되므로, 과거 세션 기록이 필요하면
> git log/커밋 메시지를 참고할 것.

**날짜**: 2026-08-15
**커밋**: `4a2f184`(8/13~8/15 세션 누적분 — discovery_questions 통합/sonnet-5 전환/max_tokens+
로깅 수정) — push 완료. 그 이후 오늘 진행한 재무 파생 지표 원칙(EBITDA 제거) + 공유링크/PDF
ICP 노출 범위 재확정(Task A) + `/done` KR/EN 체크리스트 추가(Task B)는 전부 로컬 미커밋
**Render 배포**: 미확인 — `4a2f184` push 이후 배포 트리거 여부 확인할 수단(Render API 토큰/
MCP)이 이 세션에 없음, Render 대시보드에서 직접 확인 필요

### 완료

**1. discovery_questions 2단계 통합 + sonnet-5 전환 + 로깅/max_tokens 수정 (커밋 `4a2f184`, push 완료)**
9개 섹션 스키마에 `discovery_questions` 필드 신규 + ICP 탭 큐레이션 로직, `claude-sonnet-4-6`→
`claude-sonnet-5` 전체 전환, `callSection()` max_tokens 8000 상향 + JSON 파싱 실패 시 "OK"로
잘못 찍히던 로깅 결함 수정 + `extractJson()` 파싱 실패 시 원문 덤프 로직 추가. 상세는 커밋
메시지 및 CLAUDE.md Architecture 섹션 "ICP 인사이트 discovery_questions 2단계 통합" 참고.
- **이전 Handoff의 "최우선" 항목 해소 확인**: "Anthropic API 사용량 한도가 프로덕션과 같은
  키인지" — Render 프로덕션 로그 직접 조회로 **같은 키였고 실제 유저 트래픽도 이 에러로
  실패하고 있었음을 확정**(Amprius 사고 재조사). 다만 "빈 탭" 증상 전체가 이 한도 하나로
  설명되진 않음(NVIDIA strategy_v2가 `stop_reason=end_turn`인데도 JSON이 깨지는 별개
  미해결 메커니즘 발견) — 상세는 CLAUDE.md Quality Gate 원칙 섹션 참고.

**2. 재무 파생 지표 처리 원칙 — EBITDA 완전 제거 + Gross Profit 원본 태그 검증 (로컬 미커밋)**
- 확인 결과 Gross Profit은 이미 EDGAR/DART 원본 태그값만 쓰고 있었음(역산 로직 코드베이스
  어디에도 없었음). 라이브 SEC API로 20개 기업 직접 대조 — 태그 없는 9개(Ford/Berkshire/
  Walmart/GOOGL/3M/P&G/ExxonMobil/JPMorgan/Disney) 전부 "회사가 애초에 그 라인을 안 씀"
  (case a, 진짜 미보고)이었고 유사 대체 태그도 전무 — 태그 매핑 버그(case b)는 0건 확인.
- EBITDA는 계산 로직이 실제로 있었음(Operating Income + Depreciation) — `financialsTableBuilder.ts`/
  `edgar.ts`/`edgarBatchPrecompute.ts`/`financialContext.ts`/`fmp.ts`/`claude.ts` 스키마
  전부에서 제거, `depreciation` 필드 자체도 EBITDA 전용이라 함께 제거. NVIDIA/Ford 골든셋
  재확인 — EBITDA 행 완전히 사라짐, Gross Profit은 라이브 조회 시 원본값 정상 표시 확인.
- CLAUDE.md "재무 파생 지표 처리 원칙" 섹션 신설(콘텐츠 원칙 하단).

**3. 공유 링크/PDF ICP 노출 범위 재확정 — Task A (로컬 미커밋, DB 마이그레이션 미적용)**
8/13 결정("ICP 원문 그대로 노출") 착수 여부 확인 → 코드 0%였음 확인, 아래 새 방침으로 바로
구현. 상세는 CLAUDE.md Architecture 섹션 "공유 링크/PDF ICP 노출 범위 확정" 참고.
- **정정**: 공유 링크/PDF는 discovery_questions 결과만 노출, ICP 원문(제품/타겟산업/
  타겟직무)은 노출 안 함 — 소유자 영업 정보 보호 목적, 8/13 결정 번복.
- 구현 중 `icp_insights`에 소유자 특정 컬럼이 없다는 구조적 문제 발견 → `created_by` 추가로
  해결(사용자 확인 완료). 소유자 라벨은 이메일 마스킹 대신 `profiles.nickname`(선택 입력,
  미입력 시 일반 문구로 대체)으로 설계 변경 — 사용자가 이메일 기반 PII 노출 우려 제기해서
  전환(사용자 확인 완료).
- `share.ts`(공유 응답에 `icpDiscoveryQuestions`/`icpOwnerLabel`만 추가, ICP 원문 select
  자체를 안 함) / `AnalysisCard.tsx`(`isShareView` prop, 읽기 전용 `SharedIcpQuestionsTab`
  신설, 별점 위젯 없음) / `AnalysisPdf.tsx`(표지에 문구 한 줄만, 목록/ICP 세부 없음) /
  `ProfileForm.tsx`+`settings/page.tsx`(닉네임 입력 필드, 온보딩은 기존 `showIcp` 플래그
  재사용해 계속 숨김) 전부 구현 완료, `tsc --noEmit` 클라이언트/서버 통과.
- **마이그레이션 2건 작성만 완료, 적용 안 됨**: `20260815_icp_insights_created_by.sql`,
  `20260815_profiles_nickname.sql` — Supabase MCP 세션이 재인증 필요 상태였고, 사용자에게
  OAuth URL 전달했으나 이번 세션 안에 완료 확인을 못 받음. **prod+dev 둘 다 미적용** —
  이 상태로는 골든셋 기업으로 공유 링크를 열어도 새 컬럼/테이블이 없어 5번(실제 동작 확인)을
  못 함, 다음 세션 최우선.

**4. `/done` 커맨드에 KR/EN 체크리스트 추가 — Task B (로컬 파일, 버전관리 밖)**
`.claude/commands/done.md`에 새 5번 단계(KR/EN 다국어 체크리스트 확인) 삽입, 이후 단계 전부
재번호. 이번 `/done` 실행으로 실제로 그 단계가 동작해 이 Handoff에 반영됨을 확인(아래 5번
참고) — 단, `.claude/commands/*.md`가 `.gitignore`의 `.claude/*`에 걸려 있어(예외는
`settings.json`뿐) 이 변경 자체는 git으로 추적되지 않음 — 아래 "발견 (미처리)" 참고.

**5. KR/EN 다국어 체크리스트 확인 결과 (신규 절차 첫 실행)**
- Claude 프롬프트 언어 분기: 이번 세션 신규 Claude 프롬프트 콘텐츠 없음(EBITDA 제거는 스키마
  구조 지시 변경일 뿐 언어 분기와 무관, Task A는 Claude 호출 자체가 없음) — 해당 없음.
- UI 고정 텍스트: `uiStrings.ts`의 `icpInsight`(`ownerLabelNamed`/`ownerLabelGeneric`/
  `sharedEmpty`) + `profileForm`(`nickname`/`nicknameHelperText`/`nicknamePlaceholder`)
  전부 ko/en 양쪽 채움 확인. `AnalysisPdf.tsx`의 신규 문구는 파일 자체 `t(ko,en)` 헬퍼 사용
  (기존 PDF 전체가 이 패턴이라 uiStrings.ts 대상 아님) — 누락 없음.

### 남음
- **마이그레이션 2건 적용 + Task A 실제 동작 확인** — Supabase MCP OAuth 완료 후
  `20260815_icp_insights_created_by.sql`/`20260815_profiles_nickname.sql` prod+dev 적용,
  골든셋 기업 공유 링크 열어서 ICP 원문 안 보이고 질문 리스트만 보이는지 육안 확인(다음 세션)
- 오늘 세션 전체(재무 파생 지표 원칙 + Task A) 커밋+push, `4a2f184` Render 배포 확인
- **NVIDIA/Johnson & Johnson 재무 일관성 재검증** — 이전 Handoff부터 이월, 이번 세션도
  미착수. 단 EBITDA가 오늘부로 완전히 제거돼 원래 이 검증을 촉발했던 "EBITDA 크래시" 우려는
  해소됨 — 남은 의미는 매출/매출총이익/영업이익/순이익 4개 항목의 실행별 결정론성 재확인뿐
  (`server/scripts/testEdgarReanalysisConsistency.ts` 재사용)
- 창업자탭 legacy 기업 / 탭이동시 취소버그 / 로딩 UI 스피너 통일 / 재방문시 결과 유지 —
  4건 전부 착수 전(이전 Handoff부터 이월)
- **언어 토글 마스터 계정 전환** / **비상장 기업 검색 실제 동작 테스트** — 이전 Handoff부터
  이월, 진행 상황 미확인
- (이월) CLAUDE.md 문서화 3건(콘텐츠 포맷 원칙 신규 규칙/재현성 방어 원칙/핵심 포지셔닝+검증
  테스트 설계) — 계속 미해결
- (이월) dev/ops 서버 분리(Render) — 계속 이월 중
- (이월) Reddit r/Sales_Professionals 반응 확인/답글, AE 인터뷰 추가 진행 — 별도 세션(GTM)

### 발견 (미처리)
- **⚠️ `.claude/commands/*.md`가 통째로 `.gitignore` 대상**(`.claude/*`, 예외는
  `settings.json`뿐) — 오늘 추가한 `/done`의 KR/EN 체크리스트를 포함해 모든 커스텀 슬래시
  커맨드 정의가 이 컴퓨터에만 존재하고 git으로 추적되지 않음. 의도적 제외인지(개인 워크플로우)
  실수인지 확인 필요 — `settings.local.json`(개인용)과 `commands/*.md`(프로젝트 워크플로우
  정의, 팀 공유 성격에 가까움)는 성격이 달라 보임.
- (이월) NVIDIA strategy_v2가 `stop_reason=end_turn`(정상 종료)인데도 JSON이 깨지는 원인
  미특정 — 재발 시 `callSection()` FAIL 로그의 stop_reason/output_tokens + `extractJson()`의
  `server/debug-logs/parse-failures/` 원문 덤프로 확인할 것(2026-08-15 도입된 디버깅 장치)
- (이월) 회사명 캐시 키 분절 버그 — 재작업 금지 대상, 상세는 git log 참고
- (이월) Quality Gate 재현성 체크 설계 미정으로 구현 보류
- (이월) SEC 링크 유효성 자동 검증 — 스코프 밖 보류
- `layout.tsx`의 `<html lang="en">`과 metadata title/description이 서버 컴포넌트라
  localStorage 기반 언어 선호값을 SSR 시점에 반영 못 함 — a11y상 사소한 부정확, 의도적 보류
- AnalysisCard.tsx 탭 내부 콘텐츠 일부(섹션 타이틀·배지·버튼)는 의도적으로 미번역 — 탭
  라벨/액션버튼/차트 범례만 다국어 적용, AE Skills 탭은 스텁이라 계속 한국어 고정
- PDF의 `pdftotext` 텍스트 추출이 한글 구간에서 깨짐(시각적 렌더링엔 영향 없음) — 별도 확인
  필요
- react-pdf 테이블 행에 `wrap={false}` 없음 — 표 행이 페이지 경계에서 잘릴 가능성 이론상
  있음, 실측에선 미재현이나 표시만 해둠

### 다음 세션 우선순위
1. Supabase MCP OAuth 완료 확인 → 마이그레이션 2건 prod+dev 적용 → Task A 골든셋 실제 동작 확인

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

## 핵심 포지셔닝 (2026-08-11 확정)

**싸우지 않는 영역**: 파이프라인 생성(리드젠/어카운트 매니지먼트/CRM) — Clay, Apollo,
ZoomInfo, Salesforce가 이미 자본과 시간으로 굳혀놓은 시장. 여기서 경쟁하지 않는다.

**1min의 자리**: customer(market) pain diagnosis. 챌린저 세일즈·Gap Selling 같은
검증된 방법론들의 핵심(고객이 스스로 못 본 방식으로 문제를 재구성해 보여주기)은
원래 벤더 인에이블먼트 팀이나 10년차 시니어 AE 개인 역량에 갇혀 있었다.
1min은 그 방법론 자체를 새로 만드는 게 아니라, 방법론이 실행 단계에서 막히는 지점 —
"근데 그 인사이트를 어디서 구하지?" — 을 푸는 **진단 원재료(산업 diagnosis)를
개인 AE 레벨까지 민주화하는 인프라**다.

**왜 지금인가**: AX 솔루션(위시켓 AIDP 등) 공급이 늘어날수록, 병목은 "무엇을
도입할까"가 아니라 "우리가 정확히 무엇을 앓고 있는가"를 아는 능력으로 이동한다.
솔루션이 흔해질수록 diagnosis 역량의 가치는 커진다.

- 1min은 리드 레이어(Cognism/Apollo류 — 연락처/워크플로우 DB)가 아니라
  리포트 레이어(기업 자체에 대한 구조화된 AI 리서치)를 다루는 제품

## 검증 테스트 설계 (2026-08-11)

**검증할 단일 문제 (넓은 "기업 리서치가 오래 걸린다"가 아니라 이걸로 좁힘)**:
AE가 미팅 전 "이 회사가 왜 지금 이 문제로 아픈가"를 스스로 진단하는 데
1시간 정도 걸리거나(기존 제품 약속 "1시간→20분"), 아예 안 하고 감으로 때운다.
(주의: r/techsales의 "30~45일"은 계정 리스트/영업구역 전체 조사 기간이지
미팅 1건 준비 시간이 아님 — 2026-08-11에 이 둘을 한 번 혼동해서 원페이지에
잘못 적용했던 적 있음, 다시 섞지 말 것)

**가치 기준 3개 — 각각 따로 질문할 것, 뭉뚱그리지 말 것**:
1. **속도**: 기존 방식(1시간 또는 감) 대비 몇 분이면 의미 있다고 느끼는지
2. **뎁스**: 실물(NVIDIA financials_v2 벤치마크 코멘트, 크로스인더스트리
   넛지 샘플)을 직접 보여주고 "이 정도면 미팅에서 바로 쓸 질문이 나오는가,
   아직 얕은가" — r/techsales의 hanksauce55 반박("AI는 신호 연결·추론을
   아직 못한다")을 정면으로 검증하는 질문
3. **신뢰성**: 출처 뱃지(🟢SEC 공식 등)가 실제 신뢰를 주는지, 장식으로
   느껴지는지

**지불 의사(WTP) — 막연히 묻지 말고 앵커 가격 제시**:
"$0(무료), $10, $30, $49(ChatAE 동일 기준점), $99 — 어디까지 실제 결제
의향이 있는가, 지금 카드 꺼낸다면 어디까지인가"

**결제 방식 — SSOT의 "$30 개인카드, 예산승인 없이" 가정 자체를 검증**:
"본인 카드로 개인 결제할 것인가, 회사에 요청해 법인카드/팀 계정으로 쓸
것인가, 회사 IT 정책상 개인이 외부 AI 툴 가입 자체가 막혀있는가" — 미국
엔터프라이즈 문화(회사가 도구를 사주는 문화, Sales Nav/ZoomInfo 등 이미
지급된 스택)가 개인 결제 시장을 얇게 만들 가능성 있음, 직접 확인 필요.

이 질문지를 AE 인터뷰(3~5명 목표, 2026-08-11 1명 완료)와 레딧 포스팅에
그대로 반영할 것.

## 시장 검증 현황 — 레딧 (2026-08-11)

**포스팅**: r/Sales_Professionals에 "How do you build account diagnosis before a
discovery meeting?" (Question 플레어, 링크 없음). 조회 1.9K, 좋아요3/싫어요8
(투표는 부정적, 댓글은 우호적 — 이 괴리가 다음 포스팅에서도 반복되는지 지켜볼 것),
댓글 다수.

**핵심 발견 — "sharp vs generic insight" 정의**: 사실 나열이 아니라 그 사실의
함의(결과)까지 붙어야 날카로운 인사이트라는 원칙(레딧 댓글에서 확인) — 넛지,
벤치마크 코멘트 등 모든 콘텐츠의 품질 기준으로 삼을 것.

**Counter-evidence (정직하게 기록)**:
- hanksauce55(r/techsales): AI는 신호 연결·추론을 아직 경험 많은 AE만큼 못한다는
  반박 — 1min은 "AI가 판단 대신"이 아니라 "판단 재료 준비"로 포지셔닝하면 대응 가능
- Ok_Needleworker_6706: 공개 데이터 기반 트리거는 아무리 좋아도 추측이고, CRM/이전
  통화 기록 같은 확인된 사실이 더 강력하다는 지적 — 1min이 만드는 건 "1차 가설"이지
  "확정 사실"이 아니라는 한계를 정직하게 포지셔닝해야 함

**강력한 지지 증거**:
- u/hungry2_learn: "LLM에 회사정보+ICP 저장 → 컨텍스트로 타겟별 각도 뽑기" 워크플로우를
  이미 수작업으로 하고 있음 — 1min이 자동화하려는 것과 정확히 일치, 강력한 GTM 카피 소스
- u/weisswurstseeadler: 채용공고/신규채용이 pain 신호로 가장 강력하다는 실전 사례
  (ROI 계산 포함) — 백로그 "비정형 신호" 항목 검증
- 세일즈포스 직원(오프라인 관찰): 사내 슬랙 봇 있지만 "사실 나열 수준, 진단까지는
  안 감" — 대기업 인프라 있어도 diagnose 레이어는 미해결
- Salesforce 경영진 AX 철학: "필드 대면 외엔 AI에게 맡겨라" — hanksauce55 반박과
  정면 대비, "AI가 판단 재료 준비" 포지셔닝이 둘 다 충족시킴

**경쟁사 분석 (ChatAE, Outreach, AlphaSense)**: 포지셔닝 사분면 — X축(사실나열↔진단해석)
× Y축(개인셀프서브↔팀엔터프라이즈). **빈 사분면 = 개인 셀프서브 + 진단해석** —
ChatAE(개인가격, 사실나열), Outreach/AlphaSense(엔터프라이즈가격, 실행/리서치) 어느
쪽도 이 자리에 없음. ChatAE 창업자(Dustin Beaudoin)는 AE 출신 — 본인이 문제 겪은
실무자가 좁은 기능(콜 준비 자동화)으로 시작한 패턴, 1min과 유사한 출발점. 이 빈자리가
"구조적으로 아무도 안 감"(VC 자금 특성상 큰 ACV 필요)인지 "미국 문화상 회사가 도구를
사주는 관행" 때문인지는 미검증 — AE 인터뷰로 확인 필요.

## Stack
- **client/** — Next.js 15, TypeScript, Tailwind CSS (App Router, `src/` 구조)
- **server/** — Node.js, Express, TypeScript
- **DB** — Supabase (PostgreSQL)
- **AI** — Anthropic Claude claude-sonnet-5 (2026-08-15 claude-sonnet-4-6에서 전환) + web_search_20250305 tool

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

### ⚠️ 2026-08-15 발견 — MCP `apply_migration`의 버전 기록 포맷과 로컬 파일명 포맷이 애초에 안 맞았음

**배경**: Supabase MCP OAuth가 "Unrecognized client_id" 에러로 이번 세션에서 막혀서, 대안으로
Supabase CLI(`npx supabase`, MCP와는 별도 경로로 이미 로그인되어 있었음)로 마이그레이션 적용을
시도하다가 발견. `supabase migration list`를 돌려보니 로컬 파일 40개 전부가 원격(prod) 이력과
매칭이 하나도 안 됨 — 로컬 파일명은 `20260624_add_financial_cache.sql`처럼 날짜만 담고(그마저도
`001`이 2개, `20260703`이 5개처럼 같은 프리픽스가 여러 파일에 중복), MCP `apply_migration`이
원격 `supabase_migrations.schema_migrations`에 실제로 기록하는 버전은 `20260624094549`처럼
분·초까지 담은 전체 타임스탬프라, 애초에 문자열이 일치할 수 없는 구조였음.

**확인 절차 (실행 전 반드시 이렇게 확인할 것 — `db push` 먼저 돌리지 말 것)**: 이 불일치만 보고
"로컬 마이그레이션이 하나도 적용 안 됐다"고 오판해 `supabase db push`를 돌리면, CLI가 40개
전부를 "미적용"으로 보고 처음(`001_companies.sql`)부터 프로덕션에 실제로 재실행을 시도한다 —
매우 위험. 대신 읽기 전용 쿼리(`supabase db query --linked "SELECT ... FROM information_schema
.columns/tables WHERE ..."`)로 전체 기간에 걸친 테이블/컬럼 마커 18개를 직접 대조한 결과,
**기존 40개는 전부 이미 prod에 정상 적용돼 있음을 실측 확인** — 문제는 순수하게 버전 문자열
포맷 불일치였지, 실제 스키마 미적용이 아니었음.

**남은 미해결 사항(우선순위 낮음, 별도 정리 과제로 남김)**: 원격 이력에 로컬 어떤 파일과도
매칭 안 되는 `2026-07-02 22:55:38`/`23:45:39` 타임스탬프 2건이 있음 — git 이력에 삭제된
마이그레이션 파일도 없어 원인이 확실친 않으나, 그 시각을 KST로 환산하면 `2026-07-03` 새벽
(07:55/08:45 KST)이라 `20260703_*.sql` 배치(로컬 5개, 원격은 이 2건 포함 6건 매칭)가 적용될
때의 UTC/KST 표시 차이일 가능성이 높음. 실제 스키마 대조에서는 이상 없었으므로 데이터 손상
리스크는 없다고 판단 — 기존 40개 전체의 버전 이력을 CLI 기준으로 통째로 재정비하는 것도 이번
범위에서 제외, 필요해지면 별도 작업으로.

**오늘 신규 2건(`icp_insights.created_by`, `profiles.nickname`) 처리 방식**: 파일명을
`20260815120000_icp_insights_created_by.sql`/`20260815120100_profiles_nickname.sql`처럼
고유한 전체 타임스탬프 프리픽스로 리네이밍(이번 두 파일만 `20260815`를 그대로 공유해서 CLI가
구분을 못 하는 문제가 있었음) → `supabase db query --linked -f <파일>`로 DDL을 마이그레이션
이력 시스템 밖에서 직접 실행(둘 다 `IF NOT EXISTS`라 안전) → 읽기 전용 쿼리로 컬럼 실제 생성
확인 → `supabase migration repair --status applied <버전>`으로 이력에만 기록(SQL 재실행 없이
"이미 적용됨" 표시). `supabase migration list`로 이 2건만 local/remote가 정확히 매칭됨을 확인.

**재발 방지 원칙 — 앞으로 새 마이그레이션 파일명은 CLI 호환 고유 타임스탬프를 쓸 것**:
`YYYYMMDDHHmmss_설명.sql` 형식(초 단위까지, 같은 날 여러 개면 시각을 다르게)으로 통일 —
기존처럼 `YYYYMMDD_설명.sql`(날짜만)로 쓰고 같은 날 여러 파일을 만들면, MCP `apply_migration`로
적용하는 것 자체는 문제없이 성공하지만 이번처럼 CLI 도구(`db push`/`migration list`/
`migration repair`)와의 호환이 깨진다. MCP가 정상화되더라도 이 네이밍 규칙은 유지할 것 —
CLI가 유일하게 신뢰 가능한 대체 경로였다는 게 이번에 확인됐고, 다음에 MCP가 또 막힐 수 있음.

**dev 프로젝트 현재 상태**: `ininmbvzzdqplnfdnisf`("1min-dev")는 여전히 존재하지만 현재
운영에 실질적으로 쓰이지 않고 있음 — "dev 환경이 없다"는 뜻이 아니라 "있지만 이번
마이그레이션 검증에는 안 씀"이라는 의도적 결정(2026-08-15). 이번 2건은 **prod에만 적용됨**,
dev에는 미적용 — dev를 나중에 다시 활성화해서 쓰게 되면 이 마이그레이션도 그때 동일하게
재적용해야 함. 위 "규칙: 새 마이그레이션 파일 작성 시 반드시... prod + dev 둘 다" 원칙은 dev가
실제로 운영에 쓰이는 상태를 전제로 한 것 — 지금처럼 dev가 사실상 미사용 상태인 동안은 이
원칙이 잠정 보류됨.

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

**analyses**(추가 컬럼, 2026-08): `cross_industry_nudge_v1` (JSONB — 크로스인더스트리 넛지,
2배치. 상세는 "Pain 진단" 섹션 참고)

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

**industry_benchmark** (2026-08-11): `sic_code`(PK), `debt_equity_ratio_median/n`,
`cfo_revenue_ratio_median/n`, `operating_margin_median/n`, `asset_turnover_median/n`(배수, %아님),
`revenue_growth_median/n`, `source_quarters`, `computed_at`. SEC Financial Statement Data Sets
벌크 데이터(`data/raw/sec-financial-statements/`, gitignore됨) 4개 분기를 `server/scripts/
secBenchmarkPrecompute.ts`로 파싱·집계 — SIC당 표본 5개 미만 지표는 null, 평균이 아니라
중앙값 저장(작은 표본에서 평균이 극단치에 취약한 문제 발견, 상세는 Quality Gate 원칙 섹션
참고). 기존 `industry_benchmark_cache`(라이브 캐시, 이 앱에서 검색된 기업만 대상이라 표본
좁음, `financials_v2.industry_benchmark` 구조화 필드로 첨부)와는 완전히 별개 시스템 —
이쪽은 SEC 전수 벌크 기반 대표본이고, `server/src/lib/secIndustryBenchmark.ts`가 financials_v2
생성 직전에 EDGAR 소스 기업의 SIC를 조회해 회사 자신의 수치와 업종 중앙값을 서버에서 직접
비교, ±30% 이상 벗어난 지표만 골라 Claude 프롬프트에 주입(구조화 필드 아님 — narrative/
outlook 문장에 자연스럽게 녹아듦). 표본 부족 SIC는 수치 대신 "비교 데이터 부족, 직접 확인
제안" 안내만 주입, 벗어난 지표 없으면 벤치마크 자체를 언급 안 함(노이즈 방지). 인용 시
sources[]에 L1(🟢 공식) "SEC Financial Statement Data Sets, SIC {code}, n={표본수}" 추가.
DART/web_search 소스는 SIC 체계가 안 맞아 조용히 스킵. dev 프로젝트는 스키마만 있고
데이터는 비어있음(일회성 데이터 적재라 이번엔 prod만 — dev/ops 서버 분리 시 재실행 예정).

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
- 투자자 전용 언어 금지 (밸류에이션/수익률/PER 단독 언급, ROE/ROIC/Owner Earnings 등
  가치투자 프레임 지표 포함 — 2026-07-30 "Munger/Buffett Metrics" 섹션 위반 사례로 제거,
  아래 백로그 완료 목록 참고)
- Bull/Bear 금지 → 성장 모멘텀/핵심 리스크
- "확인 필요" 남발 금지 → 추정값이라도 출처와 함께 제공

### 재무 파생 지표 처리 원칙 (2026-08-15 확정 — Ford 세그먼트 매출 비중 오류 조사에서 촉발)

**상위 원칙**: 1min의 모든 재무 수치는 공식 F/S(EDGAR 원본 공시)에 실제로 존재하는 값만
표시한다. Claude가 계산·추정·재구성한 재무 수치는 만들지 않는다. F/S에 없는 값은 그 항목
자체를 안 보여준다("확인 필요"나 억지 추정으로 채우지 않음) — 정확성이 담보 안 되는 계산값
보다 "없으면 없다고 보여주는" 쪽이 신뢰성 원칙에 부합. 이 원칙 아래 다섯 가지를 확정:

1. **EBITDA 미표시.** GAAP 표준 계정과목이 아니고, 계산하려면 감가상각비(D&A)가 필요한데
   회사마다 현금흐름표 내 위치·태그가 달라 안정적으로 자동 추출이 안 됨. 직접 계산해서
   보여주는 것 자체가 신뢰성 리스크라 아예 노출하지 않는다.
2. **매출총이익(Gross Profit)은 EDGAR/DART가 직접 제공하는 태그값만 표시**, 매출-매출원가로
   역산하지 않는다. 태그가 없으면(예: Ford Motor처럼 제조+금융 결합 구조라 이 라인 자체가
   공시에 없는 경우) "해당없음"으로 그대로 노출.
3. **매출 라인 구분(세그먼트/제품 매출 비중)은 F/S에 실제로 나뉜 대로만 표시**(2026-08-15
   신설) — 회사마다 나누는 축이 다르다(Ford=사업부 축, Apple=제품 카테고리 축, NVIDIA=라인
   구분 없음). 축 종류·라인 개수를 미리 정해두지 않고 `financials_v2.revenue_lines`가
   회사의 실제 라인명·값을 그대로 담는다(`edgar.ts`의 `fetchRevenueLineItems()`가 SEC
   R.htm을 직접 파싱 — companyfacts/companyconcept JSON API는 XBRL 차원(axis/member)이
   붙은 값을 통째로 걸러내 도달 불가능함이 실측 확인됨). 라인 구분이 없는 회사는 이 필드
   자체가 없고, 그 경우 매출 구성 섹션 자체를 스킵한다(Total Revenue 한 줄만 손익계산서에
   남음). **`summary_v2.products`/`business_model_v2.revenue_streams`의 `revenue_share`(%)
   필드는 완전히 제거됨** — 웹서치 기반 자유추정치였고, 두 필드가 같은 회사를 놓고 서로
   다른 %를 만들어내는 사고(Ford Credit이 한쪽 탭엔 12%, 다른 탭엔 7%로 나온 사고, 실제
   정답은 7.09%)가 실측으로 재현됨 — `revenue_lines`가 유일한 매출 비중 출처가 되도록
   두 필드는 이제 이름+정성적 설명(무엇을 하는 사업부/제품인지)만 생성한다.
4. **문서 소스는 반드시 10-K(연간 보고서) 기준 — 10-Q 잠정치를 섞지 않는다.** EDGAR 라이브
   조회 경로(`edgar.ts`)와 DART(사업보고서만, `reprt_code=11011`)는 이미 만족하고 있었고,
   월간 배치(`edgarBatchPrecompute.ts`)만 `20-F`(외국 민간발행인) 필터가 빠져 라이브
   경로와 불일치했던 걸 통일함(2026-08-15).
5. **회계연도 라벨은 회사가 쓰는 표기 그대로, 고정 창을 쓰지 않는다.** SEC XBRL의 `fy`
   필드(회사가 자기 10-K 표지에 태깅한 연도) 추출 자체는 이미 정확했지만, 그 다음 단계에서
   `fy2021~fy2025`/`fy2023~fy2025` 같은 리터럴 5년/3년 창으로 욱여넣고 있었다 — 이미 오늘
   기준 NVIDIA의 최신 회계연도(FY2026, 1월 결산)가 이 리터럴 창 밖으로 밀려나 드롭될
   뻔했음을 실측으로 확인. `financialsTableBuilder.ts` 등에서 회사가 실제로 보유한
   연도만 동적으로 렌더링하도록 전환(2026-08-15) — **V1 스키마로 캐시된 기존 분석은 이
   수정이 소급 적용되지 않음, 재분석해야 반영됨.**

### 콘텐츠 포맷 원칙 (2026-08-12 신설)
필드 성격별로 서술 방식을 고정한다 — 전부 문단으로 몰아쓰지 않는다:

1. **수치 비교(회사 vs 벤치마크)는 문장이 아니라 시각 컴포넌트로** — financials_v2의 SEC
   산업 벤치마크가 대표 사례: 막대 두 개(이 회사 / 업종 중앙값) + 해석 한 줄
   (`SecBenchmarkComparisonBlock`, `AnalysisCard.tsx`). 숫자 자체는 narrative/outlook 같은
   서술형 필드에서 반복하지 않는다(KPI 카드·막대비교와의 숫자 중복 방지) — narrative는
   벤치마크 컨텍스트를 아예 안 받으므로 자연히 언급하지 않게 됨(`server/src/lib/
   secIndustryBenchmark.ts`, `analyzeCompany()`의 sharedContext와 분리된 별도 경로).
   비교값이 없는 지표(업종 중앙값 대비 ±30% 미만 차이, 또는 표본 부족)는 컴포넌트 자체를
   스킵 — 매번 코멘트를 강제하면 노이즈가 된다.
2. **일반 서술형 필드(문단 유지 대상)** — value_chain_v2의 value_flow/subject_position,
   strategy_v2의 strategy_coherence/ten_year_durability 등: 문단 형식은 유지하되 [n] 각주는
   반드시 문장 끝에만(문장 중간 삽입 금지, 여러 출처면 "...다[1][2]." 처럼 끝에 붙여쓰기),
   길이는 3-4문장으로. `SECTION_SCHEMAS`에 "every [n] source marker must sit at the very end
   of the sentence" 형태로 명시.
   - **`strategy_coherence`만 추가 예외(2026-08-13)**: 문단 유지 원칙(불릿 전환 아님)은
     그대로지만, 하나의 긴 문단으로 뭉치지 않도록 **2~3개의 짧은 문단(빈 줄 "\n\n"으로
     구분, 각 2~4문장)으로 분할**하도록 프롬프트에 명시 — 1문단 "3개 전략 블록이 어떻게
     연결되는가", 2문단 "그 연결이 만드는 재무적 결과", 있을 때만 3문단 "남은 리스크/전제조건".
     프론트(`AnalysisCard.tsx`의 `StrategyV2Tab`)도 `whitespace-pre-line`을 추가해야
     실제로 문단이 나뉘어 보임 — 기본 `white-space:normal`이면 `\n`이 공백으로 뭉개져서
     프롬프트만 고쳐선 화면상 변화가 없다.
3. **시계열/단계형 콘텐츠는 처음부터 구조화 필드로** — industry_history_v2의 timeline,
   tech_evolution_v2의 stages, founder_v2의 career_trajectory 전부 이미 배열 스키마 + 전용
   타임라인/카드 UI(`IndustryHistoryV2Tab`/`TechEvolutionV2Tab`/`FounderV2Tab`)로 렌더링되고
   있음(2026-08-12 재확인, 문단 프롬프트로 되어 있지 않은지 실측 샘플로 검증 완료) — 새로 시계열류
   필드를 추가할 때는 처음부터 이 패턴(배열 스키마 + 점/선 타임라인 또는 카드 리스트)을
   따를 것, 문단 서술로 시작한 뒤 나중에 구조화로 바꾸지 말 것.
4. **비동기 액션은 클릭 즉시 눈에 보이는 상태 변화 필수** — "pain 진단 시작" 버튼처럼 결과가
   나오기까지 수 분 걸리는 액션은, 클릭 즉시(요청 성공/실패와 무관하게) 토스트 안내를 띄우고
   버튼/탭 콘텐츠가 로딩 상태로 전환되어야 한다. targetId 등 필요한 값이 없어 요청 자체를 못
   보내는 경로도 침묵 리턴 금지 — 반드시 토스트로 알림(2026-08-12, "클릭했는지 불확실해서
   재클릭/이탈" 버그 수정 계기 — `HomeContent.tsx`의 `handlePainDiagnosisStart`,
   `showToast` 재사용). 읽기 전용 화면(히스토리/공유 링크처럼 트리거 핸들러 자체가 없는
   곳)은 액션 가능한 것처럼 보이는 CTA를 아예 노출하지 말 것 — 눌러도 안 되는데 버튼처럼
   보이면 그 자체가 불확실한 상태 표시다.
5. **출처는 "무엇에 대한 사실인가"로 구분해서 인용** — 회사 자체 공식 자료(10-K, IR,
   보도자료)는 그 회사에 대한 사실(자기 매출, 자기 세그먼트 구성 등)에만 쓴다. 산업 전반의
   역사/트렌드/경쟁사 동향 서술에는 반드시 web_search로 찾은 외부 출처(기술사 자료, 업계
   리포트, 언론)를 별도로 인용 — 회사 출처를 산업 서사에 재사용 금지. 항목 수 대비 각주
   개수가 지나치게 적으면(예: 6개 시대에 출처 1-2개) 출처를 대충 재사용하고 있다는 신호이니
   점검할 것. 2026-08-12 실측(NVIDIA industry_history_v2)으로 확인된 사례 — NVIDIA 자체
   SEC 공시/IR 출처가 "GPU가 병렬처리 아키텍처의 기초를 놓았다", "정부가 소버린 컴퓨트에
   수천억 달러 투입 중" 같은 산업 전반 주장 4곳에 재사용되고 있었음(그 회사 공시가 뒷받침할
   수 없는 내용). `SECTION_SCHEMAS`의 industry_history_v2/tech_evolution_v2에 "Sourcing
   discipline" 지시로 명시.

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
- 최상위 3단 탭 구조 (2026-08): Company Intelligence / Pain Diagnosis / AE Skills — 기존
  좌측 사이드바 기업분석/pain 진단 2그룹은 각각 앞의 두 탭 안으로 편입(사이드바 로직 자체는
  그대로, `AnalysisCard.tsx`의 `activeGroup` prop으로 필터링만 추가). AE Skills는 검색/로그인
  플로우와 완전히 분리된 별도 뷰(카테고리 칩 + 카드 피드), 무료 뱃지 + 로그인 게이트 없음.
  상단 탭 상태는 URL에 반영하지 않음 — 새로고침 시 Company Intelligence로 리셋.

### 언어 정책 (2026-08-12 재개정 — 다국어 토글 재도입, 솔루션 앱 전체 + PDF만 대상)
- **배경**: 2026-08 초 "영어 단일 고정" 결정(바로 아래 이력 참고)을 한국 BD/전략 담당자
  수요 확인으로 번복. 그 전에 한 번 설계됐다가 실행 없이 대체된 계획(2026-08 이전, "브라우저
  언어 감지 + EN/KR 토글 + analyses.language 컬럼" — 아래 이력의 "(구)" 항목)의 핵심 설계
  (DB 컬럼으로 언어별 캐시 분리, 토글 UI, 프롬프트 언어 분기)는 그대로 되살리되, 브라우저
  자동감지는 VPN/여행 시 오작동 사례 때문에 이번엔 의도적으로 넣지 않음.
- **기본값**: EN. 자동감지 없음 — 첫 방문 시 무조건 영어, 유저가 직접 바꿔야 함.
- **토글 위치**: 계정 설정(`/settings`) 페이지 내 수동 토글, `localStorage`에 저장
  (`LanguageContext`, 키 `1min_language`) — 헤더 상단 등 다른 위치엔 없음.
- **적용 범위**: 랜딩페이지(Framer, GTM용)를 제외한 솔루션 앱 전체 — 헤더 네비/설정
  페이지/히스토리 페이지/온보딩/검색 화면 + 리포트 8~9개 탭(요약/산업역사/기술변화/밸류체인/
  비즈니스모델/경쟁사/전략/재무/창업자) + PDF 출력. **AE Skills 탭은 제외**(콘텐츠 자체가
  아직 하드코딩 더미 스텁이고 실 콘텐츠 파이프라인은 별도 백로그 대상이라 지금 번역해도
  나중에 다시 갈아엎게 됨) — AE Skills는 토글과 무관하게 계속 한국어 고정.
- **DB**: `analyses.language` 컬럼(`'ko'|'en'`, 기본 `'en'`)으로 캐시 완전 분리 — 동일
  기업이라도 언어별로 별도 `analyses` 행에 저장(KR 캐시 ≠ EN 캐시). `company_id` 조회에는
  원래 unique 제약이 없어(`forceRefresh`로 이미 다중 행이 생기는 구조) language 축 추가가
  기존 캐시 조회 로직과 충돌하지 않음.
- **프롬프트 분기는 최종 합성(synthesis) 단계에서만** — `server/src/lib/claude.ts`의
  `SECTION_SYSTEM`, `callFounderSection`의 인라인 시스템 프롬프트, `GROWTH_SCENARIO_
  NARRATIVE_SYSTEM`, `SEC_BENCHMARK_INTERPRETATION_SYSTEM` 4곳에서 "Generate all content
  in {Korean/English}"로 분기. 반대로 `gatherResearch1/2`/`gatherFinancialResearch`(원자료
  웹서치 수집 단계)는 언어와 무관하게 계속 영어 검색 유지 — 영어 검색이 SEC 공시/뉴스 등
  권위 있는 소스를 더 잘 찾아내므로, 리서치는 언어 중립으로 모으고 최종 텍스트 생성 단계에서만
  선택된 언어로 번역·합성한다. `SECTION_SCHEMAS`의 JSON 스키마 설명 텍스트 자체는 건드리지
  않음 — 필드 값의 언어는 `SECTION_SYSTEM`의 전역 지시 하나로 충분히 따라감.
- **플레이스홀더/추정 마커도 언어별 분기**: EN 모드는 "Not disclosed"/"Not applicable"/
  "(estimated)", KR 모드는 "확인 필요"/"해당없음"/"(추정)". 2026-08 영문 단일화 때 클라이언트가
  이 두 마커 셋을 전부 OR-매칭하도록 이미 갱신해뒀으므로(`AnalysisCard.tsx`의 DataValue/
  isNoData/isUnknown/IS_BOLD_ITEMS, `financialsReliability.ts`, `AnalysisPdf.tsx`) 이번
  재도입에서 클라이언트 마커 매칭 로직은 추가 변경 없이 양방향으로 그대로 재사용됨.
- **DART 컨텍스트는 계속 한국어 라벨 유지** — `buildDartContext`(financialContext.ts)는
  언어 토글과 무관하게 그대로(기존 테스트용, 신규 개발 제외 원칙 유지). Claude가 한국어
  인풋을 읽고 EN/KR 어느 쪽으로도 정상 합성하는 것은 2026-08 영문화 때 이미 검증됨.
  DART 소스 기업이라도 최종 산출물 언어는 전적으로 `SECTION_SYSTEM`의 지시를 따름.
- **기존(마이그레이션 이전) analyses 레코드는 변환하지 않음** — `language` 컬럼이 `DEFAULT
  'en'`으로 채워지는데, 2026-08 영문 단일화 이후 생성된 레코드는 실제로도 전부 영어라 이
  기본값이 대부분 정확함. 그 이전의 극소수 한국어 레거시 레코드만 라벨 불일치 가능성이
  있으나, 영문 단일화 때와 동일한 선례(과거 캐시 미변환, 자연 캐시 교체에 맡김)를 그대로
  따름 — 별도 백필 없음.
- 검증(2026-08-12): Rocket Lab으로 EN/KR 둘 다 `analyzeCompany()` 직접 호출 생성 —
  8~9개 탭 전부 채워짐, `-999`/빈 마커 없음, `[n]` 출처 각주 정상, KR 모드 플레이스홀더가
  "확인 필요"/"해당없음"/"(추정)"으로 정확히 나옴, PDF 한글 볼드(700) 렌더링 확인.

**(구) 2026-08 초 "영어 단일 고정" 이력** (번복되어 더 이상 유효하지 않음, 기록만 유지):
- (2026-08 이전) "브라우저 언어 감지 + EN/KR 토글 + analyses.language 컬럼으로 캐시 분리"
  계획이 한 번 설계됐다가 실행 없이 대체됨(DB에 language 컬럼이 존재한 적 없었음).
- (2026-08 초) 위 계획을 취소하고 Claude 분석 프롬프트 전체를 영어로 통일 — 톤은 미국 B2B
  실무자(Sales/BD/Strategy) 어조(Gong/HubSpot/Salesforce 블로그 톤, McKinsey 리포트체 아님),
  투자자 언어(밸류에이션/PER/ROE 단독 언급) 금지는 유지. 검증: TSLA·Adobe로 `analyzeCompany()`
  직접 호출해 결과 JSON에 한글 문자 0건 확인.

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

### 분석 배치 구조 (1차/2차/온디맨드/3차) — 2026-08 재편
> 2026-08 이전엔 2/3/4/5 네 배치(총 5개, financials가 4배치·founder가 5배치 단독)였고
> industry_history_v2/tech_evolution_v2는 "탭을 여는 순간 자동 생성"하는 온디맨드였다.
> 이번 재편으로 (1) cross_industry_nudge_v1이 2배치에 신규 추가되고, (2) financials_v2가
> 3배치로, founder_v2가 4배치로 이동해 동기 배치가 4개로 줄었고(진행바 분모도 5→4), (3)
> industry_history_v2/tech_evolution_v2는 "탭 오픈 자동생성"에서 "pain 진단 시작" 버튼
> 명시적 클릭 트리거로 바뀌면서 완전히 별도 엔드포인트로 분리됐다. 상세는 아래 "Pain 진단"
> 섹션 참고.
- **1차** (목표 60초 이내, 완료 즉시 요약/재무 탭 렌더링):
  - 1배치 (병렬 1개): summary_v2
  - fin_preview: EDGAR/DART 캐시·라이브 raw 데이터로 재무 탭 즉시 프리뷰 (batch3 Claude 응답 이전)
- **2차** (1차 이후 백그라운드로 계속 처리 — **2/3/4배치는 순차가 아니라 단 하나의
  `Promise.all([runBatch(2,...), runBatch(3,...), runBatch(4,...)])`로 전부 동시에
  시작됨**, `server/src/lib/claude.ts`의 `analyzeCompany()` 참고. 번호는 배치 식별용일 뿐
  실행 순서와 무관 — 각 배치는 완료되는 즉시(그 배치 내부 Claude 호출들이 끝나는 순간)
  개별적으로 SSE 전송 + DB 저장되므로, 실제 완료 순서는 그때그때 API 응답 속도에 따라
  달라진다. 코드 주석에도 "financial_cache 히트 시 batch3(financials)가 가장 먼저
  완료될 수 있음"이라고 이 비순차성이 명시돼 있음):
  - 2배치 (병렬 3개): business_model_v2, competitors_v2, cross_industry_nudge_v1
  - 3배치 (병렬 3개): value_chain_v2, strategy_v2, financials_v2 (Rule 4 YoY 추정뱃지 로직도 이 배치 merge에 포함)
  - 4배치 (병렬 2개): founder_v2, sources
- **온디맨드** ("pain 진단 시작" 버튼 클릭 트리거, 2026-08): industry_history_v2(산업역사),
  tech_evolution_v2(기술변화) — 상세는 아래 "Pain 진단" 섹션 참고.
- **3차** (2차 전체 완료 후, revenue_history 3개년 이상 확보된 기업만):
  - 6배치: growth_scenario_v2 — 몬테카를로 매출 시뮬레이션 (순수 계산, 프리미엄 전용 탭)
- 각 배치 완료 시 즉시 Supabase DB 저장 + SSE(`batch` 이벤트)로 프론트엔드 반영
- 캐시 미스(EDGAR/DART 라이브 조회)로 1차가 60초를 넘길 수 있는 경우 `meta` 이벤트로
  `isFirstLookup: true` 전달 → 프론트에 "처음 조회하는 기업이라 조금 더 걸려요" 안내
- 배치 타임아웃: 75초 (1~4배치만 — 온디맨드 pain 진단은 별도 10분 타임아웃, 아래 참고)
- 배치 실패 시 해당 섹션만 "—" 표시, 나머지 계속 진행
- 상단 진행바: "배치 N/4 완료" 표시 (6배치는 진행률 계산에서 제외 — 프리미엄 전용이라 대부분 유저에게 미노출)

### Pain 진단 (2026-08 신규)
사이드바를 "기업분석"(요약/밸류체인/비즈니스모델/경쟁사/전략/재무/창업자/성장시나리오)과
"pain 진단"(넛지/산업역사/기술역사) 두 그룹으로 분리 — `client/src/app/components/
AnalysisCard.tsx`의 `TAB_GROUPS`/`TABS`(각 탭에 `group: 'company' | 'pain'` 필드 추가).
탭 바 UI는 그룹 라벨만 덧붙인 것이라 개별 탭 버튼(체크마크/스피너/tooltip)은 기존과 동일.

- **크로스인더스트리 넛지** (`cross_industry_nudge_v1`, 신규 탭 key `cross_industry_nudge`):
  2배치에서 business_model_v2/competitors_v2와 함께 즉시 생성 — 별도 트리거 불필요, 배치2
  완료 시 바로 표시. 스키마: SIC/KSIC 업종 공통 pain 1개(`industry_pain`) + 타산업 해결
  사례 1개(`cross_industry_example`), 둘 다 출처 URL 필수(다른 섹션과 달리 `sources[].url`을
  null로 두는 것 금지 — 못 찾으면 그 fact 자체를 드롭). `financial_impact_question`은
  프롬프트에서 질문형으로만 서술하도록 강제(숫자/비율/금액을 사실처럼 단정 금지) — "이 문제가
  분기 매출의 몇 %에 영향을 줄 수 있을까요?" 같은 형태만 허용, "매출의 15%를 위협"처럼
  단정하는 문장은 금지. 기존 🟢🟡⚪ 출처 뱃지 시스템(`SectionSource`, L1/L2/L3) 그대로 재사용 —
  새 뱃지 체계를 만들지 않음.
- **산업역사/기술역사** (`industry_history_v2`/`tech_evolution_v2`): "pain 진단 시작" 버튼
  클릭 1번으로 **둘을 동시에** 생성(신규 `POST /api/analyze/:id/pain-diagnosis`, body
  `{ companyName }`, 로그인 필수·소유권 체크 없음 — `/reanalyze`와 동일한 공용 캐시 협업
  설계). 내부적으로 기존 `reanalyzeSingleSection()`을 그대로 재사용(`Promise.all`로 두 섹션
  병렬 호출) — 새 생성 로직을 만들지 않음. 두 섹션 각각 실측 90~106초 걸리는데 병렬로 돌려도
  기존 75초 배치 타임아웃으로는 부족해 **전용 10분 타임아웃**(`PAIN_DIAGNOSIS_TIMEOUT`)을
  따로 둠. 이미 둘 다 DB에 있으면(캐시) 재생성 없이 즉시 반환.
  - **UI**: 클릭 전 두 탭 모두 "산업 역사와 기술 변화를 함께 진단해요. 약 7~10분 소요될 수
    있어요." + "pain 진단 시작" 버튼(`PainDiagnosisStart` 컴포넌트) 노출. 클릭 후엔 두 탭
    모두 `SectionGenerating` 스피너("최대 10분 정도 소요될 수 있어요") → 완료되는 대로 각자
    표시(둘 사이 완료 순서 보장 없음, 기존 온디맨드와 동일한 특성). 실패 시(버튼을 이미
    눌렀는데 여전히 데이터 없음) 기존 "↻ 다시 분석" 단일 섹션 재시도 링크로 폴백.
  - **기존 "탭 오픈 시 자동생성" 방식은 완전히 제거됨** — `AnalysisCard.tsx`의
    `autoGenTriggered` useEffect 삭제, `painDiagnosisStarted` 로컬 state로 대체(이번 화면
    방문에서 버튼을 눌렀는지만 추적, CTA ↔ 실패 폴백 UI 분기용).
  - 기존 `/api/analyze/reanalyze`(`section: 'industry'` / `'tech'`)는 그대로 살아있음 —
    개별 섹션 하나만 재시도할 때(실패 폴백 링크)는 여전히 이 범용 엔드포인트를 사용, 새
    전용 엔드포인트는 "처음 함께 생성"할 때만 쓰인다.
- DB 컬럼(`industry_history_v2`/`tech_evolution_v2`)은 생성 전까지 `null` — "생성 실패"와
  "아직 생성 안 함"을 구분하기 위해 빈 placeholder 객체 대신 명시적 null 사용(2배치/3배치
  캐시 히트 판정에서도 이 두 필드는 제외됨). `cross_industry_nudge_v1`는 2배치 소속이라
  다른 배치2 필드(business_model_v2 등)와 동일하게 항상 채워짐(실패 시 빈 placeholder
  객체로 폴백, null 아님).
- industry_history_v2와 tech_evolution_v2는 서로 완전히 독립된 별도 웹서치 요청(같은
  버튼 클릭으로 동시에 시작은 하지만 내부적으로 별개 `reanalyzeSingleSection` 호출)이라
  **둘 사이의 완료 순서 보장이 전혀 없음** — 실측(2026-08, MSFT/TSLA/NVDA 3개 기업):
  industry_history_v2 평균 103.3s, tech_evolution_v2 평균 94.7s로 매번 tech_evolution이
  약간 더 빠른 경향은 있지만(스키마상 타임라인 항목 수가 더 많아서로 추정) 절대적 선후
  보장은 아님 — tech_evolution 탭이 industry_history보다 먼저 완료되는 건 버그가 아니라
  설계상 정상 동작.

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
- (2026-08-12) 랜딩페이지는 영문 단일 유지, 솔루션 앱 전체(랜딩 제외)는 국영문 지원 —
  결정 번복 사유는 위 "언어 정책" 섹션 참조
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
   - 배치 구조로 요약 탭 먼저 표시 → 나머지 배치는 전부 동시 병렬 실행, 완료되는 대로 반영
     (번호 순서 보장 없음 — 상세는 아래 "분석 배치 구조" 참고)

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

### 🔵 탐색 중 (아직 확정 안됨 — 우선순위 미부여, 방향성만 잡힌 상태)
- [ ] AE Skills 콘텐츠 파이프라인 (VOC.md → DB화) — 최상위 3단 탭 중 "AE Skills"는
  2026-08에 UI 뼈대(카테고리 칩 + 카드 피드)만 먼저 구현됨(`AeSkillsView.tsx`, 하드코딩
  더미 카드 4개). 실제 콘텐츠는 VOC(고객 목소리) 수동 관리 문서(VOC.md — 현재 저장소엔
  없음, 팀 내 별도 관리 중으로 추정) → DB 스키마 설계 → 실 콘텐츠 적재 순서로 별도 작업
  필요. 카테고리 체계(전체/Discovery/협상/커리어)도 스텁 단계라 확정 아님.
- [ ] ICP 맞춤형 인사이트 탭 (Pain Diagnosis 내 선택 기능) — **트리거 패턴
  라이브러리 구조로 확장 (2026-08-12 심화)**
  - 근거: r/Sales_Professionals 댓글(u/hungry2_learn, u/Ok_Needleworker_6706,
    2026-08-12) — "사실이 아니라 결과(consequence)가 붙어야 날카로운
    인사이트"라는 원칙 + "LLM에 회사정보+ICP 저장해서 각도 뽑는" 워크플로우를
    사람들이 이미 수작업으로 하고 있다는 증거 (상세는 위 "시장 검증 현황 — 레딧" 참고)
  - **핵심 구조**: 매번 Claude한테 "날카로운 인사이트 찾아줘"라고 즉흥적으로
    맡기는 대신, **트리거 패턴 → 함의(consequence) 템플릿을 우리가 미리
    라이브러리로 정의**해서 일관성 있게 재현 (재현성 원칙과 정합적):
    1. 트리거 카테고리: 시장변화 / 기술변화 / 경쟁변화 / 투자변화 /
       재무상태변화(흑자→적자, CFO 부호 전환, 주요 비율 임계값 돌파 등)
    2. 각 카테고리별 "트리거 발생 시 통상적 함의" 템플릿 매칭
       (예: Series B 조달 → 헤드카운트 급증 → 기존 프로세스 붕괴)
    3. 설정에 등록된 ICP와 교차 — 같은 트리거도 AE가 파는 제품에 따라
       다른 함의로 해석
  - **다른 탭과의 차이**: 나머지 탭(재무/경쟁사 등)은 "정보" 제공, 이 탭은
    매칭된 패턴 기반 "가설" 제공 — 역할 명확히 분리
  - 설계 원칙: 설정 ICP 입력은 선택사항(제로 유저 레이버 원칙 유지),
    온디맨드 생성(캐시 불가, 유저별로 다른 결과)
  - **주의**: 패턴 라이브러리 자체가 별도의 콘텐츠 엔지니어링 작업 — 카테고리/
    템플릿 설계를 잘못하면 산업역사 출처 오매칭 같은 억지 매칭이 재발할 위험.
    실제 설계는 AE 인터뷰로 "어떤 트리거가 실제로 와닿는지" 검증 후 진행
  - 2026-08-12 논의, 아직 개발 범위 밖 — 구조만 기록, 설계는 보류
  - **(2026-08-15) 이 방향 대신 discovery_questions 2단계 통합으로 구현됨** — 트리거
    카테고리별 함의 템플릿을 미리 정의하는 대신, 이미 생성되는 9개 섹션 각자가 자기
    데이터에 근거한 질문 후보를 직접 만들어두고 ICP 탭에서 선별만 하는 구조로 결정.
    상세는 아래 "✅ 완료"와 Architecture 섹션 참고 — 이 항목(트리거 패턴 라이브러리)은
    설계 참고용으로만 남겨두고 더 이상 진행하지 않음.
- [ ] **비정형 신호 수집 (Unstructured signal harvesting)** — 채용공고/신규채용 트렌드를
  트리거 이벤트 후보로 쓰는 아이디어(근거: u/weisswurstseeadler 실전 사례, 위 "시장
  검증 현황 — 레딧" 참고). Greenhouse/Lever 같은 공개 ATS API로 채용 데이터를 저비용
  수집할 수 있는지 커버리지 검증 후 **보류(deprioritize) 확정**.
  - **2026-08-15 검증**: S&P500 샘플 30개 중 Greenhouse/Lever 매핑 성공 4개(13.3%,
    검증 후 오탐 2개 제외), Lever는 0건. 메가캡(시총 최상위) 14개는 0/14로 전멸 —
    1min 핵심 타겟(Enterprise AE가 다루는 대형 상장사)과 정확히 겹치는 구간에서
    커버리지 없음. 목표 기준(30~40%)에 크게 미달해 보류.
  - **재검토 조건**: 대형 기업이 표준적으로 쓰는 ATS(Workday/iCIMS 등) 공개 API 접근
    방법이 확인되면 그때 재고려.

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
- [x] 재무 탭 "Munger/Buffett Metrics" 섹션 제거 + 현금흐름 파이프라인 버그 수정
  (2026-07-30) — **콘텐츠 원칙 위반 사례**: ROE/ROIC/Owner Earnings/D-E Ratio/Interest
  Coverage/Reinvestment Rate 6개 지표는 가치투자 프레임 언어라 "투자자 전용 언어 금지"
  원칙을 정면 위반한 채 남아있었음(웹 `FinancialsV2Tab` + PDF `AnalysisPdf.tsx` 양쪽에
  각각 중복 렌더링 코드 존재) — 프롬프트 스키마/타입/기본값/AI비서 컨텍스트 문자열까지
  전 레이어에서 제거. 같은 세션에서 "SEC EDGAR 배치 데이터 — 현금흐름 미포함"이라는
  안내 문구가 실제 데이터 부재인지 확인 요청받아 조사 → **파이프라인 버그로 확정**:
  SEC 라이브 API로 TSLA의 `NetCashProvidedByUsedInOperatingActivities`/`InvestingActivities`/
  `FinancingActivities` 3개 concept을 직접 curl해 FY2025까지 정상 데이터 존재를 실측
  확인했는데도 화면에 안 뜬 이유는 3중 드롭: (1) `edgar.ts`의 라이브 fetch가 이 3개
  concept을 이미 가져와 단일연도 스냅샷(`financials.operatingCF` 등)에는 넣으면서
  다년도 `rawSeries`/`EdgarRawSeries`에는 안 실음(같은 함수 안에서 6개 필드는 다
  `align()`으로 넣으면서 CF 3개만 누락), (2) `financial_cache.raw_edgar`를 실제로
  채우는 월간 배치 `edgarBatchPrecompute.ts`(별도 실행 컨텍스트라 `edgar.ts` 로직이
  통째로 복제돼 있음)는 이 3개 concept을 애초에 한 번도 조회하지 않음, (3) raw 배치
  데이터 → 화면 변환 함수 `buildFinancialsV2FromRaw`(`analyze.ts`)는 입력값과 무관하게
  `cash_flow`를 무조건 하드코딩 — 셋 다 고쳐야 실제로 뜸. 세 곳 모두 수정(EdgarRawSeries에
  operatingCF/investingCF/financingCF 필드 추가, 배치 스크립트에 concept 조회 +
  context_text `[현금흐름]` 블록 추가, `buildFinancialsV2FromRaw`가 실제 값 있으면
  표시하도록 조건부 처리) + 값이 정말 없는 경우의 안내 문구를 소스별로 정확하게 분리
  (DART: "현금흐름 미지원", EDGAR인데 태깅 자체가 없는 기업: "현금흐름 태깅 없음" —
  "배치 데이터라서 없다"는 부정확한 표현 제거). DB 마이그레이션 불필요(JSONB 신규 키).
  교훈: 크론/배치 스크립트가 라이브 fetch 로직을 "별도 실행 컨텍스트"라는 이유로
  복제해서 쓰는 패턴(2026-07-04 revenue concept 버그도 동일 구조)은 한쪽만 고치고
  잊기 쉬움 — 필드 하나를 새로 추가할 때마다 두 파일 다 확인할 것.
- [x] Pain 진단 신규 + 사이드바 2그룹 분리 + 배치 재편 (2026-08) — 상세는 위 "분석 배치
  구조"/"Pain 진단" 섹션 참고. 신규: `cross_industry_nudge_v1`(배치2, 크로스인더스트리
  넛지), `POST /api/analyze/:id/pain-diagnosis`(산업역사+기술역사 동시 온디맨드 생성,
  10분 타임아웃). 배치 재편: financials_v2 4배치→3배치, founder_v2 5배치→4배치 이동,
  동기 배치 5개→4개(진행바 분모도 5→4). 사이드바: `TABS`에 `group` 필드 추가, "기업분석"
  8탭 + "pain 진단" 3탭(넛지/산업역사/기술역사). industry_history_v2/tech_evolution_v2의
  "탭 오픈 시 자동생성"은 완전히 제거되고 "pain 진단 시작" 버튼 명시적 클릭으로 대체.
- [x] 최상위 3단 탭 구조 (2026-08) — Company Intelligence/Pain Diagnosis/AE Skills.
  `HomeContent.tsx`에 `topTab` state(URL 미반영, 새로고침 시 Company Intelligence로 리셋)
  신규, 상단 탭 바 렌더링. Company Intelligence/Pain Diagnosis는 기존 검색+`AnalysisCard`
  플로우를 그대로 두고 `activeGroup` prop(`AnalysisCard.tsx` 신규)만 전달해 좌측 사이드바를
  해당 그룹 탭만 필터링 — 사이드바 컴포넌트/로직은 새로 안 만듦(기존 `TABS`/`group` 필드
  재사용), `activeGroup` 미지정 시(`ShareContent.tsx`) 기존처럼 두 그룹 다 표시해 하위호환
  유지. AE Skills는 검색폼+AnalysisCard를 통째로 숨기고 신규 `AeSkillsView.tsx`(카테고리 칩
  + 더미 카드 4개, 하드코딩)로 교체 — 로그인 게이트 없음(이 앱엔 middleware.ts가 없고
  로그인 체크가 "검색 실행" 등 특정 액션 단위로만 걸려있어, AE Skills 뷰는 그런 액션을
  아예 거치지 않으므로 자연히 무인증 접근이 됨, 별도 미들웨어 불필요). 실제 콘텐츠
  파이프라인(VOC.md→DB화)은 백로그 "🔵 탐색 중"에 별도 등록, 이번엔 UI 뼈대만.
- [x] SEC 산업 벤치마크(`industry_benchmark`) 신설 + financials_v2 프롬프트 연결 (2026-08-11)
  — 상세는 DB schema 섹션 "industry_benchmark" 항목 참고. SEC Financial Statement Data Sets
  벌크 데이터 4개 분기 파싱(`secBenchmarkPrecompute.ts`) → SIC별 부채/자본·CFO/매출·영업이익률·
  자산회전율·매출성장률 5개 지표 중앙값 집계 → EDGAR 소스 기업의 financials_v2 생성 시 회사
  자신의 수치와 ±30% 이상 벌어진 지표만 서버에서 골라 프롬프트에 주입(`secIndustryBenchmark.ts`).
  과정에서 평균이 소표본 극단치에 취약한 문제(SIC 6411 보험중개업 부채/자본 비율이 평균
  10,749%로 왜곡)를 발견해 중앙값 전환 + 분모 최소 기준 상향(매출 $10M/자본·자산 $5M)으로
  해결 — Quality Gate 원칙 섹션에 일반 원칙으로 기록됨.
- [x] ICP 인사이트 탭 → discovery_questions 2단계 통합 (2026-08-15) — 5카테고리
  insight+consequence 생성(2026-08-13) 대신, summary_v2/financials_v2/business_model_v2/
  competitors_v2/value_chain_v2/strategy_v2/industry_history_v2/tech_evolution_v2/founder_v2
  9개 섹션이 각자 프롬프트에서 `discovery_questions: string[]`(3-5개, 발표형 금지·질문형만,
  근거 없으면 빈 배열 허용)를 직접 생성해두고, ICP 탭 클릭 시 9개 섹션 + cross_industry_nudge_v1의
  기존 `financial_impact_question`(새 필드 추가 안 하고 재사용)까지 합쳐 후보 풀을 서버에서
  통합 수집(`server/src/lib/discoveryQuestions.ts`, 옛 `icpSignals.ts` 대체)한 뒤 3-5개만
  선별한다. ICP(icp_product/icp_target_industry/icp_target_role) 전부 비어있으면 Claude
  호출 없이 결정론적으로 선택(재무 벤치마크 이탈 있으면 financials_v2 우선 → 섹션 노출
  순서), 하나라도 있으면 `curateDiscoveryQuestions()`(claude.ts)가 후보 id 기반으로
  선별·경미한 재구성만 수행 — 반환된 id가 실제 후보 풀에 있는지 서버가 재검증해 근거 없는
  질문이 섞이는 걸 코드 레벨에서 막는다. financials_v2는 SEC 벤치마크 편차를 Claude가
  볼 수 없어(콘텐츠 포맷 원칙 1번, 이 숫자는 프롬프트 컨텍스트에 안 실림) `generateSecBenchmarkInterpretations`와
  같은 자리에서 `generateBenchmarkDiscoveryQuestion()`이 편차 소재 질문 1개를 별도로 만들어
  financials_v2.discovery_questions 맨 앞에 붙인다. `icp_insights` 테이블/fingerprint 캐시는
  기존 그대로 재사용(신규 테이블 없음), 응답 `content`만 `{ questions: [...] }` 형태로 변경.
  상세는 Architecture 섹션 "ICP 인사이트 discovery_questions 2단계 통합" 참고.
- [x] 재무제표 표시 원칙 5가지 확정 + `financials_v2.revenue_lines` 신설 (2026-08-15) — Ford
  세그먼트 매출 비중이 탭마다 12%/7%로 다르게 나오던 사고(정답 7.09%) 조사에서 촉발. EBITDA
  미표시/Gross Profit 원본 태그만/매출 라인은 F/S 그대로/10-K only/FY 라벨 그대로 5원칙 확정,
  `edgar.ts`의 `fetchRevenueLineItems()`가 SEC R.htm을 직접 파싱해 세그먼트/제품 매출 라인
  확보(companyfacts API로는 XBRL 차원이 붙은 값에 도달 불가), `summary_v2.products`/
  `business_model_v2.revenue_streams`/`segments`의 `revenue_share`(%) 완전 제거(이름+정성적
  설명만), 재무 연도 컬럼 고정 fy2021~fy2025 → 회사별 동적 렌더링. 상세는 Architecture 섹션
  "Ford 세그먼트 매출 비중 오류 조사 → 재무제표 표시 원칙 5가지 확정 + revenue_lines 신설"
  및 위 "재무 파생 지표 처리 원칙" 참고.

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
17. (2026-08-15) 16번에서 "고아 코드"로 판단해 제거한 `/api/cron/daily`(2026-07-16
    삭제)가 사실은 고아가 아니었음 — **Render 대시보드에 `render.yaml`과 무관하게 별도로
    존재하던 Cron Job(`latticework-daily-cron`, 매일 01:00 UTC)이 그 죽은 엔드포인트를
    지금까지 계속 호출하고 있었음**. 삭제 당시 감사는 "client 코드 전체 grep"까지만 했고,
    Render Cron Jobs 대시보드(이 repo의 `render.yaml`엔 `edgar-batch-monthly`/
    `dart-batch-monthly` 월간 배치 2개만 정의돼 있고, 이 daily cron은 거기 없음 — 즉
    Blueprint 밖에서 대시보드로 직접 만들어진 인프라라 코드 grep으로는 애초에 안 잡힘)까지는
    확인하지 않았음. 코드베이스 전체(server/client/scripts) 재검색 결과 `/api/cron/daily`·
    `selectDailyCompany`·`latticework-daily-cron` 참조는 이 CLAUDE.md 기록 외엔 전무 —
    **코드 쪽엔 삭제할 게 없고, Render 대시보드에서 이 Cron Job 자체를 직접 삭제하면 정리
    끝남**(사용자가 직접 처리 예정). 이 daily cron은 애초에 `edgarBatchPrecompute.ts`(월간
    EDGAR 배치)와 무관한 별개 기능(매일 랜덤 기업 1개를 골라 `analyzeCompany()` 전체를
    돌리는 자동분석)이었다는 점도 확인 — financial_cache 스테일 이슈와도 무관.
    교훈: **라우트/엔드포인트를 "아무도 안 부른다"고 판단해 제거할 때는 client 코드
    grep만으로 끝내지 말고 Render Cron Jobs 대시보드(특히 `render.yaml`에 없는, 대시보드에서
    직접 만들어진 서비스가 있는지)도 같이 확인할 것** — 애플리케이션 코드 밖에서 그
    엔드포인트를 호출하는 인프라는 grep으로 안 잡힌다.

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
- [ ] API 라우트/엔드포인트를 "안 쓰인다"고 판단해 제거할 때는 client 코드 grep뿐 아니라
  Render Cron Jobs 대시보드(`render.yaml`에 없는, 대시보드에서 직접 만든 서비스가 있을 수
  있음)도 같이 확인할 것 — 애플리케이션 코드 밖에서 그 엔드포인트를 호출하는 인프라는
  grep으로 안 잡힌다(2026-08-15 `latticework-daily-cron`이 이미 삭제된 `/api/cron/daily`를
  계속 호출하고 있던 사고, 실전 발견 이력 17번 참고)

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
- 각 섹션의 `discovery_questions`가 발표형("OO% 매출 의존이 있네요")으로 새지 않고
  질문형("의존도를 낮추려는 움직임이 있나요?")을 유지했는가 육안 확인(2026-08-15) —
  빈 배열은 정상(데이터 부족 시 허용), 전체 실패로 취급하지 않음

**산업 벤치마크 지표는 항상 중앙값(median) 우선, 평균(avg) 사용 시 최소 표본/분모 기준
필수** (2026-08-11, `industry_benchmark` 테이블 구축 중 발견) — 표본이 작은 그룹(n=5~20)은
상하위 1% 백분위수 윈저라이징조차 사실상 무의미하고(트리밍 경계가 최솟값/최댓값에 근접),
분모가 작은 표본 하나가 평균 전체를 극단치로 끌고 간다(실측: SIC 6411 보험중개업 부채/자본
비율이 자본이 작은 회사 1곳 때문에 평균 10,749%로 왜곡, 매출성장률 평균이 SIC별로 최대
+2,267%까지 튐). 평균 대신 중앙값으로 전환 + 분모 최소 기준을 매출 계열 $10M/자본·자산
계열 $5M로 상향하자 정상 범위로 돌아옴(`server/scripts/secBenchmarkPrecompute.ts` 참고).
앞으로 새 벤치마크/집계 지표를 추가할 때 평균을 쓰려면 이 두 방어(중앙값 우선 또는 표본/
분모 하한)를 먼저 검토할 것 — Data Aggregation Principles의 4단계 원칙과 동일 계열.

**`callSection()` 결과가 null이어도 성공 로그가 찍히던 결함 수정(심각도: 높음, 2026-08-15)**
— `extractJson()`이 JSON 파싱 실패로 `null`을 반환해도 `callSection()`은 함수 끝에서
무조건 `[claude] {sectionKey} OK`를 로그하고 있었음. `analyzeCompany()`의 병합 로직은
`null`을 받으면 `DEFAULT_ANALYSIS_DATA`의 빈 placeholder로 조용히 대체하는데, 로그만
보면 그 섹션이 정상 생성된 것처럼 보여 원인 추적이 막힘. 실전 발견: claude-sonnet-4-6→
claude-sonnet-5 전환 직후(같은 세션) Johnson & Johnson의 `strategy_v2`/
`cross_industry_nudge_v1`이 서술형 필드 때문에 고정 `max_tokens`(4000)를 넘겨 응답이
잘리며 파싱 실패 → 빈 데이터로 저장됐는데 로그는 계속 "OK". 두 가지로 수정: (1)
`callSection()`의 `max_tokens`를 4000→6000으로 상향(Sonnet 5 신규 토크나이저가 동일
내용도 ~30-35% 더 많은 토큰을 소비 — 근본 원인 완화), (2) `result`가 `null`이면
`[claude] {sectionKey} FAIL ... — JSON 파싱 실패로 null 반환, DEFAULT_ANALYSIS_DATA
빈 placeholder로 대체됨`으로 정확히 로그하도록 수정(claude.ts). Sonnet 4.6 때도 잠재된
결함이었을 가능성이 높음 — 그때는 우연히 응답 길이가 짧아 덜 걸렸을 뿐, 근본 원인(파싱
실패 시 로그 왜곡)은 모델과 무관하게 존재했음.
**⚠️ 미수정으로 남은 동일 계열 결함**: `analyzeCompany()`의 `runBatch()`도 같은 패턴 —
개별 `callSection()` 호출이 내부에서 에러를 catch해 `null`을 반환하면 `Promise.all`이
reject하지 않으므로, 배치 안 섹션이 전부 실패해도 `[claude] batch{N} OK`가 그대로
찍힘(2026-08-15 Amprius 재조사 중 발견, 아래 참고 — 이번 수정 범위에는 포함 안 됨).
**Amprius Technologies 요약 탭 빈 화면 재조사 결과(2026-08-15) — 원인 미특정, 닫지 않음**:
Render 프로덕션 서버 로그를 직접 조회해, 제보와 연결지었던 그 분석 건(2026-08-15 02:21 UTC)의
Claude 호출 8개(summary_v2/gatherResearch1·2/sec_benchmark_interpretations/competitors_v2/
sources/founder_v2/cross_industry_nudge_v1) 전부가 "You have reached your specified API
usage limits" 400 에러로 실패한 로그를 확인했다 — 이 세션에서 테스트 중 마주쳤던 바로 그
사용량 한도이며, **이전 Handoff에 남아있던 "이 한도가 프로덕션과 같은 키인지 미확인" 질문에
대한 확답**: 같은 키였고 실제 유저 트래픽도 이걸로 실패하고 있었음(이 로그 사실 자체는 확정).
다만 이걸 근거로 "Amprius 이슈 = API 한도로 해결, 별도 조치 불필요"라고 닫지는 않는다 — 이유:
(1) 이 로그 확인은 그 시각 그 한 건에 한정된 증거이지, 제보된 증상이 반드시 이 건을 가리키는지
별도로 확인되지 않았고, (2) 같은 세션에서 발견한 NVIDIA strategy_v2 사례(`stop_reason=end_turn`,
`output_tokens=2384`/8000 한도 — 길이초과 아님)가 **API 한도와 전혀 무관하게, 정상 종료됐는데도
JSON이 깨지는 별개의 미해결 메커니즘**이 실재함을 보여줘 "빈 탭" 증상 클래스 전체가 API 한도
하나로 설명되지 않는다는 게 같은 세션에서 드러났고, (3) 로깅/max_tokens 수정 후 Amprius를
1회(언어 ko) 재분석했을 때 8개 섹션 전부 정상 채워졌지만, 이건 "그 재실행 시점엔 재현 안 됨"을
보여줄 뿐 근본 원인이 확정됐다는 뜻은 아니다. **재발 시 이번에 추가한 디버깅 장치로 바로
확인할 것**: `callSection()` FAIL 로그의 `stop_reason`/`output_tokens`(길이초과 여부 판별),
`extractJson()` 파싱 실패 시 `server/debug-logs/parse-failures/`에 저장되는 원문 전체
(정확한 JSON 문법 오류 위치 확인, `.gitignore` 처리됨 — 커밋 안 됨).

### 프론트 진행 상태 표시 원칙 (2026-08-02 추가 — 체크마크/온디맨드 트리거 통합 버그 수정 계기)
- 탭 완료 체크마크(✓)는 반드시 "그 탭 데이터가 프론트 state에 실제로 존재하는가"만으로
  판정한다 — 배치 번호(progress 이벤트)를 대리 신호로 쓰지 않는다. 온디맨드 섹션(배치에
  속하지 않고 탭을 열 때 별도 생성되는 섹션, 예: industry_history_v2/tech_evolution_v2)이
  생기면 배치 번호 매핑은 그 시점부터 stale해지는데 코드에는 남아있기 쉬워, 아직 생성되지도
  않은 탭에 ✓가 뜨는 사고로 이어진다(`client/src/app/components/AnalysisCard.tsx`의
  `hasTabData` — 예전 `TAB_BATCH` 배치번호 매핑 버그 참고).
- prop에서 파생된 로컬 state(`useState(prop)`)는 prop이 이후 갱신돼도 자동 재동기화되지
  않는다 — 스트리밍처럼 같은 필드가 여러 단계(프리뷰 → 확정본)로 갱신되는 경우 반드시
  `useEffect(() => setLocal(prop), [prop])`로 재동기화할 것(`financialsV2Local` 버그 참고).
- 스트리밍 도중에만 유효해야 하는 트리거(탭 오픈 시 온디맨드 생성 등)는 스트림 전체 완료를
  나타내는 state(예: 최종 `result`)가 아니라, 훨씬 이른 시점(배치1)부터 채워지는 식별자
  기준으로 판단할 것 — 안 그러면 최종 완료 이벤트 이전엔 조용히 no-op되는데, 그 사실이
  "이미 시도함" ref 가드에 기록돼버려 이후 완료돼도 영구히 재시도가 막힐 수 있다(새로고침
  없이는 복구 불가 — `HomeContent.tsx`의 `handleReanalyzeTab` 버그 참고).
- 스트림의 최종 완료 페이로드가 서버의 in-memory 결과 객체(예: `analyzeCompany()` 반환값)에서
  조립되는 구조라면, 그 객체가 애초에 모르는 필드(위 온디맨드 트리거로 스트리밍 도중 별도
  요청을 통해 이미 채워진 값)를 null로 덮어쓰지 않는지 확인할 것 — 최종 이벤트 처리 시
  이미 화면에 반영된 값이 있으면 그 값을 우선한다.

### XBRL 다년도 컨텍스트 완전성 원칙 (2026-08-02 추가 — MSFT 재무탭 빈약 버그 계기)
- "concept(계정과목) 태그 자체가 후보 리스트에 없어서 못 찾는 것"과 "태그는 다 있고 원본
  데이터도 다년치가 이미 있는데, Claude 프롬프트(context_text)엔 최신 1개년치만 노출되는
  것"은 서로 다른 버그다 — 둘 다 결과적으로 "확인 필요"/근거 없는 "(추정)"으로 보여 증상이
  똑같으므로, 원인 진단 시 반드시 둘 다 확인할 것(MSFT는 매출총이익/현금성자산은 전자,
  영업이익/순이익/총자산/총부채/자본총계는 후자였음 — `financial_cache.raw_edgar`엔 이미
  5개년 데이터가 있었는데 `context_text`엔 최신 연도만 실려 있었음).
- 라이브 조회(`server/src/lib/edgar.ts`)와 배치 프리컴퓨트(`server/scripts/
  edgarBatchPrecompute.ts`)는 별도 실행 컨텍스트라 로직이 복제돼 있다 — concept 후보
  리스트든 다년도 context_text 생성 로직이든, 한쪽에 필드/연도를 추가하면 반드시 다른
  쪽도 확인할 것(2026-07-30 현금흐름 버그, 2026-07-04 revenue concept 버그와 동일한
  "배치가 라이브 로직을 복제해서 쓰다 한쪽만 고쳐지는" 패턴 반복 — Security Principles
  실전 발견 이력 참고).
- 다년도 시계열을 프롬프트에 노출할 때 계정과목마다 노출 연도 수가 다르면(예: 매출만
  5개년, 나머지는 최신 1개년), Claude는 부족한 연도를 자체 지식으로 추측해 "(추정)"을
  붙이거나 "확인 필요"를 반환한다 — 원본에 다년치가 있어도 결과는 똑같이 빈약해 보인다.
  다년도 트렌드 섹션은 전 계정과목을 동일한 연도 수로 노출하고, "전부 EDGAR 공식 수치,
  (추정) 표기 금지"처럼 명시적으로 지시할 것(`buildEdgarContext`/`edgarBatchPrecompute.ts`
  다년도 블록 참고).

### 모델 티어링 검토 시 확인할 캐싱 제약 (2026-08-12 추가 — haiku 티어링 테스트 계기)
- Haiku 4.5 최소 캐시 프리픽스는 4,096토큰(Sonnet 4.6은 1,024토큰). 배치2-4 공유 시스템
  프롬프트(1,175토큰)로는 haiku 전환 시 캐싱이 완전히 무효화됨(실측: `cache_read=0,
  cache_write=0`). 향후 모델 티어링 검토 시 이 제약부터 확인할 것 — 캐싱 혜택을 유지하려면
  공유 프롬프트를 4,096토큰 이상으로 늘리거나 haiku 전환 자체를 포기해야 함.

## Architecture — key recent decisions

### 프롬프트 캐싱 실측 로깅 도입 + gatherFinancialResearch 캐싱 버그 수정 (2026-08-13)

**배경**: CLAUDE.md에 v2.0.0부터 "Prompt Caching 적용"이라 기록돼 있었으나, 실제로 캐시가
걸리는 순서(정적 시스템 프롬프트 → 동적 데이터)가 7개 Claude API 호출 지점 전부에서 지켜지고
있는지, 정적 프리픽스가 모델별 최소 캐시 크기를 실제로 넘는지는 확인된 적이 없었음.

**감사 결과**:
- `server/src/lib/claude.ts`가 Claude API를 호출하는 유일한 파일(전체 grep 확인) — 그 안에
  7개 distinct 호출 경로: `gatherResearch1`/`gatherResearch2`/`callFounderSection`/
  `gatherFinancialResearch`(전부 `runWithWebSearch()` 경유), `callSection()`(배치1~4 스키마
  9개 중 8개 공유), `generateGrowthScenarioNarrative()`, `generateSecBenchmarkInterpretations()`.
- **버그 발견+수정**: `gatherFinancialResearch()`("재무 데이터 새로고침" 버튼이 쓰는 함수)만
  2026-08-12에 `gatherResearch1`/`gatherResearch2`에서 고친 캐싱 버그(회사명이 시스템
  프롬프트 문자열에 직접 삽입돼 캐시가 매 요청마다 무효화되는 문제)의 수정에서 빠져 있었음 —
  `cache_control` 자체도 걸려있지 않아 캐싱을 아예 시도조차 안 하고 있었음. 동일 패턴(정적
  규칙은 `GATHER_FINANCIAL_SYSTEM` 상수 + `cache_control`, 회사명이 들어가는 검색 쿼리는
  user 메시지로 분리)으로 수정 완료.
- `callSection()`의 공용 시스템 프롬프트(`sectionSystem(language)`, 배치1~4의 9개 스키마 중
  8개가 공유)는 언어별 2종류뿐이고 회사명이 없어 정확히 캐싱 대상 — 문자수 기반 추정
  ~1225토큰으로 Sonnet 4.6 최소 캐시 프리픽스(1024토큰)를 상회, 바로 위 "모델 티어링 검토 시
  확인할 캐싱 제약" 항목의 실측치(1175토큰)와 대략 일치. 이 경로가 캐싱 투자의 실질적 핵심.
- `gatherResearch1`/`gatherResearch2`/`callFounderSection`은 회사명을 시스템에서 제대로
  분리했지만(2026-08-12 수정), 정적 프리픽스(system + 도구정의) 자체가 추정 205~320토큰으로
  Sonnet 최소치(1024토큰)에 못 미칠 가능성 — 캐싱 코드는 맞게 짜여 있어도 실제로 걸리는지는
  미확인 상태였음.

**계측 로깅 추가**: 위 7개 호출 경로 전부에서 `response.usage.input_tokens`/
`cache_read_input_tokens`/`cache_creation_input_tokens`를 `[cache-stats][<label>]` 형식으로
로깅하는 `logCacheUsage()` 헬퍼 하나를 추가(`server/src/lib/claude.ts`) — `runWithWebSearch()`
내부 1곳(4개 호출 경로 커버) + `callSection()`/`generateGrowthScenarioNarrative()`/
`generateSecBenchmarkInterpretations()` 각 1곳, 총 4곳에 한 줄씩 삽입. `grep "\[cache-stats\]"`로
전 호출 지점의 캐시 히트 여부를 한 번에 확인 가능.

**다음 세션에서 할 일(실측 대기 중)**: 배포 후 실제 분석 몇 건을 돌려 `[cache-stats]` 로그
확인 → 추정이 아니라 실측으로 어떤 호출이 캐시 히트하는지 판단. gatherResearch1/2/founder_v2가
실제로 캐시 미스라면 두 리서치 함수를 하나의 더 큰 공유 정적 블록으로 합치는 안을 검토(단,
리서치 단계 자체가 이미 저비용이라 ROI가 낮을 수 있음 — 실측 후 판단).

### 모델 티어링 설계안 (2026-08-13, 실측 대기 중 — 아직 미구현)

배치1~4의 9개 스키마(`summary_v2`/`business_model_v2`/`competitors_v2`/
`cross_industry_nudge_v1`/`value_chain_v2`/`strategy_v2`/`financials_v2`/`founder_v2`/
`sources`)를 난이도별로 검토한 설계안. **아직 아무 것도 구현하지 않음** — `callSection()`의
`model` 파라미터는 이미 존재하지만(기본값 sonnet) 배치 병합 로직에서 스키마별로 분기하도록
연결하는 작업은 위 캐시 실측 로그로 캐시 히트율을 먼저 확인한 뒤 다음 세션에서 결정.

- **Haiku 전환 후보 (2개)**: `sources`(확신 높음 — 순수 출처 재분류/L1·L2·L3 태깅/포맷팅,
  전략적 해석 없음), `founder_v2`(확신 중간 — 대부분 전기적 사실 추출이지만 자체 web_search
  멀티라운드 루프를 도는 유일한 스키마라 Haiku의 에이전틱 tool-use 안정성이 이 코드베이스에서
  검증된 바 없음 — 별도 리스크 축).
- **Sonnet 유지 (7개, 다운그레이드 후보에서 명시적으로 제외)**:
  - `cross_industry_nudge_v1` — 9개 중 난이도가 가장 높음. 자기 산업이 아닌 다른 산업에서
    유사 사례를 찾는 analogical reasoning이라 모델 역량 차이가 가장 크게 드러나는 유형. 약한
    모델은 진짜 크로스인더스트리 사례 대신 같은 업종 경쟁사 사례를 재활용하기 쉬움 — 넛지
    기능 자체가 무의미해짐.
  - `financials_v2` — 표면적으로는 "공시 수치 그대로 옮기기"라 기계적으로 보이지만, 이
    프로젝트 실전 발견 이력(9·10번 등)에서 재무 탭이 가장 사고가 잦았던 섹션. "Not disclosed"
    vs "Not applicable" 구분, 다른 연도 수치 혼합 계산 금지 등 정밀한 조건부 규칙 준수 요구 —
    오류 시 데이터 신뢰성 원칙(전역 CLAUDE.md 최우선 원칙) 정면 위반.
  - `strategy_v2` — `strategy_coherence`(corporate/business/financial 3블록을 하나의
    내러티브로 엮는 유일한 문단형 필드)가 9개 중 가장 난이도 높은 서술형 추론.
  - `summary_v2`/`business_model_v2`/`competitors_v2`/`value_chain_v2` — 각각 growth_motion
    분류, 경쟁 포지셔닝 갭 판단, 밸류체인 pricing_power 구조 판단 등 전략적 해석이 필요한
    영역이라 유지. 이 중 `value_chain_v2`가 "유지" 그룹에서 가장 근거가 약한 편이라, 향후
    다운그레이드 파일럿을 하게 되면 다음 순번 후보.
- **캐싱 상호작용 주의**: `sources`는 현재 `callSection()`의 공용 Sonnet 캐시를 형제 스키마
  7개와 공유 중 — Haiku로 옮기면 이 캐시 풀에서 이탈하고, Haiku 4.5 최소 캐시 프리픽스
  (4096토큰, 바로 위 "모델 티어링 검토 시 확인할 캐싱 제약" 참고)는 현재 시스템 프롬프트
  크기로는 어차피 못 넘어 새 캐싱도 안 걸림. 순수 입력/출력 단가 차이(Sonnet $3/$15 vs
  Haiku $1/$5 per MTok)가 이 손실분을 상쇄할 가능성이 높지만 실측 없이는 단정 불가.

### 재무 파이프라인 서버 조립 리팩터링 + Ford FY2021-2023 공백 근본 원인 규명 (2026-08-13)

**배경**: Ford Motor 재무 탭에서 FY2021/2022 매출총이익·영업이익·순이익이 반복적으로 "확인
필요"로 비는 문제를 조사. 처음엔 `extractAnnualSeries()`의 `u.fy`(그 수치가 실린 10-K 제출서
자체의 회계연도 태그이지 그 수치가 설명하는 기간이 아님) 오용이나 `TARGET_FISCAL_YEARS`
하드코딩 같은 코드 버그를 의심했으나, 실제 SEC EDGAR 원본 데이터로 직접 검증한 결과 **둘 다
빗나간 가설이었음** — 당시 최신 코드 로직을 fresh SEC 데이터에 그대로 시뮬레이션하면 매출총이익
(Ford가 애초에 태깅 안 함, `GrossProfit` concept 자체가 404) 제외 전부 5개년이 정확히 나왔음.

**진짜 원인 — 코드 버그가 아니라 Claude 응답의 실행별 비결정성**: DB에 있던 Ford 분석 3건 중
2건이 FY2021/2022 공백, 1건만 정상이었는데, `financial_cache`가 이 기업에 대해 비어있어 셋 다
라이브 fetch 경로였고(동일 코드), 그 중 두 건은 생성 시각이 16분 차이였음에도 그 사이 `edgar.ts`
커밋이 전혀 없었음(git log 확인) — 즉 **완전히 동일한 코드, 완전히 동일한 완전한 컨텍스트**를
주고도 Claude가 어떤 실행에서는 multi-year trend 섹션의 값을 전부 옮겨적고 어떤 실행에서는
일부 연도를 놓쳤다는 뜻. "이미 서버가 확정한 원본값을 Claude에게 매번 텍스트로 다시
서술시키는" 구조 자체가 근본 원인이었음.

**해결**: multi-year trend를 Claude가 텍스트로 재서술하지 않고, 서버가 EDGAR/DART raw
series에서 income_statement/balance_sheet를 직접 결정론적으로 조립해 Claude 응답을 덮어쓰도록
전환(`server/src/lib/financialsTableBuilder.ts` 신설, `analyzeCompany()`/`refreshFinancials()`/
`reanalyzeSingleSection()`과 기존 fin_preview 경로 전부 이 함수로 통일). 이제 이 필드들은
Claude의 실행별 변동성과 완전히 무관해짐. **"Ford FY2021-2023 공백"은 별도의 개별 버그가
아니라 이 구조적 리팩터링으로 근본 해결됨** — 앞으로 다년도 재무 필드에서 "확인 필요" 재발이
보고되면 개별 concept 버그부터 의심하지 말고 이 서버 조립 구조(raw 데이터 자체가 있는지,
override가 실제로 걸렸는지)부터 먼저 확인할 것.

**같이 처리한 항목**:
- **EBITDA 서버 조립**: `EdgarRawSeries`에 `depreciation` 필드 신규(라이브 `edgar.ts` + 배치
  `edgarBatchPrecompute.ts` 둘 다 — 이전엔 D&A concept 자체를 조회하지 않아 EBITDA가 항상
  "확인 필요"였음). Operating Income + Depreciation(둘 다 확인된 연도만) 계산. Ford 실측으로
  5개년 전부 정상 계산 확인.
- **Concept 충돌 투명성**: `pickConceptSeriesWithConflict()`(순이익 NetIncomeLoss/ProfitLoss
  한정 적용) — 같은 최신연도에 두 concept 값이 10% 이상 다르면(대기업이 두 태그를 동시에
  유지하는 경우 자체는 흔함, 실측: Berkshire/GE/3M 전부 두 태그 다 최신 데이터 보유) 어느
  concept을 썼는지 컨텍스트에 명시해 Claude가 sources[] 각주에 반영하도록 유도.
  ⚠️ **이 기능의 계기로 인용했던 "Honeywell NetIncomeLoss=-$0.12B vs ProfitLoss=$4.77B" 예시는
  조사 오류였음, 재인용 금지** — 구현 완료 후 재검증한 결과 실제로는 NetIncomeLoss=$4.729B,
  ProfitLoss=$4.772B로 0.9% 차이뿐(10% 임계치 미달, conflictNote 미발생이 정상 동작). 감지
  로직 자체(다른 값 후보 비교, 임계치, 동일 연도끼리만 비교)는 정상 검증됐지만, "실제로 자주
  재현되는 문제"라는 실측 근거는 이 예시로 증명된 적이 없음.
- **concept_miss_log**: 후보 concept을 전부 시도해도 못 찾은 필드 기록(`cik`/`company_name`/
  `field_name`/`candidates_tried`/`resolved_at`, prod+dev 마이그레이션 적용 완료) —
  **라이브 fetch 경로(`edgar.ts`)에만** 연결, 배치 스크립트(`edgarBatchPrecompute.ts`, 월 1회
  8천개 기업 대상)는 의도적으로 제외(대량 실행 중 노이즈성 로그가 쌓일 위험, 사람이 검토할
  실용적 가치가 낮다고 판단).

**남은 한계**:
- **DART는 여전히 Gross Profit/EBITDA 서버 조립 불가** — DART 파이프라인(`dart.ts`의
  `DartFinSeries`)이 이 두 concept 자체를 원천적으로 조회하지 않음(필드 자체가 타입에 없음).
  이번 리팩터링은 EDGAR 소스에서만 완전하고, DART 소스는 income_statement 5개 행 중
  매출총이익/EBITDA는 여전히 Claude의 자유 서술(또는 "확인 필요")에 의존.
  Operating Income/Net Income/Revenue/자산·부채·자본은 DART도 서버 조립 적용됨.
- override(`overrideFinancialsTable`)는 raw 데이터(EDGAR/DART rawSeries)가 있을 때만 적용됨 —
  워트인텔리전스처럼 EDGAR/DART 둘 다 없이 순수 web_search로만 재무 수치가 나오는 회사는
  서버 조립 대상이 아니라 Claude 생성값을 그대로 씀(이 경우엔 Data reliability principles
  규칙 8 + strategy_v2 Rule 5의 사후 검증만 방어선).
- **(2026-08-13 추가 발견) financial_cache 옛 캐시 blob이 최근 추가된 EdgarRawSeries 필드를
  통째로 못 갖고 있어 크래시** — 이 리팩터링 검증용 `testEdgarReanalysisConsistency.ts`
  (Ford/NVIDIA/Johnson & Johnson 각 3회 재실행)로 실행별 일관성을 확인하던 중 batch3가
  Ford는 9/9, NVIDIA/J&J도 재현되는 걸 발견. 처음엔 `depreciation` 필드(EBITDA 계산,
  `s.depreciation[i]`) 하나만 패치했다가, NVIDIA/J&J가 이번엔 `grossProfit`(더 이전에
  추가된 필드, 2026-08-12 RKLB 수정 때 도입)에서 동일하게 크래시하는 걸 재확인 —
  Ford만의 문제가 아니라 **"필드 추가 시점 이후로 캐시가 안 갱신된 회사는 그 필드가
  뭐든 undefined"라는 일반 패턴**이었음. `toSeriesInput()`을 필드별 개별 fallback 대신
  공용 `fallback(vals, n)` 헬퍼로 8개 필드(revenue/grossProfit/operatingIncome/netIncome/
  depreciation/assets/liabilities/equity) 전부 일괄 정규화하도록 재작성해 근본 해결
  (`financialsTableBuilder.ts`) — 앞으로 `EdgarRawSeries`/`DartRawSeries`에 필드가
  추가돼도 이 클래스의 크래시는 재발하지 않음.
  Supabase 직접 조회로 확인한 스테일 규모: **financial_cache EDGAR 소스 6,819건 전부
  depreciation 필드 없음(100%)** — RKLB 때처럼 "일부 스테일"이 아니라, depreciation
  필드 자체가 배치 마지막 실행 이후 하루 전(2026-08-13)에 신규 추가됐고 크론이 월
  1회(`render.yaml`, 매월 1일 02:00 UTC)라 그 이후 한 번도 재실행 안 된 게 원인 —
  `grossProfit`은 더 오래전에 추가된 필드라 스테일 비율은 확인 안 함(fallback 적용으로
  크래시는 어차피 안 남). 크래시는 수정됐고 EBITDA만 "확인 필요"로 정상 표시(다른
  4개 지표는 영향 없음), 9/1 정기 크론에서 자연 해소 예정. 그전에 특정 기업을 급하게
  보여줘야 할 일이 생기면 RKLB 때처럼 개별 수동 재생성(`processCompany()`)으로 대응 —
  배치 수동 전체 재실행은 2026-08-13에 의도적으로 보류 결정.
- **(2026-08-15 추가) `EdgarRawSeries.revenueLines`(세그먼트/제품 매출 라인)도 같은 계열의
  스테일 리스크를 갖지만, depreciation/grossProfit과 결정적으로 다른 점이 있다** — 이 필드는
  `edgarBatchPrecompute.ts`(월간 배치)에 의도적으로 연결하지 않았음(HTML 스크레이핑을 수천
  개 기업 대상 대량 배치에 넣는 리스크는 별도 결정 사항으로 남김). 즉 depreciation/
  grossProfit은 "다음 정기 크론이 돌면 자연 해소"되지만, **`revenueLines`는 크론이 아무리
  돌아도 절대 채워지지 않는다** — 오직 그 회사가 라이브 분석(신규 분석 또는 "재분석하기")될
  때만 채워진다. 배치가 채운 `financial_cache`를 그대로 쓰는 캐시 히트 상태에서는 "매출 구성"
  섹션이 계속 안 보이는 게 정상 동작이며, 버그로 오인하지 말 것.

### ICP 인사이트 discovery_questions 2단계 통합 (2026-08-15)

**배경**: ICP 인사이트 탭이 5카테고리(financial/investment/technology/competitive/market)
신호 중 실제로 신호가 있는 카테고리만 insight+consequence를 생성하다 보니, 보통 3개 안팎으로만
채워져 빈약했음(백로그 "ICP 맞춤형 인사이트 탭" 항목 참고). 카테고리별 함의 템플릿을 미리
설계하는 "트리거 패턴 라이브러리" 방향 대신, 이미 매 분석마다 생성되는 9개 섹션 각자가 자기
데이터에 근거한 질문 후보를 직접 만들어두고 ICP 탭에서 선별만 하는 2단계 구조로 재설계.

**1단계(섹션 단위, 기존 캐시 정책 그대로)**: summary_v2/financials_v2/business_model_v2/
competitors_v2/value_chain_v2/strategy_v2/industry_history_v2/tech_evolution_v2/founder_v2
9개 섹션 타입에 `discovery_questions: string[]`(3-5개, 빈 배열 허용) 필드 신규 —
`SECTION_SCHEMAS`(`claude.ts`) 각 스키마 끝에 "발표형 금지, 사실이 아니라 그 사실이 만드는
결과를 궁금해하는 질문형으로" 지시문 추가. `SECTION_CONTENT_SIGNALS`(Quality Gate)에는
의도적으로 편입하지 않음 — discovery_questions만 채워지고 나머지 필드가 전부 비어있는 걸
"콘텐츠 있음"으로 오판하면 안 되므로.
- `cross_industry_nudge_v1`(넛지)는 이 9개 목록에서 제외 — 이미 `industry_pain.
  financial_impact_question`이라는 질문형 필드가 있어 새 필드를 안 만들고 그대로 재사용
  (구 5카테고리 중 "market" 자리를 대체).
- `financials_v2`는 SEC 산업 벤치마크 편차를 프롬프트에서 볼 수 없음(콘텐츠 포맷 원칙 1번 —
  이 숫자는 narrative/프롬프트 컨텍스트에 안 실리고 막대비교 컴포넌트가 전담) → Claude가
  callSection()에서 만드는 discovery_questions는 편차와 무관하게 손익/현금흐름/리스크만
  소재로 삼고, 편차 소재 질문 1개는 `generateSecBenchmarkInterpretations`와 같은 자리
  (`analyze.ts`의 `buildSecBenchmarkComparison`)에서 `generateBenchmarkDiscoveryQuestion()`이
  별도로 만들어 `financialsV2.discovery_questions` 맨 앞에 붙이고 합쳐서 5개로 자른다.

**2단계(유저 단위, 온디맨드, 캐시 정책 기존 그대로)**: `POST /api/analyze/:id/icp-insight`가
`collectDiscoveryQuestionCandidates()`(`server/src/lib/discoveryQuestions.ts`, 옛
`icpSignals.ts`의 `collectIcpSignals` 대체)로 9개 섹션 + 넛지의 질문을 하나의 후보 풀로
모은다(id/section/question/sources). ICP(icp_product/icp_target_industry/icp_target_role)가
3개 다 비어있으면 `pickDefaultDiscoveryQuestions()`가 Claude 호출 없이 결정론적으로 최대
5개를 고른다(재무 벤치마크 이탈 있으면 financials_v2 후보를 앞으로, 없으면 섹션 노출 순서
그대로) — 불필요한 Claude 호출을 피하는 기존 원칙과 동일 계열. 하나라도 있으면
`curateDiscoveryQuestions()`(claude.ts)가 후보 풀 전체를 id와 함께 Claude에 넘겨 ICP에
맞는 3-5개를 선별(문구 경미한 재구성 허용)하게 하고, **반환된 id가 실제로 넘긴 후보 풀에
있는지 서버가 다시 검증**해 Claude가 근거 없는 id/문장을 끼워 넣을 방법을 코드 레벨에서
차단한다(원본 섹션 데이터 근거를 벗어나지 않을 것 원칙의 서버측 강제). `icp_insights` 테이블 +
`analysis_id`/`icp_fingerprint` 캐시 조회 로직은 기존 그대로 재사용(신규 테이블 없음) —
응답 `content`만 카테고리 키 객체에서 `{ questions: [{question, section, sources}] }`
배열로 형태만 바뀜. 프론트(`AnalysisCard.tsx`의 `IcpInsightTab`)도 카테고리별 카드 5장을
질문 리스트 1장(불릿, `SectionCard`/`SourcesList` 재사용, 새 컴포넌트 없음)으로 교체 —
별점 위젯(`IcpRatingWidget`)은 카드당 하나씩 중복 렌더링되던 걸 리스트당 1개로 정리.

**남은 한계 (기존 financial_cache 스테일 패턴과 동일 계열)**: financial_cache의 fin_preview
빠른 경로(`buildFinancialsV2FromRaw`, EDGAR/DART raw로 직접 조립, Claude 미호출)와 이전에
생성된 `financial_cache.financials_v2`/`analyses` 캐시 blob은 이 필드 추가 이전에 만들어졌으므로
`discovery_questions`가 없다 — 클라이언트 타입에서 이 필드를 옵셔널(`discovery_questions?:
string[]`)로 두고, 후보 수집 시 `?? []`로 방어해 크래시 없이 자연히 후보 수가 적게(또는 0개)
잡히는 데 그친다. 별도 백필 없음 — 재분석/배치 재실행으로 자연 해소(depreciation/grossProfit
필드 스테일 이슈와 동일 원칙).

### 공유 링크/PDF ICP 노출 범위 확정 (2026-08-15)

**정정**: 2026-08-13에 결정됐던 "공유 링크는 원 분석자 본인의 ICP 그대로 보임" 방침을 아래로
번복한다 — **공유 링크/PDF에는 discovery_questions 결과만 노출하고 ICP 원문(제품/타겟산업/
타겟직무)은 노출하지 않는다 — 소유자 영업 정보 보호 목적, 2026-08-15 수정 (기존 8/13 "그대로
노출" 결정 번복)**. 착수 전 확인 결과 8/13 방침은 애초에 구현된 적이 없었음(`share.ts`/
`AnalysisPdf.tsx` 어디에도 ICP 관련 코드 없었음) — 구버전을 걷어낼 필요 없이 새 방침으로 바로
구현.

**발견한 구조적 문제 + 해결**: `icp_insights`(2026-08-15 discovery_questions 개편으로 신설)는
캐시 키가 `(analysis_id, icp_fingerprint)`뿐이라 소유자를 특정할 컬럼이 없었음 — ICP는 "그
analysis를 만든 사람"이 아니라 "그 순간 로그인해서 탭을 연 사람" 본인의 `profiles.icp_*`를
매번 읽어 생성하는 구조라, 인기 있는 analysis 하나에 여러 유저가 각자 자기 ICP로 만든 행이
여러 개 있을 수 있음. 이 상태로 공유 링크에 "아무 icp_insights 행"을 노출하면 소유자가 아닌
**다른 로그인 유저의 결과가 소유자 이름으로 잘못 노출**되는 사고로 이어질 수 있어(그 사람도
동의한 적 없음), `icp_insights.created_by`(uuid, `20260815_icp_insights_created_by.sql`,
prod+dev 적용) 신규 — `POST /api/analyze/:id/icp-insight`가 생성 시 `authUser.id`로 채운다.
`GET /api/share/:token`는 `icp_insights` 중 `created_by = analyses.created_by`인 행만(가장
최근 것) 조회 — 소유자가 ICP 탭을 직접 연 적이 없으면 이 섹션 자체를 노출하지 않는다(다른
유저의 결과로 대체하지 않음). `created_by`가 없는 옛 analysis(2026-07-16 이전 생성분)도
동일하게 미노출.

**소유자 표시 라벨 — 이메일 대신 닉네임**: 애초 요청은 "이메일 앞부분 마스킹(sg.van.p***)"
이었으나, 마스킹해도 실제 이메일에서 유도된 PII라는 지적을 받아 설계를 바꿨다 — 대신
`profiles.nickname`(text, 선택 입력, `20260815_profiles_nickname.sql`) 신규, 설정 페이지에
입력 필드 추가(`ProfileForm.tsx`, `showIcp`와 동일 플래그로 온보딩 모달에서는 숨김 — ICP와
같은 "설정 페이지 전용, 온보딩엔 안 넣는" 이유). 닉네임 미입력이면 공유 화면/PDF는 이름 없이
일반 문구("이 분석은 작성자의 ICP 기준으로 생성됨")로 대체 — 이메일은 어떤 형태로도 절대
노출하지 않는다.

**구현 요약**:
- `share.ts`: `GET /:token` 응답에 `icpDiscoveryQuestions`(질문 리스트, ICP 원문 필드는
  애초에 select하지 않아 응답에 존재할 방법 자체가 없음)와 `icpOwnerLabel`(닉네임 또는 null)
  추가 — 별도 공개 엔드포인트를 만들지 않고 기존 공유 라우트 응답에만 실어, "공유 토큰으로
  조회되는 analysis_id에 한해서만 노출"이 라우트 경계로 자연히 보장된다.
- `AnalysisCard.tsx`: 새 `isShareView` prop(`ShareContent.tsx`가 `<AnalysisCard isShareView
  ...>`로 전달) — true면 ICP 탭이 인터랙티브 `IcpInsightTab`(생성/재생성/별점 위젯) 대신 읽기
  전용 `SharedIcpQuestionsTab`(서버가 이미 골라준 목록만 렌더, API 호출 없음, 별점 위젯 없음)을
  쓴다. 히스토리/자기 리포트 뷰(`isShareView` 미지정)는 기존 인터랙티브 동작 그대로.
- `AnalysisPdf.tsx`: 공유 링크와 달리 PDF는 질문 리스트까지는 안 넣고 **표지 페이지에 문구
  한 줄만**("이 분석은 OOO님의 ICP 기준으로 생성됨") — `data.icpDiscoveryQuestions`가 있을
  때만(소유자가 생성한 적 있을 때만) 조건부 렌더링, ICP 세부 필드/질문 목록은 렌더링 안 함.

### Ford 세그먼트 매출 비중 오류 조사 → 재무제표 표시 원칙 5가지 확정 + revenue_lines 신설 (2026-08-15)

**발단**: Ford Motor 리포트에서 "01 기업개요 > 주요 제품/서비스"(summary_v2.products)와
"05 비즈니스모델 > 수익구조"(business_model_v2.revenue_streams)가 Ford Credit 매출 비중을
각각 12%/7%로 다르게 표시. 외부 10-K 원문 대조로 정답은 7.09%(Ford Credit $13,271M / 전사
$187,267M)로 확정, 조사 결과 **둘 다 raw 데이터를 전혀 받지 않고 웹서치+Claude 자유추정으로
채워지고 있었음**을 확인 — companyfacts/companyconcept JSON API가 XBRL 차원(axis/member)이
붙은 세그먼트 값을 통째로 걸러내 반환하지 않기 때문에(Ford/Apple 실측 확인), 애초에 raw
데이터에 접근할 방법 자체가 없었던 것. Ford를 2회 재실행해 재현한 결과 "어느 쪽이 맞는지"가
실행마다 뒤바뀜(1회차: 01번탭 라인 누락·05번탭 7% 정답 / 2회차: 01번탭 7% 정답·05번탭 12%
오답) — 즉 "05번이 원래 더 정확한 로직"이 아니라 순수 운이었음을 확인. 상세 조사 경위는 위
"재무 파생 지표 처리 원칙" 3번 항목 참고.

**해결 — R.htm 직접 파싱으로 raw 매출 라인 확보**: `edgar.ts`의 `fetchRevenueLineItems()`
신규 — `FilingSummary.xml`에서 소득계산서 R파일을 ShortName 패턴("CONSOLIDATED INCOME
STATEMENTS"/"...STATEMENTS OF OPERATIONS"/"...STATEMENTS OF INCOME" 등 폭넓게 매칭)으로
찾고, 그 R.htm(SEC가 필링마다 자동 생성하는 재무제표 렌더링 HTML)을 cheerio로 파싱해 XBRL
차원(axis/member)으로 구분된 매출 라인을 그대로 추출. 안전장치: ShortName 매칭 실패/라인
2개 미만/라벨 중복/합계가 총계와 15%+ 벌어짐 → 전부 `null`(라인 구분 없음과 동일 취급),
전체 `try/catch`로 절대 예외 안 던짐. **단위 배율 자동 보정**: R.htm 셀 값은 보통 "백만
달러" 표시인데 XBRL JSON의 `val`은 원 달러 단위라 배율을 모르면 합계 검증이 항상 실패하는
버그가 될 뻔했음 — 세그먼트 헤더 이전에 나오는 "연결 총계" 스크래핑값과 이미 확인된 JSON
API 총계의 비율로 배율(1/1,000/1,000,000/1,000,000,000)을 역산해 보정.
`financialsTableBuilder.ts`의 `buildRevenueLines()`가 포맷팅+비중(%) 계산(단순 나눗셈,
Claude 미개입)까지 전담, `financials_v2.revenue_lines`로 노출 — 프론트("매출 구성" 신규
섹션)/PDF 둘 다 라인 없으면 섹션째 스킵. `analyze.ts`의 fin_preview 빠른 경로에도 동일
연결(곁다리로 `['2021'..'2025']` 리터럴 필터가 이 함수에도 남아있던 걸 발견해 같이 제거 —
NVIDIA FY2026이 손익계산서 표엔 나오는데 fin_preview 요약 문구만 FY2025로 스테일해지는
불일치였음).

**검증**: Ford(사업부 축, 커스텀 멤버) 92.9%/7.1% — 7.1%가 원문 7.09%와 정확히 일치. Apple
(제품 축, 표준 멤버) 73.8%/26.2%. NVIDIA(라인 구분 없음) 정확히 `null`. Taiwan Semiconductor
(20-F, IFRS라 us-gaap 태그 자체 없음)·Toyota Motor(20-F, 2012년 이후 태깅 중단 추정) 둘 다
크래시 없이 `null`로 우아하게 저하 확인 — Toyota는 R.htm까지 실제 도달했지만 매출 컨셉 태그
불일치로 0라인이 된 케이스라 "ShortName 매칭 실패"와는 다른 실패 모드지만 동일하게 안전하게
처리됨을 보여줌. ShortName 정규식 자체는 9가지 합성 케이스(실제 표현 3종 + 변형 2종 +
Comprehensive Income/재무상태표/IFRS 표현 등 오탐 방지 4종)로 별도 검증, 9/9 PASS. 속도
영향 실측: `[edgar] revenueLines` 로그로 회사당 50~300ms 추가(기존 파이프라인이 Claude
호출만으로 60초 이상 걸리는 것에 비하면 무시할 수준).

**scope 결정**: EDGAR 전용(DART 미포함, GTM 타겟 아님) / `edgarBatchPrecompute.ts`(월간
배치) 미연결(스테일 리스크는 위 Quality Gate 원칙 섹션 참고) / `summary_v2.products`·
`business_model_v2.revenue_streams`·`business_model_v2.segments`의 `revenue_share`(%)
필드는 완전히 제거하고 이름+정성적 설명(무엇을 하는 사업부/제품인지)만 남김 — Ford 재검증
결과 새 프롬프트 지시를 정확히 따름(설명 텍스트에 %를 우회 삽입하는 사례 0건, `revenue_share`
키 자체가 응답에서 완전히 사라짐). `customer_concentration.customers[].revenue_share`/
`key_markets[].revenue_share`(고객 집중도/지역 매출 비중)는 건드리지 않음 — 애초에 "공시
확인된 것만, 아니면 드롭"이라는 별도의 엄격한 규칙을 이미 따르고 있어 이번 사고와 같은
계열의 문제가 아님.

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
| v2.2.0 | 2026-08 — 영어 단일화 1단계: Claude 분석 프롬프트 전체 영어 고정(EN/KR 토글 계획은 취소,
  DART 컨텍스트만 예외적으로 한국어 유지). 상세는 위 "언어 정책" 섹션 참고. |
| v2.3.0 | 2026-08 — Pain 진단 신규(크로스인더스트리 넛지 배치2 추가, 산업역사/기술역사
  "pain 진단 시작" 버튼 트리거로 전환), 사이드바 기업분석/pain 진단 2그룹 분리, 배치
  재편(2/3/4배치 3개, financials→3배치·founder→4배치 이동, 진행바 분모 5→4). 상세는 위
  "분석 배치 구조"/"Pain 진단" 섹션 참고. |
| v2.4.0 | 2026-08 — 최상위 3단 탭 구조 신규(Company Intelligence/Pain Diagnosis/AE Skills).
  기존 기업분석/pain 진단 2그룹은 앞의 두 탭으로 편입(사이드바 로직 재사용, `activeGroup`
  prop 필터링만 추가), AE Skills는 로그인 게이트 없는 별도 뷰(카테고리 칩 + 카드 피드
  스텁, 실 콘텐츠 파이프라인은 별도 백로그). 상세는 위 "UI/UX 원칙" 섹션 참고. |
| v2.5.0 | 2026-08 — SEC 산업 벤치마크(`industry_benchmark`, SEC Financial Statement Data Sets
  전수 벌크 파싱) 신설 + financials_v2 프롬프트 연결(±30% 이상 벌어진 지표만, 표본 부족 시
  대체 안내). 상세는 위 DB schema/Quality Gate 원칙 섹션 참고. |
| v2.6.0 | 2026-08-12 — 언어 정책 재도입(v2.2.0 영어 단일화 번복): `analyses.language`
  컬럼으로 KR/EN 캐시 분리, 계정 설정 내 수동 토글(localStorage, 기본 EN, 자동감지 없음),
  솔루션 앱 전체(AE Skills·랜딩페이지 제외)에 국영문 지원. 상세는 위 "언어 정책" 섹션 참고. |
| v2.7.0 | 2026-08-15 — ICP 인사이트 탭 discovery_questions 2단계 통합: 9개 섹션이 각자
  질문 후보(discovery_questions)를 생성해두고 ICP 탭이 3-5개만 선별(ICP 없으면 결정론적
  선택, 있으면 Claude 큐레이션 + id 기반 근거 검증). 5카테고리 insight+consequence 방식을
  대체. 상세는 위 Architecture 섹션 "ICP 인사이트 discovery_questions 2단계 통합" 참고. |
| v2.8.0 | 2026-08-15 — 재무제표 표시 원칙 5가지 확정(EBITDA 미표시/Gross Profit 원본 태그만/
  매출 라인은 F/S 그대로/10-K only/FY 라벨 그대로) + `financials_v2.revenue_lines` 신설
  (SEC R.htm 직접 파싱으로 세그먼트·제품 매출 라인 확보, EDGAR 전용) + `summary_v2.products`/
  `business_model_v2.revenue_streams`/`segments`의 `revenue_share`(%) 완전 제거(이름+정성적
  설명만) + 재무 연도 컬럼 고정 fy2021~fy2025 → 회사별 동적 렌더링 전환. Ford Credit 매출
  비중이 탭마다 12%/7%로 다르게 나오던 사고(정답 7.09%)를 근본 해결. 상세는 위 Architecture
  섹션 "Ford 세그먼트 매출 비중 오류 조사 → 재무제표 표시 원칙 5가지 확정 + revenue_lines
  신설" 및 "재무 파생 지표 처리 원칙" 참고. |
| v3.0.0 | 유료 플랜 출시 (Stripe) |
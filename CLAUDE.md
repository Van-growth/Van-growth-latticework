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
같은 항목에 상위 레벨 데이터가 있으면 하위 레벨은 무시.

| 레벨 | 소스 | 예시 |
|------|------|------|
| L1 | 공식 공시 | DART, SEC EDGAR, 회사 IR |
| L2 | 공신력 있는 미디어/분석 | Bloomberg, 한경, StockAnalysis |
| L3 | 추정/웹검색 기반 | 일반 웹검색, Claude 추정 |

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

### 5. 출처 표시 규칙
- 각 섹션 JSON에 `sources: Source[]` 배열 포함 (Claude 생성 시 inline)
- 본문 중 중요 수치 옆에 `[n]` 각주 마커 → `CitedText` 컴포넌트가 파란 superscript로 렌더링
- 탭 하단 `SourcesList`에서 각주 목록: `[1] SEC EDGAR — 10-K FY2025 (L1)`
- PDF export 시 각 섹션 하단 + 마지막 페이지 전체 출처 통합 목록 포함

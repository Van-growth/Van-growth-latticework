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

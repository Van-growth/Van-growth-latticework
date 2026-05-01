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
  supabase/
    migrations/    SQL migration files (run manually or via Supabase CLI)
  .env.example     Required env vars
  CLAUDE.md        This file
```

## Environment setup
1. Copy `.env.example` → `.env` in repo root, `server/`, and `client/`
2. Fill in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`
3. Run migration `supabase/migrations/001_initial.sql` in Supabase SQL Editor

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

## DB schema
- **companies** — `id`, `name` (unique), `created_at`
- **analyses** — `id`, `company_id` (FK), `content`, `created_at`

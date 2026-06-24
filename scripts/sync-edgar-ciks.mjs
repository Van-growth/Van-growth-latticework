#!/usr/bin/env node
/**
 * SEC EDGAR company_tickers.json → Supabase cik_master 테이블 동기화
 *
 * 실행:
 *   node scripts/sync-edgar-ciks.mjs
 *
 * 필요 env: SUPABASE_URL, SUPABASE_ANON_KEY
 * (server/.env 자동 로드)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// server/.env 로드
try {
  const envContent = readFileSync(path.join(__dirname, '../server/.env'), 'utf-8');
  for (const line of envContent.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* .env 없으면 기존 env 사용 */ }

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!SUPABASE_URL)      { console.error('❌  SUPABASE_URL 없음'); process.exit(1); }
if (!SUPABASE_ANON_KEY) { console.error('❌  SUPABASE_ANON_KEY 없음'); process.exit(1); }

// ── Supabase upsert (REST, 배치) ───────────────────────────────────────────────
async function upsertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cik_master`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase 오류 ${res.status}: ${txt}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📥  SEC EDGAR company_tickers.json 다운로드 중...');
  const res = await fetch('https://www.sec.gov/files/company_tickers.json', {
    headers: { 'User-Agent': 'Latticework sg.van.p@gmail.com' },
  });
  if (!res.ok) throw new Error(`EDGAR API 오류: ${res.status}`);

  // { "0": { "cik_str": 1750, "ticker": "AMSC", "title": "..." }, ... }
  const raw = await res.json();
  const entries = Object.values(raw);
  console.log(`   ${entries.length.toLocaleString()}개 기업 수신`);

  const rows = entries.map(e => ({
    cik:    String(e.cik_str).padStart(10, '0'),
    name:   e.title,
    ticker: e.ticker || null,
  }));

  const BATCH_SIZE = 1000;
  let saved = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await upsertBatch(rows.slice(i, i + BATCH_SIZE));
    saved += Math.min(BATCH_SIZE, rows.length - i);
    process.stdout.write(`\r   저장: ${saved.toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  console.log('\n✅  완료!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

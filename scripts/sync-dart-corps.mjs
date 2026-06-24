#!/usr/bin/env node
/**
 * DART 전체 기업목록 → Supabase corp_master 테이블 동기화
 *
 * 실행:
 *   node scripts/sync-dart-corps.mjs
 *
 * 필요 env: DART_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
 * (server/.env 자동 로드)
 */

import { inflateRawSync } from 'node:zlib';
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

const { DART_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

if (!DART_API_KEY)           { console.error('❌  DART_API_KEY 없음'); process.exit(1); }
if (!SUPABASE_URL)           { console.error('❌  SUPABASE_URL 없음'); process.exit(1); }
if (!SUPABASE_ANON_KEY)      { console.error('❌  SUPABASE_ANON_KEY 없음'); process.exit(1); }

// ── 최소 ZIP extractor (외부 의존성 없음) ──────────────────────────────────────
function extractFromZip(buf) {
  const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let pos = 0;
  while (pos < buf.length - 30) {
    const idx = buf.indexOf(sig, pos);
    if (idx === -1) break;

    const compression    = buf.readUInt16LE(idx + 8);
    const compressedSize = buf.readUInt32LE(idx + 18);
    const fnLen          = buf.readUInt16LE(idx + 26);
    const exLen          = buf.readUInt16LE(idx + 28);
    const dataOffset     = idx + 30 + fnLen + exLen;
    const compressed     = buf.subarray(dataOffset, dataOffset + compressedSize);

    if (compression === 0) return compressed;       // stored
    if (compression === 8) return inflateRawSync(compressed); // deflate
    pos = dataOffset + compressedSize;
  }
  throw new Error('ZIP 내 파일을 추출할 수 없음');
}

// ── XML 파서 (DART CORPCODE.xml 전용) ─────────────────────────────────────────
function parseCorpXml(xml) {
  const corps = [];
  const re = /<list>\s*<corp_code>([^<]*)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<stock_code>([^<]*)<\/stock_code>\s*<modify_date>([^<]*)<\/modify_date>\s*<\/list>/gs;
  let m;
  while ((m = re.exec(xml)) !== null) {
    corps.push({
      corp_code:   m[1].trim(),
      corp_name:   m[2].trim(),
      stock_code:  m[3].trim() || null,
      modify_date: m[4].trim() || null,
    });
  }
  return corps;
}

// ── Supabase upsert (REST, 배치) ───────────────────────────────────────────────
async function upsertBatch(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/corp_master`, {
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
  console.log('📥  DART 전체 기업목록 다운로드 중...');
  const res = await fetch(
    `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(DART_API_KEY)}`,
  );
  if (!res.ok) throw new Error(`DART API 오류: ${res.status}`);

  const zipBuf = Buffer.from(await res.arrayBuffer());
  console.log(`   ZIP: ${(zipBuf.length / 1024).toFixed(0)} KB`);

  const xmlBuf = extractFromZip(zipBuf);
  const xml    = xmlBuf.toString('utf-8');
  console.log(`   XML: ${(xml.length / 1024).toFixed(0)} KB`);

  const corps = parseCorpXml(xml);
  console.log(`   파싱: ${corps.length.toLocaleString()}개 기업`);

  const BATCH_SIZE = 500;
  let saved = 0;
  for (let i = 0; i < corps.length; i += BATCH_SIZE) {
    await upsertBatch(corps.slice(i, i + BATCH_SIZE));
    saved += Math.min(BATCH_SIZE, corps.length - i);
    process.stdout.write(`\r   저장: ${saved.toLocaleString()} / ${corps.length.toLocaleString()}`);
  }
  console.log('\n✅  완료!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });

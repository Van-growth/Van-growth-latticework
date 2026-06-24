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

// ── 최소 ZIP extractor (센트럴 디렉토리 기반) ─────────────────────────────────
function extractFromZip(buf) {
  // 1. End of Central Directory Record 찾기 (끝에서 역방향 검색)
  const EOCD_SIG = 0x06054b50;
  let eocdPos = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdPos = i; break; }
  }
  if (eocdPos === -1) throw new Error('EOCD not found in ZIP');

  const cdOffset  = buf.readUInt32LE(eocdPos + 16);
  const cdEntries = buf.readUInt16LE(eocdPos + 10);

  // 2. 첫 번째 파일 엔트리를 Central Directory에서 읽기
  const CD_SIG = 0x02014b50;
  let cdPos = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buf.readUInt32LE(cdPos) !== CD_SIG) throw new Error('Invalid CD entry');
    const compression      = buf.readUInt16LE(cdPos + 10);
    const compressedSize   = buf.readUInt32LE(cdPos + 20);
    const fnLen            = buf.readUInt16LE(cdPos + 28);
    const exLen            = buf.readUInt16LE(cdPos + 30);
    const cmLen            = buf.readUInt16LE(cdPos + 32);
    const localOffset      = buf.readUInt32LE(cdPos + 42);

    // 로컬 파일 헤더에서 실제 데이터 오프셋 계산
    const lhFnLen    = buf.readUInt16LE(localOffset + 26);
    const lhExLen    = buf.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + lhFnLen + lhExLen;

    const compressed = buf.subarray(dataOffset, dataOffset + compressedSize);
    if (compression === 0) return compressed;
    if (compression === 8) return inflateRawSync(compressed);
    throw new Error(`압축 방식 미지원: ${compression}`);
  }
  throw new Error('ZIP에서 파일을 찾을 수 없음');
}

// ── XML 파서 (DART CORPCODE.xml 전용) ─────────────────────────────────────────
function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`));
  return m ? m[1].trim() : '';
}

function parseCorpXml(xml) {
  const corps = [];
  const re = /<list>([\s\S]*?)<\/list>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block      = m[1];
    const corp_code  = extractTag(block, 'corp_code');
    const corp_name  = extractTag(block, 'corp_name');
    const stock_code = extractTag(block, 'stock_code');
    const modify_date = extractTag(block, 'modify_date');
    if (corp_code && corp_name) {
      corps.push({
        corp_code,
        corp_name,
        stock_code: stock_code || null,
        modify_date: modify_date || null,
      });
    }
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

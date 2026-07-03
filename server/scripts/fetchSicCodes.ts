// cik_master 전체 기업의 EDGAR submissions.json을 호출해 SIC 코드를 수집하고
// sector_mapping으로 sector_tag를 산출해 저장.
// 실행: npx ts-node server/scripts/fetchSicCodes.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const EDGAR_HEADERS = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };
const DELAY_MS      = 300;
const RETRY_WAIT_MS = 10_000;
const MAX_RETRIES   = 3;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface SubmissionsResponse {
  sic?: string;
  sicDescription?: string;
}

async function fetchEdgar(url: string, attempt = 0): Promise<SubmissionsResponse | null> {
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS });
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) return null;
      console.log(`  [429] 10초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_WAIT_MS);
      return fetchEdgar(url, attempt + 1);
    }
    if (!res.ok) return null;
    return (await res.json()) as SubmissionsResponse;
  } catch {
    if (attempt >= MAX_RETRIES) return null;
    await sleep(RETRY_WAIT_MS);
    return fetchEdgar(url, attempt + 1);
  }
}

function resolveSectorTag(
  sic: string,
  exactMap: Map<string, string>,
  majorGroupMap: Map<string, string>,
): string {
  return exactMap.get(sic) ?? majorGroupMap.get(sic.slice(0, 2)) ?? 'OTHER';
}

async function processCompany(
  idx: number,
  total: number,
  cik: string,
  name: string,
  exactMap: Map<string, string>,
  majorGroupMap: Map<string, string>,
): Promise<'ok' | 'no_code' | 'failed'> {
  const cikPad = cik.padStart(10, '0');
  const res    = await fetchEdgar(`https://data.sec.gov/submissions/CIK${cikPad}.json`);

  if (!res) {
    console.log(`진행 중 [${idx}/${total}] ${name} — 실패 (fetch 실패)`);
    return 'failed';
  }

  const sic = res.sic?.trim();
  if (!sic) {
    console.log(`진행 중 [${idx}/${total}] ${name} — SIC 코드 없음`);
    return 'no_code';
  }

  const sectorTag = resolveSectorTag(sic, exactMap, majorGroupMap);

  const { error } = await supabase
    .from('cik_master')
    .update({ sic_code: sic, sic_description: res.sicDescription ?? null, sector_tag: sectorTag })
    .eq('cik', cik);

  if (error) {
    console.log(`진행 중 [${idx}/${total}] ${name} — 실패 (DB: ${error.message})`);
    return 'failed';
  }

  console.log(`진행 중 [${idx}/${total}] ${name} — SIC ${sic} → ${sectorTag}`);
  return 'ok';
}

async function main() {
  console.log('[fetchSicCodes] 시작...');

  const { data: mappingRows, error: mapErr } = await supabase
    .from('sector_mapping')
    .select('original_code, sector_tag')
    .eq('source', 'EDGAR');
  if (mapErr) throw new Error(`sector_mapping 조회 실패: ${mapErr.message}`);

  const exactMap      = new Map<string, string>();
  const majorGroupMap = new Map<string, string>();
  for (const r of mappingRows ?? []) {
    if (r.original_code.length === 4) exactMap.set(r.original_code, r.sector_tag);
    else majorGroupMap.set(r.original_code, r.sector_tag);
  }
  console.log(`[fetchSicCodes] SIC 매핑 로드 완료 — 상세코드 ${exactMap.size}개, major group ${majorGroupMap.size}개`);

  console.log('[fetchSicCodes] cik_master 목록 로딩 중...');
  const PAGE_SIZE = 1000;
  const companies: Array<{ cik: string; name: string }> = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: dbErr } = await supabase
      .from('cik_master')
      .select('cik, name')
      .order('name')
      .range(from, to);
    if (dbErr) throw new Error(`cik_master 조회 실패 (page ${page}): ${dbErr.message}`);
    if (!data || data.length === 0) break;
    companies.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`[fetchSicCodes] ${companies.length}개 기업 처리 시작\n`);

  let ok = 0, noCode = 0, failed = 0;
  const startAt = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const result = await processCompany(i + 1, companies.length, c.cik, c.name, exactMap, majorGroupMap);
    if (result === 'ok') ok++;
    else if (result === 'no_code') noCode++;
    else failed++;
    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(`\n성공 ${ok} / 코드없음 ${noCode} / 실패 ${failed} / 소요시간 ${mins}분`);
}

main().catch(err => {
  console.error('[fetchSicCodes] Fatal:', err.message);
  process.exit(1);
});

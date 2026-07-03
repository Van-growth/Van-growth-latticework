// corp_master 상장기업(stock_code IS NOT NULL)의 DART company.json을 호출해
// KSIC 업종코드(induty_code)를 수집하고 sector_mapping으로 sector_tag를 산출해 저장.
// 실행: npx ts-node server/scripts/fetchKsicCodes.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
const dartKey     = process.env.DART_API_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
if (!dartKey)                      throw new Error('Missing DART_API_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const DART_BASE   = 'https://opendart.fss.or.kr/api';
const DELAY_MS    = 300;
const RETRY_WAIT  = 5_000;
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

interface CompanyResponse {
  status: string;
  message?: string;
  induty_code?: string;
}

async function fetchDart(url: string, attempt = 0): Promise<CompanyResponse | null> {
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) return null;
      console.log(`  [429] 5초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_WAIT);
      return fetchDart(url, attempt + 1);
    }
    if (!res.ok) return null;
    return (await res.json()) as CompanyResponse;
  } catch {
    if (attempt >= MAX_RETRIES) return null;
    await sleep(RETRY_WAIT);
    return fetchDart(url, attempt + 1);
  }
}

async function processCompany(
  idx: number,
  total: number,
  corpCode: string,
  corpName: string,
  divisionMap: Map<string, string>,
): Promise<'ok' | 'no_code' | 'failed'> {
  const url =
    `${DART_BASE}/company.json?crtfc_key=${encodeURIComponent(dartKey!)}` +
    `&corp_code=${corpCode}`;

  const res = await fetchDart(url);
  if (!res || res.status !== '000') {
    console.log(`진행 중 [${idx}/${total}] ${corpName} — 실패 (API: ${res?.message ?? 'unknown'})`);
    return 'failed';
  }

  const industryCode = res.induty_code?.trim();
  if (!industryCode) {
    console.log(`진행 중 [${idx}/${total}] ${corpName} — induty_code 없음`);
    return 'no_code';
  }

  const division  = industryCode.slice(0, 2);
  const sectorTag = divisionMap.get(division) ?? 'OTHER';

  const { error } = await supabase
    .from('corp_master')
    .update({ ksic_code: industryCode, sector_tag: sectorTag })
    .eq('corp_code', corpCode);

  if (error) {
    console.log(`진행 중 [${idx}/${total}] ${corpName} — 실패 (DB: ${error.message})`);
    return 'failed';
  }

  console.log(`진행 중 [${idx}/${total}] ${corpName} — ${industryCode} → ${sectorTag}`);
  return 'ok';
}

async function main() {
  console.log('[fetchKsicCodes] 시작...');

  const { data: mappingRows, error: mapErr } = await supabase
    .from('sector_mapping')
    .select('original_code, sector_tag')
    .eq('source', 'DART');
  if (mapErr) throw new Error(`sector_mapping 조회 실패: ${mapErr.message}`);

  const divisionMap = new Map<string, string>(
    (mappingRows ?? []).map(r => [r.original_code, r.sector_tag]),
  );
  console.log(`[fetchKsicCodes] KSIC division 매핑 ${divisionMap.size}개 로드 완료`);

  console.log('[fetchKsicCodes] corp_master 상장기업 목록 로딩 중...');
  const PAGE_SIZE = 1000;
  const companies: Array<{ corp_code: string; corp_name: string }> = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    const { data, error: dbErr } = await supabase
      .from('corp_master')
      .select('corp_code, corp_name')
      .not('stock_code', 'is', null)
      .order('corp_name')
      .range(from, to);
    if (dbErr) throw new Error(`corp_master 조회 실패 (page ${page}): ${dbErr.message}`);
    if (!data || data.length === 0) break;
    companies.push(...data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  console.log(`[fetchKsicCodes] ${companies.length}개 상장기업 처리 시작\n`);

  let ok = 0, noCode = 0, failed = 0;
  const startAt = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const result = await processCompany(i + 1, companies.length, c.corp_code, c.corp_name, divisionMap);
    if (result === 'ok') ok++;
    else if (result === 'no_code') noCode++;
    else failed++;
    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(`\n성공 ${ok} / 코드없음 ${noCode} / 실패 ${failed} / 소요시간 ${mins}분`);
}

main().catch(err => {
  console.error('[fetchKsicCodes] Fatal:', err.message);
  process.exit(1);
});

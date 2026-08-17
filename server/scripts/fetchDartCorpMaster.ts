// corp_master 전체 확장(2026-08-17, "분석 시작 전 공시 데이터 존재 여부 사전 확인" 작업
// 계기) — 지금까지 corp_master는 DART 상장기업 3,971개만 적재돼 있었음(어떤 일회성
// 프로세스로 채워졌는지 이 저장소엔 기록이 없음). 사전확인 단계가 "비상장 외감법인도
// DART에 감사보고서가 있을 수 있다"는 이유로 항상 오탐(공시 없음)을 내는 문제를 해결하려면
// corp_master 자체가 DART가 발급한 전체 corp_code(상장+비상장 외감법인 포함)를 담아야 한다.
//
// DART corpCode.xml API는 ZIP(단일 CORPCODE.xml 포함)으로만 응답한다 — 이 저장소에 ZIP
// 처리 코드가 없어 adm-zip(순수 JS, 의존성 없음) 신규 추가. XML 파싱은 이미 의존성으로
// 있는 cheerio를 xmlMode로 재사용(새 파서 라이브러리 추가 안 함).
//
// 실행: npx ts-node server/scripts/fetchDartCorpMaster.ts
// 소요: corpCode.xml 자체엔 10만+ 행이 있고, 그중 상당수는 stock_code 없는(비상장) 폐업/
// 휴면 법인까지 포함 — 필터 없이 전량 upsert(디스크 용량보다 "이 회사가 실제로 DART에
// 등록돼 있는가"라는 존재 판정 정확도가 이 사전확인 기능엔 더 중요하다는 판단).
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import AdmZip from 'adm-zip';
import * as cheerio from 'cheerio';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dartKey     = process.env.DART_API_KEY;

if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
if (!dartKey)                      throw new Error('Missing DART_API_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

interface CorpRow {
  corp_code: string;
  corp_name: string;
  stock_code: string | null;
  modify_date: string | null;
}

async function fetchCorpCodeXml(): Promise<string> {
  const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${encodeURIComponent(dartKey!)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`corpCode.xml 요청 실패: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());

  // DART가 API 키 오류 등을 JSON으로 반환하는 경우 ZIP이 아니라 JSON이 옴 — 매직바이트로 구분.
  const isZip = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // 'PK'
  if (!isZip) {
    throw new Error(`ZIP이 아닌 응답 수신 — DART API 오류 가능성: ${buffer.toString('utf8').slice(0, 300)}`);
  }

  const zip = new AdmZip(buffer);
  const entry = zip.getEntries().find(e => e.entryName.toLowerCase().endsWith('.xml'));
  if (!entry) throw new Error('ZIP 안에 XML 파일을 찾지 못함');
  return entry.getData().toString('utf8');
}

function parseCorpCodeXml(xml: string): CorpRow[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const rows: CorpRow[] = [];
  $('list').each((_, el) => {
    const corp_code   = $(el).find('corp_code').text().trim();
    const corp_name   = $(el).find('corp_name').text().trim();
    const stock_code  = $(el).find('stock_code').text().trim();
    const modify_date = $(el).find('modify_date').text().trim();
    if (!corp_code || !corp_name) return;
    rows.push({
      corp_code,
      corp_name,
      stock_code: stock_code || null,
      modify_date: modify_date || null,
    });
  });
  return rows;
}

async function main() {
  console.log('[fetchDartCorpMaster] corpCode.xml 다운로드 중...');
  const xml = await fetchCorpCodeXml();
  console.log(`[fetchDartCorpMaster] XML 수신 완료 (${(xml.length / 1_000_000).toFixed(1)}MB) — 파싱 중...`);

  const rows = parseCorpCodeXml(xml);
  const listed = rows.filter(r => r.stock_code).length;
  console.log(`[fetchDartCorpMaster] 파싱 완료 — 전체 ${rows.length}개 (상장 ${listed} / 비상장·외감법인 등 ${rows.length - listed})`);

  const BATCH = 1000;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({ ...r, synced_at: new Date().toISOString() }));
    const { error } = await supabase.from('corp_master').upsert(batch, { onConflict: 'corp_code' });
    if (error) {
      console.error(`[fetchDartCorpMaster] 배치 실패 (rows ${i}~${i + batch.length}):`, error.message);
      process.exit(1);
    }
    done += batch.length;
    console.log(`[fetchDartCorpMaster] upsert 진행 ${done}/${rows.length}`);
  }

  console.log(`\n[fetchDartCorpMaster] 완료 — corp_master 총 ${rows.length}개 행 upsert (상장 ${listed} / 비상장 등 ${rows.length - listed})`);
}

main().catch(err => {
  console.error('[fetchDartCorpMaster] Fatal:', err);
  process.exit(1);
});

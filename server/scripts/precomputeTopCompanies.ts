// 주요 기업 ~150개를 미리 분석해 analyses 테이블에 저장.
// 실행: 서버를 먼저 띄운 뒤 npx ts-node server/scripts/precomputeTopCompanies.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SERVER_URL  = process.env.PRECOMPUTE_SERVER_URL ?? 'http://localhost:4000';
const DELAY_MS    = 5_000;   // Claude API 과부하 방지 딜레이 (새 분석 후에만 적용)
const FETCH_TIMEOUT_MS = 120_000; // 분석 1회 최대 대기

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── 대상 기업 목록 ────────────────────────────────────────────────────────────

const COMPANIES: string[] = [
  // ── 미국 S&P 100 (101개) ────────────────────────────────────────────────────
  'Apple', 'Microsoft', 'Nvidia', 'Amazon', 'Alphabet', 'Meta', 'Tesla',
  'Berkshire Hathaway', 'Broadcom', 'JP Morgan Chase', 'Eli Lilly', 'Visa',
  'UnitedHealth', 'Exxon Mobil', 'Johnson & Johnson', 'Mastercard',
  'Procter & Gamble', 'Home Depot', 'Costco', 'Bank of America', 'Salesforce',
  'Netflix', 'AMD', 'Adobe', 'Walmart', 'Chevron', 'Wells Fargo', 'Merck',
  'Oracle', 'Goldman Sachs', 'T-Mobile', 'Cisco', 'Accenture', 'Danaher',
  'Boeing', 'Caterpillar', 'Pfizer', 'Morgan Stanley', 'BlackRock', 'Medtronic',
  'Honeywell', 'Thermo Fisher', 'Pepsico', 'Coca-Cola', 'Intuit', 'Qualcomm',
  'Bristol Myers', 'Amgen', 'Gilead', 'Starbucks', 'American Express',
  'Charles Schwab', 'Colgate', 'General Electric', 'Raytheon', 'Lockheed Martin',
  'Northrop Grumman', 'Deere', '3M', 'Mondelez', 'Marriott', 'Hilton',
  'Delta Air Lines', 'United Airlines', 'FedEx', 'UPS', 'Target', 'CVS Health',
  'Cigna', 'Anthem', 'Humana', 'Moderna', 'Regeneron', 'Vertex',
  'Intuitive Surgical', 'Edwards Lifesciences', 'Zimmer Biomet', 'PayPal',
  'Square', 'Coinbase', 'Palantir', 'Snowflake', 'Datadog', 'CrowdStrike',
  'Cloudflare', 'MongoDB', 'Twilio', 'Zoom', 'Spotify', 'Airbnb', 'DoorDash',
  'Lyft', 'Uber', 'Rivian', 'Lucid', 'Rocket Lab', 'SpaceX', 'OpenAI',
  'Anthropic', 'Stripe', 'Ramp',

  // ── 한국 코스피 시총 상위 50개 ────────────────────────────────────────────
  '삼성전자', 'SK하이닉스', 'LG에너지솔루션', '삼성바이오로직스', '현대차',
  '기아', 'POSCO홀딩스', '삼성SDI', 'LG화학', '셀트리온', 'KB금융', '신한지주',
  '하나금융지주', '우리금융지주', '카카오', '네이버', '현대모비스', 'LG전자',
  '삼성물산', 'SK이노베이션', '롯데케미칼', '두산에너빌리티', 'HD현대',
  '한국전력', 'SK텔레콤', 'KT', 'LG', 'SK', '삼성생명', '삼성화재',
  '고려아연', '엔씨소프트', '크래프톤', '카카오뱅크', '토스', '쿠팡',
  '한화에어로스페이스', '한화오션', 'HD현대중공업', '현대건설',
  'GS칼텍스', 'S-Oil', '롯데쇼핑', '이마트', 'CJ제일제당', '오리온',
  '아모레퍼시픽', 'LG생활건강', '유한양행', '종근당',
];

// ── 24시간 캐시 체크 (Supabase 직접 조회) ────────────────────────────────────

async function isFullyCached(companyName: string): Promise<boolean> {
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('name', companyName)
    .maybeSingle();
  if (!company) return false;

  const { data: cached } = await supabase
    .from('analyses')
    .select('summary_v2, industry_history_v2, tech_evolution_v2, value_chain_v2, business_model_v2, competitors_v2, strategy_v2, financials_v2, founder_v2')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!cached) return false;

  // 모든 배치 데이터가 있어야 완전 캐시로 인정
  return !!(
    cached.summary_v2 &&
    cached.industry_history_v2 && cached.business_model_v2 && cached.competitors_v2 &&
    cached.tech_evolution_v2   && cached.value_chain_v2    && cached.strategy_v2 &&
    cached.financials_v2       && cached.founder_v2
  );
}

// ── /api/analyze 호출 (비스트리밍 JSON, company upsert + DB 저장 포함) ─────────

async function analyzeAndSave(companyName: string): Promise<void> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${SERVER_URL}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ companyName }),
      signal:  ac.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} — ${body.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

async function main() {
  // 서버 헬스체크
  try {
    const ac = new AbortController();
    const t  = setTimeout(() => ac.abort(), 5_000);
    const h  = await fetch(`${SERVER_URL}/health`, { signal: ac.signal });
    clearTimeout(t);
    if (!h.ok) throw new Error(`status ${h.status}`);
    console.log(`[precompute] 서버 연결 확인: ${SERVER_URL}`);
  } catch (err: any) {
    console.error(`[precompute] 서버 연결 실패 (${SERVER_URL})`);
    console.error('  → server/ 디렉토리에서 npm run dev 로 서버를 먼저 실행하세요.');
    console.error(`  원인: ${err.message}`);
    process.exit(1);
  }

  const total = COMPANIES.length;
  console.log(`[precompute] 시작 — 대상 ${total}개 기업\n`);

  let newCount  = 0;
  let hitCount  = 0;
  let failCount = 0;
  const startAt = Date.now();

  for (let i = 0; i < total; i++) {
    const name = COMPANIES[i];
    const idx  = `[${i + 1}/${total}]`;

    try {
      const cached = await isFullyCached(name);

      if (cached) {
        console.log(`진행 중 ${idx} ${name} — 캐시 히트, 스킵`);
        hitCount++;
        continue;
      }

      await analyzeAndSave(name);
      console.log(`진행 중 ${idx} ${name} — 저장 완료`);
      newCount++;
      await sleep(DELAY_MS);

    } catch (err: any) {
      console.error(`진행 중 ${idx} ${name} — 실패 (${err.message})`);
      failCount++;
      await sleep(DELAY_MS);
    }
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(`\n새로 분석 ${newCount} / 캐시 히트 ${hitCount} / 실패 ${failCount} / 소요시간 ${mins}분`);
}

main().catch(err => {
  console.error('[precompute] Fatal:', err.message);
  process.exit(1);
});

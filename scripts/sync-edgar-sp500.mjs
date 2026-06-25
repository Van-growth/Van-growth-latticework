#!/usr/bin/env node
/**
 * EDGAR S&P500 재무 데이터 배치 수집 → financial_cache 저장
 *
 * 실행:
 *   node scripts/sync-edgar-sp500.mjs              # 전체 (우선순위 → SP500)
 *   node scripts/sync-edgar-sp500.mjs --priority   # Top 20만
 *   node scripts/sync-edgar-sp500.mjs --force      # 만료 미도래 캐시도 갱신
 *   node scripts/sync-edgar-sp500.mjs AAPL MSFT    # 특정 티커만
 *
 * 필요 env: SUPABASE_URL, SUPABASE_ANON_KEY (server/.env 자동 로드)
 * SEC rate limit: 10 req/s → 150ms 간격 사용 (≈6 req/s)
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Env 로드 ──────────────────────────────────────────────────────────────────
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

// ── 설정 ──────────────────────────────────────────────────────────────────────
const EDGAR_HEADERS    = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };
const RATE_LIMIT_MS    = 150;   // 6-7 req/s (SEC 제한: 10 req/s)
const FETCH_TIMEOUT_MS = 20_000;
const CACHE_MONTHS     = 3;     // financial_cache expires_at

// ── 우선 처리 티커 (사용자 지정 Top 20 + 대형 tech) ─────────────────────────
// 비상장(Anthropic, OpenAI, Stripe, Ramp, SpaceX)은 EDGAR 없으므로 제외
const PRIORITY_TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AVGO', 'JPM',  'LLY',
  'PLTR', 'CRM',  'NFLX', 'AMD',   'QCOM', 'ORCL', 'ADBE', 'INTC', 'TXN',  'INTU',
];

// ── S&P500 전체 (~500 티커) ───────────────────────────────────────────────────
const SP500_TICKERS = [
  // Mega-cap tech
  'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','AVGO','ORCL',
  'ADBE','CRM','CSCO','INTC','TXN','INTU','AMAT','KLAC','LRCX','SNPS',
  'CDNS','NXPI','MCHP','MU','ADI','ON','STX','WDC','HPQ','HPE',
  'IBM','DELL','ACN','CTSH','IT','EPAM','GDDY','GEN','CDW','FFIV',
  'ANSS','PAYC','WDAY','DDOG','ZS','CRWD','PANW','FTNT','OKTA','NET',
  'DOCN','TWLO','MDB','ESTC','SNOW','PLTR','APP','RBLX','UBER','LYFT',
  'AMD','QCOM','ARM','AVGO','MRVL','SWKS','QRVO','MPWR','WOLF','OLED',
  // Finance
  'JPM','BAC','WFC','GS','MS','C','BLK','SCHW','AXP','COF',
  'USB','PNC','TFC','FITB','HBAN','RF','MTB','KEY','ZION','CFG',
  'MCO','SPGI','ICE','CME','CBOE','MSCI','FDS','BR','NDAQ','MKTX',
  'V','MA','PYPL','SQ','FIS','FISV','GPN','WEX','FOUR','PAYO',
  'BRK-B','AFL','AIG','ALL','CB','HIG','MET','PRU','UNM','GL',
  'MMC','AON','AJG','WTW','RYAN','ERIE','PGR','TRV','RNR','ACGL',
  'JPM','BAM','APO','KKR','CG','BX','ARES','TPG','BLUE',
  // Healthcare
  'LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','DHR','BMY',
  'AMGN','GILD','REGN','VRTX','ISRG','SYK','BSX','EW','ZTS','BIIB',
  'ILMN','IDXX','WST','MTD','WAT','IQV','A','LH','DGX','HOLOGIC',
  'RMD','PODD','INSP','NVCR','MASI','HOLX','SWAV','ALGN','SGEN',
  'HCA','THC','UHS','MOH','CVS','MCK','ABS','CAH','OMI','PRGO',
  'CI','ELV','HUM','CNC','ANTM','WCG','HLI','DVA','SGFY',
  // Consumer Disc
  'AMZN','TSLA','HD','MCD','SBUX','NKE','LOW','TJX','BKNG','ABNB',
  'MAR','HLT','WYNN','MGM','CZR','RCL','CCL','NCLH','H','CHH',
  'DIS','CMCSA','NFLX','PARA','WBD','LYV','OMC','IPG','FOXA','FOX',
  'ORLY','AZO','AAP','GPC','LKQ','KMX','AN','LAD','CVNA',
  'ROST','DLTR','DG','FIVE','OLLI','BJ','COST','WMT','TGT','KR',
  'YUM','QSR','DINE','EAT','DRI','TXRH','WEN','JACK','SHAK',
  // Consumer Staples
  'PG','KO','PEP','PM','MO','MDLZ','CL','CHD','EL','KMB',
  'HRL','CAG','GIS','K','SJM','CPB','MKC','NEM','CLX','COTY',
  'KHC','KVUE','STZ','BF-B','TAP','SAM','DEO',
  // Energy
  'XOM','CVX','COP','EOG','SLB','PSX','VLO','MPC','HES','DVN',
  'PXD','FANG','APA','OXY','HAL','BKR','NOV','VAL','RIG',
  'OKE','KMI','WMB','EPD','ET','MMP','TRGP','DT','LNG',
  // Industrials
  'GE','RTX','HON','CAT','DE','EMR','ETN','ITW','PH','GD',
  'BA','LMT','NOC','L3H','HII','TXT','HEI','HEICO','AXON',
  'UPS','FDX','UNP','NSC','CSX','WAB','GWR','CHRW','JBHT','XPO',
  'CARR','OTIS','JCI','TT','LII','ALLE','AZEK','TREX',
  'MMM','DOV','IR','ROK','GNRC','XYL','REXN','IDEX','FLOW',
  'CTAS','PAYC','ADP','PAYX','NSP','MAN','KELYA','HSII',
  // Materials
  'LIN','APD','ECL','NEM','FCX','SCCO','AA','ALB','SQM','LIVENT',
  'NUE','STLD','CLF','X','RS','WOR','LECO','ATI','TKR',
  'PPG','SHW','RPM','FMC','CE','LYB','DOW','DD','CC',
  // Utilities
  'NEE','DUK','SO','D','AEP','EXC','SRE','XEL','ED','PCG',
  'AWK','WEC','DTE','CMS','NI','AEE','LNT','EVRG','IDA','PNW',
  'CNP','OGE','NWE','AVA','MGEE',
  // Real Estate
  'PLD','AMT','EQIX','CCI','DLR','WELL','PSA','SPG','EXR','AVB',
  'EQR','UDR','CPT','MAA','NNN','O','STAG','FR','REXR','LPT',
  'VTR','PEAK','OHI','DOC','IIPR','MPW',
  // Comm Services
  'GOOGL','META','NFLX','DIS','CMCSA','T','VZ','TMUS','CHTR','PARA',
  'SNAP','PINS','MTCH','BMBL','IAC','ZM','RNG','TWLO',
].filter((v, i, a) => a.indexOf(v) === i); // 중복 제거

// ── CLI 인자 파싱 ─────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const FORCE    = args.includes('--force');
const PRIORITY_ONLY = args.includes('--priority');
const manualTickers = args.filter(a => !a.startsWith('--')).map(a => a.toUpperCase());

let targetTickers;
if (manualTickers.length > 0) {
  targetTickers = manualTickers;
} else if (PRIORITY_ONLY) {
  targetTickers = PRIORITY_TICKERS;
} else {
  // 우선순위 티커 먼저, 그 다음 나머지 SP500
  const rest = SP500_TICKERS.filter(t => !PRIORITY_TICKERS.includes(t));
  targetTickers = [...PRIORITY_TICKERS, ...rest];
}

// ── 이미 캐시된 티커 목록 조회 ────────────────────────────────────────────────
async function fetchCachedTickers() {
  const cutoff = new Date().toISOString();
  const url = `${SUPABASE_URL}/rest/v1/financial_cache?select=company_name&expires_at=gt.${cutoff}`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map(r => r.company_name));
}

// ── cik_master에서 CIK 조회 ───────────────────────────────────────────────────
async function lookupCik(ticker) {
  const url = `${SUPABASE_URL}/rest/v1/cik_master?ticker=ilike.${encodeURIComponent(ticker)}&select=cik,name&limit=1`;
  const res = await fetch(url, {
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

// ── EDGAR company_facts API 호출 ──────────────────────────────────────────────
async function fetchCompanyFacts(cik) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      { headers: EDGAR_HEADERS, signal: controller.signal },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── XBRL 최신 10-K 값 추출 ───────────────────────────────────────────────────
function getLatestAnnual(gaap, ...concepts) {
  let best = null;
  for (const concept of concepts) {
    const units = gaap?.[concept]?.units?.USD;
    if (!units) continue;
    const annual = units
      .filter(u => ['10-K', '20-F'].includes(u.form) && u.val !== 0)
      .sort((a, b) => b.end.localeCompare(a.end));
    const top = annual[0];
    if (top && (!best || top.end > best.end)) best = top;
  }
  return best ? { val: best.val, year: best.end.slice(0, 4) } : null;
}

// ── USD 포맷 ──────────────────────────────────────────────────────────────────
function fmtUsd(val) {
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  const b    = abs / 1_000_000_000;
  return b >= 1
    ? `${sign}${b.toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

// ── 재무 컨텍스트 텍스트 빌드 (financialContext.ts의 buildEdgarContext와 동일 포맷) ──
function buildContextText(entityName, cik, ticker, fin) {
  const lines = [
    '=== SEC EDGAR 재무 데이터 (pre-cached) ===',
    `기업: ${entityName}  (CIK: ${cik}${ticker ? `  ticker: ${ticker}` : ''})`,
  ];

  const year = fin.year;
  if (!year) return lines.join('\n');

  lines.push(`\n[${year} 연간 손익계산서]`);
  if (fin.revenue != null)   lines.push(`· Revenue         ${fmtUsd(fin.revenue)}  (EDGAR)`);
  if (fin.grossProfit != null) lines.push(`· Gross Profit    ${fmtUsd(fin.grossProfit)}  (EDGAR)`);
  if (fin.opIncome != null)  lines.push(`· Operating Inc.  ${fmtUsd(fin.opIncome)}  (EDGAR)`);
  if (fin.netIncome != null) lines.push(`· Net Income      ${fmtUsd(fin.netIncome)}  (EDGAR)`);
  if (fin.opIncome != null && fin.da != null)
    lines.push(`· EBITDA          ${fmtUsd(fin.opIncome + fin.da)}  (EDGAR)`);

  lines.push(`\n[재무상태표]`);
  if (fin.cash != null)       lines.push(`· Cash            ${fmtUsd(fin.cash)}  (EDGAR)`);
  if (fin.totalAssets != null) lines.push(`· Total Assets    ${fmtUsd(fin.totalAssets)}  (EDGAR)`);
  if (fin.totalLiab != null)  lines.push(`· Total Liab.     ${fmtUsd(fin.totalLiab)}  (EDGAR)`);
  if (fin.totalEquity != null) lines.push(`· Total Equity    ${fmtUsd(fin.totalEquity)}  (EDGAR)`);

  lines.push(`\n[현금흐름]`);
  if (fin.opCF != null)  lines.push(`· Operating CF    ${fmtUsd(fin.opCF)}  (EDGAR)`);
  if (fin.invCF != null) lines.push(`· Investing CF    ${fmtUsd(fin.invCF)}  (EDGAR)`);
  if (fin.finCF != null) lines.push(`· Financing CF    ${fmtUsd(fin.finCF)}  (EDGAR)`);

  lines.push('→ 재무 섹션에 이 수치들을 사용하고 출처 (EDGAR)를 명시하세요.');
  return lines.join('\n');
}

// ── financial_cache upsert ────────────────────────────────────────────────────
async function upsertCache(ticker, contextText) {
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + CACHE_MONTHS);

  const body = [{
    company_name: ticker,
    source:       'edgar',
    context_text: contextText,
    expires_at:   expiresAt.toISOString(),
  }];

  const res = await fetch(`${SUPABASE_URL}/rest/v1/financial_cache`, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase 오류 ${res.status}: ${txt}`);
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n📊  EDGAR S&P500 재무 데이터 동기화`);
  console.log(`   대상: ${targetTickers.length}개 티커  force=${FORCE}\n`);

  // 이미 캐시된 티커 (force=false면 스킵)
  const cached = FORCE ? new Set() : await fetchCachedTickers();
  console.log(`   기존 캐시: ${cached.size}개\n`);

  let ok = 0, skip = 0, fail = 0, noData = 0;
  const failures = [];

  for (let i = 0; i < targetTickers.length; i++) {
    const ticker = targetTickers[i];
    const prefix = `[${String(i + 1).padStart(3)}/${targetTickers.length}] ${ticker.padEnd(6)}`;

    // 캐시 스킵
    if (cached.has(ticker)) {
      process.stdout.write(`${prefix} ⏭  (캐시 있음)\n`);
      skip++;
      continue;
    }

    // cik_master 조회
    const cikRow = await lookupCik(ticker);
    if (!cikRow) {
      process.stdout.write(`${prefix} ⚠  CIK 없음 (cik_master 미등록)\n`);
      noData++;
      await sleep(RATE_LIMIT_MS);
      continue;
    }

    const { cik, name: entityName } = cikRow;
    process.stdout.write(`${prefix} 📥 CIK ${cik} 조회 중...`);

    // EDGAR company_facts 호출
    await sleep(RATE_LIMIT_MS);
    const facts = await fetchCompanyFacts(cik);
    if (!facts) {
      process.stdout.write(` ❌ EDGAR 응답 없음\n`);
      fail++;
      failures.push(ticker);
      continue;
    }

    // 재무 데이터 추출
    const gaap = facts.facts?.['us-gaap'] ?? {};

    const revenue    = getLatestAnnual(gaap, 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet');
    const grossProfit = getLatestAnnual(gaap, 'GrossProfit');
    const opIncome   = getLatestAnnual(gaap, 'OperatingIncomeLoss');
    const netIncome  = getLatestAnnual(gaap, 'NetIncomeLoss', 'ProfitLoss');
    const assets     = getLatestAnnual(gaap, 'Assets');
    const liab       = getLatestAnnual(gaap, 'Liabilities');
    const equity     = getLatestAnnual(gaap, 'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest');
    const cash       = getLatestAnnual(gaap, 'CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments');
    const opCF       = getLatestAnnual(gaap, 'NetCashProvidedByUsedInOperatingActivities');
    const invCF      = getLatestAnnual(gaap, 'NetCashProvidedByUsedInInvestingActivities');
    const finCF      = getLatestAnnual(gaap, 'NetCashProvidedByUsedInFinancingActivities');
    const da         = getLatestAnnual(gaap, 'DepreciationDepletionAndAmortization', 'DepreciationAndAmortization');

    // 핵심 수치가 하나도 없으면 저장 스킵
    if (!revenue && !netIncome && !assets) {
      process.stdout.write(` ⚠  XBRL 데이터 없음\n`);
      noData++;
      continue;
    }

    const fin = {
      year:        revenue?.year ?? opIncome?.year ?? netIncome?.year,
      revenue:     revenue?.val,
      grossProfit: grossProfit?.val,
      opIncome:    opIncome?.val,
      netIncome:   netIncome?.val,
      totalAssets: assets?.val,
      totalLiab:   liab?.val,
      totalEquity: equity?.val,
      cash:        cash?.val,
      opCF:        opCF?.val,
      invCF:       invCF?.val,
      finCF:       finCF?.val,
      da:          da?.val,
    };

    const contextText = buildContextText(facts.entityName ?? entityName, cik, ticker, fin);

    // financial_cache 저장
    await upsertCache(ticker, contextText);
    process.stdout.write(` ✅ ${fin.year ?? '?'} rev=${revenue ? fmtUsd(revenue.val) : '—'}\n`);
    ok++;
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 저장: ${ok}개
⏭  스킵(기존 캐시): ${skip}개
⚠  데이터 없음: ${noData}개
❌ 실패: ${fail}개${failures.length ? `  (${failures.join(', ')})` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  if (failures.length) {
    console.log('실패 티커 재시도: node scripts/sync-edgar-sp500.mjs ' + failures.join(' '));
  }
}

main().catch(e => { console.error('❌ Fatal:', e.message); process.exit(1); });

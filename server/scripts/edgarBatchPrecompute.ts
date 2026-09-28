// Russell 1000 기업의 EDGAR Company Facts를 배치로 수집해 financial_cache에 저장.
// 실행: npx ts-node server/scripts/edgarBatchPrecompute.ts
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ⚠️ 이 import는 dotenv.config() 호출 뒤에 있어야 한다 — edgar.ts가 모듈 최상단에서
// ./supabase(createClient)를 평가하는데, 그게 dotenv.config()보다 먼저 실행되면
// "Missing SUPABASE_URL" 에러로 죉는다(TS→CommonJS 컴파일은 import를 파일 맨 위로
// 몰지 않고 소스상 위치 그대로 실행 — repo 루트에서 `npx ts-node server/scripts/...`로
// 실행할 때만 재현되는 문제라 실측 확인 필요했음, 2026-09).
import { extractAnnualSeries, pickConceptSeries, pickConceptSeriesWithConflict } from '../src/lib/edgar';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회 필요 — anon key로는 쓰기 작업이 막힘
if (!supabaseUrl || !supabaseKey) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

const EDGAR_HEADERS = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };
const DELAY_MS      = 300;
const RETRY_WAIT_MS = 10_000;
const MAX_RETRIES   = 3;
const BATCH_LIMIT   = Infinity; // 전체 처리

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchEdgar(url: string, attempt = 0): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS });
    if (res.status === 429) {
      if (attempt >= MAX_RETRIES) return null;
      console.log(`  [429] 10초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_WAIT_MS);
      return fetchEdgar(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (attempt >= MAX_RETRIES) return null;
    await sleep(RETRY_WAIT_MS);
    return fetchEdgar(url, attempt + 1);
  }
}

// extractAnnualSeries/pickConceptSeries/pickConceptSeriesWithConflict는 server/src/lib/edgar.ts에서
// import(위 참고) — 예전엔 "별도 실행 컨텍스트"라는 이유로 이 스크립트에 로직이 복제돼 있었는데,
// 라이브 조회 경로만 고치고 이 배치 스크립트를 깜빡하는 사고가 반복돼(현금흐름/GrossProfit/은행
// 계정과목 등, CLAUDE.md 실전 발견 이력 참고) 2026-09 Alphabet 사고를 계기로 단일 소스로 통합.
function fmtUsd(val: number | null): string {
  if (val == null) return 'Not disclosed';
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  return abs >= 1_000_000_000
    ? `${sign}${(abs / 1_000_000_000).toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

// 최신 연도 값 하나만 null인 것과, 전 연도에 걸쳐 그 concept 자체가 없는 것(예: Berkshire
// Hathaway처럼 지주회사/보험 등 복합 사업구조라 SEC에 연결 OperatingIncomeLoss를 아예
// 태깅하지 않는 경우)을 구분. 후자는 데이터 조회 실패가 아니라 그 기업 재무제표의 구조이므로
// "확인 필요"(=파싱/조회 실패로 보임) 대신 "해당없음"으로 명시해 Claude가 오인하지 않게 한다.
function fmtUsdField(val: number | null, series: (number | null)[]): string {
  if (val != null) return fmtUsd(val);
  if (series.length > 0 && series.every(v => v == null)) return 'Not applicable (not structurally reported)';
  return 'Not disclosed';
}

export async function processCompany(
  idx: number,
  total: number,
  cikNum: number,
  ticker: string,
): Promise<boolean> {
  const cikPad = String(cikNum).padStart(10, '0');
  const data   = await fetchEdgar(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${cikPad}.json`,
  );

  if (!data?.facts?.['us-gaap']) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (us-gaap 데이터 없음)`);
    return false;
  }

  const g = data.facts['us-gaap'] as Record<string, any>;

  const revData  = pickConceptSeries(g,
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
  );
  const niResult = pickConceptSeriesWithConflict(g, 'NetIncomeLoss', 'ProfitLoss');
  const niData   = niResult.series;
  const oiData   = pickConceptSeries(g, 'OperatingIncomeLoss');
  const gpData   = pickConceptSeries(g, 'GrossProfit');
  const cashData = pickConceptSeries(g,
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
  );
  const aData    = pickConceptSeries(g, 'Assets');
  const lData    = pickConceptSeries(g, 'Liabilities');
  const eqData   = pickConceptSeries(g,
    'StockholdersEquity',
    'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest',
  );
  const epsData  = pickConceptSeries(g, 'EarningsPerShareBasic');
  const opCFData  = pickConceptSeries(g, 'NetCashProvidedByUsedInOperatingActivities');
  const invCFData = pickConceptSeries(g, 'NetCashProvidedByUsedInInvestingActivities');
  const finCFData = pickConceptSeries(g, 'NetCashProvidedByUsedInFinancingActivities');

  // 은행 재무제표 템플릿(2026-08-20, server/src/lib/edgar.ts와 동일 후보 — 이제 그 파일에서
  // 직접 import) — interestIncome은 InterestAndFeeIncomeLoansAndLeases(대출 이자만, 더 좁은
  // 개념)를 의도적으로 제외한 이유는 edgar.ts 주석 참고.
  const bankIntIncData    = pickConceptSeries(g, 'InterestIncomeOperating', 'InterestAndDividendIncomeOperating');
  const bankIntExpData    = pickConceptSeries(g, 'InterestExpense', 'InterestExpenseOperating');
  const bankNetIntData    = pickConceptSeries(g, 'InterestIncomeExpenseNet');
  const bankProvData      = pickConceptSeries(g, 'ProvisionForLoanLeaseAndOtherLosses', 'ProvisionForLoanLossesExpensed', 'ProvisionForCreditLossExpenseReversal', 'ProvisionForDoubtfulAccounts');
  const bankNonIntIncData = pickConceptSeries(g, 'NoninterestIncome');
  const bankNonIntExpData = pickConceptSeries(g, 'NoninterestExpense');
  const bankLoansGrossData = pickConceptSeries(g, 'FinancingReceivableExcludingAccruedInterestBeforeAllowanceForCreditLoss', 'NotesReceivableGross', 'LoansAndLeasesReceivableGrossCarryingAmount', 'LoansAndLeasesReceivableNetReportedAmount');
  const bankAllowanceData  = pickConceptSeries(g, 'FinancingReceivableAllowanceForCreditLossExcludingAccruedInterest', 'FinancingReceivableAllowanceForCreditLosses', 'LoansAndLeasesReceivableAllowance');
  const bankLoansNetData   = pickConceptSeries(g, 'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss', 'NotesReceivableNet', 'LoansAndLeasesReceivableNetOfDeferredIncome');
  const bankDepositsData   = pickConceptSeries(g, 'Deposits');
  const bankBorrowingsData = pickConceptSeries(g, 'LongTermDebt', 'ShortTermBorrowings', 'DebtLongtermAndShorttermCombinedAmount');

  // 회계연도 기준: 매출 우선, 없으면 순이익
  const fiscalYears = revData.length > 0
    ? revData.map(d => d.year)
    : niData.map(d => d.year);

  if (fiscalYears.length === 0) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (재무 수치 없음)`);
    return false;
  }

  const align = (series: Array<{ year: string; val: number }>) => {
    const m = new Map(series.map(d => [d.year, d.val]));
    return fiscalYears.map(y => m.get(y) ?? null);
  };

  const revenue         = align(revData);
  const grossProfit     = align(gpData);
  const netIncome       = align(niData);
  const operatingIncome = align(oiData);
  const assets          = align(aData);
  const liabilities     = align(lData);
  const equity          = align(eqData);
  const cash            = align(cashData);
  const eps             = align(epsData);
  const operatingCF     = align(opCFData);
  const investingCF     = align(invCFData);
  const financingCF     = align(finCFData);
  const bankInterestIncome = align(bankIntIncData);
  const bankInterestExpense = align(bankIntExpData);
  const bankNetInterestIncome = align(bankNetIntData);
  const bankProvisionCreditLosses = align(bankProvData);
  const bankNoninterestIncome = align(bankNonIntIncData);
  const bankNoninterestExpense = align(bankNonIntExpData);
  const bankLoansGross = align(bankLoansGrossData);
  const bankAllowanceForCreditLosses = align(bankAllowanceData);
  const bankLoansNet = align(bankLoansNetData);
  const bankDeposits = align(bankDepositsData);
  const bankBorrowings = align(bankBorrowingsData);

  const rawEdgar = {
    ticker,
    cik: `CIK${cikPad}`,
    revenue,
    grossProfit,
    netIncome,
    operatingIncome,
    assets,
    liabilities,
    equity,
    cash,
    eps,
    operatingCF,
    investingCF,
    financingCF,
    bankInterestIncome,
    bankInterestExpense,
    bankNetInterestIncome,
    bankProvisionCreditLosses,
    bankNoninterestIncome,
    bankNoninterestExpense,
    bankLoansGross,
    bankAllowanceForCreditLosses,
    bankLoansNet,
    bankDeposits,
    bankBorrowings,
    fiscalYears,
    filedAt: new Date().toISOString(),
    source: 'EDGAR',
  };

  // Claude 프롬프트에서 읽을 수 있는 context_text도 같이 저장 (기존 financialContext.ts 호환)
  const lines = [
    `=== SEC EDGAR financial data (batch precompute) ===`,
    `Company: ${data.entityName ?? ticker}  (CIK: CIK${cikPad}  ticker: ${ticker})`,
    ``,
    `[${fiscalYears[0]} income statement]`,
    `· Revenue          ${fmtUsd(revenue[0])}  (EDGAR)`,
    `· Gross Profit     ${fmtUsdField(grossProfit[0], grossProfit)}  (EDGAR)`,
    `· Operating Income ${fmtUsdField(operatingIncome[0], operatingIncome)}  (EDGAR)`,
    `· Net Income       ${fmtUsd(netIncome[0])}  (EDGAR)`,
    ...(niResult.conflictNote ? [`  (Note: ${niResult.conflictNote})`] : []),
    ...(operatingIncome.every(v => v == null)
      ? [`  (Note: this company never tags operating income in its SEC financial statements across ` +
         `any year — likely a holding company, insurer, or other complex segment structure that ` +
         `structurally doesn't report it. This isn't a lookup failure — label it "Not applicable" ` +
         `instead of "Not disclosed" in summary KPIs etc.)`]
      : []),
    ``,
    `[Balance sheet]`,
    `· Cash             ${fmtUsdField(cash[0], cash)}  (EDGAR)`,
    `· Total Assets     ${fmtUsd(assets[0])}  (EDGAR)`,
    `· Total Liab.      ${fmtUsd(liabilities[0])}  (EDGAR)`,
    `· Stockholders Eq. ${fmtUsd(equity[0])}  (EDGAR)`,
    ``,
    `[Cash flow]`,
    `· Operating CF     ${fmtUsdField(operatingCF[0], operatingCF)}  (EDGAR)`,
    `· Investing CF     ${fmtUsdField(investingCF[0], investingCF)}  (EDGAR)`,
    `· Financing CF     ${fmtUsdField(financingCF[0], financingCF)}  (EDGAR)`,
  ];
  if (fiscalYears.length > 1) {
    // 매출만 다년도로 주면 Claude가 나머지 계정과목의 과거 연도는 일반 지식으로 추측해
    // "(추정)"을 붙이거나 아예 "확인 필요"로 반환함 — 실제로는 EDGAR 다년치 원본이 이미
    // 있는데 프롬프트에 1개년치만 실려서 벌어지는 문제(2026-08 MSFT 재무탭 빈약 사고 원인).
    // 전 계정과목을 연도별로 명시해 Claude가 추측하지 않도록 한다.
    lines.push(``, `[Multi-year income statement / balance sheet trend — all official EDGAR figures, do not label "(estimated)"]`);
    fiscalYears.forEach((fy, i) => lines.push(
      `· ${fy}: Revenue ${fmtUsd(revenue[i])}` +
      `, Gross Profit ${fmtUsdField(grossProfit[i], grossProfit)}` +
      `, Operating Inc. ${fmtUsdField(operatingIncome[i], operatingIncome)}` +
      `, Net Income ${fmtUsd(netIncome[i])}` +
      `, Total Assets ${fmtUsd(assets[i])}` +
      `, Total Liab. ${fmtUsd(liabilities[i])}` +
      `, Equity ${fmtUsd(equity[i])}` +
      `, Cash ${fmtUsdField(cash[i], cash)}`,
    ));
  }
  lines.push(`→ Use these figures in the financials section and cite the (EDGAR) source.`);

  const contextText = lines.join('\n');
  const expiresAt   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('financial_cache')
    .upsert(
      {
        company_name: ticker,
        source:       'EDGAR',
        context_text: contextText,
        raw_edgar:    rawEdgar,
        expires_at:   expiresAt,
      },
      { onConflict: 'company_name' },
    );

  if (error) {
    console.log(`진행 중 [${idx}/${total}] ${ticker} — 실패 (DB: ${error.message})`);
    return false;
  }

  console.log(`진행 중 [${idx}/${total}] ${ticker} — 저장 완료`);
  return true;
}

async function main() {
  console.log('[edgarBatchPrecompute] 시작...');

  console.log('[edgarBatchPrecompute] SEC EDGAR 티커 목록 로딩 중...');
  const tickersJson = await fetchEdgar('https://www.sec.gov/files/company_tickers.json');
  if (!tickersJson) throw new Error('company_tickers.json 로드 실패');

  // SEC company_tickers.json: { "0": { cik_str, ticker, title }, ... }
  // 상위 BATCH_LIMIT개를 처리 (file entry 순서 기준)
  const companies = (
    Object.values(tickersJson) as Array<{ cik_str: number; ticker: string; title: string }>
  )
    .filter(e => e.cik_str && e.ticker)
    .slice(0, isFinite(BATCH_LIMIT) ? BATCH_LIMIT : undefined);

  console.log(`[edgarBatchPrecompute] ${companies.length}개 기업 처리 시작\n`);

  let success = 0;
  let failure = 0;
  const startAt = Date.now();

  for (let i = 0; i < companies.length; i++) {
    const { cik_str, ticker } = companies[i];
    const ok = await processCompany(i + 1, companies.length, cik_str, ticker);
    if (ok) success++; else failure++;
    if (i < companies.length - 1) await sleep(DELAY_MS);
  }

  const mins = ((Date.now() - startAt) / 60_000).toFixed(1);
  console.log(`\n성공 ${success} / 실패 ${failure} / 소요시간 ${mins}분`);
}

// require.main 가드 — 크론이 이 파일을 직접 실행할 때(main 트리거)와 다른 스크립트가
// processCompany()만 재사용하려고 import할 때(전체 배치 재실행 방지)를 구분.
if (require.main === module) {
  main().catch(err => {
    console.error('[edgarBatchPrecompute] Fatal:', err.message);
    process.exit(1);
  });
}

// FMP (Financial Modeling Prep) API client
// Env: FMP_API_KEY
// Docs: https://financialmodelingprep.com/developer/docs

const BASE = 'https://financialmodelingprep.com/api/v3';

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    // FMP returns {"Error Message": "..."} on key errors
    if ((data as any)?.['Error Message']) return null;
    return data as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FmpIncomeRow {
  date:            string;
  revenue:         number;
  grossProfit:     number;
  operatingIncome: number;
  netIncome:       number;
  ebitda:          number;
  eps:             number;
}

export interface FmpBalanceRow {
  date:               string;
  cashAndEquivalents: number;
  totalAssets:        number;
  totalLiabilities:   number;
  totalEquity:        number;
  totalDebt:          number;
}

export interface FmpCashflowRow {
  date:                  string;
  operatingCashFlow:     number;
  capitalExpenditure:    number;
  freeCashFlow:          number;
  dividendsPaid:         number;
}

export interface FmpKeyMetrics {
  date:                string;
  marketCap:           number;
  peRatioTTM:          number;
  priceToBookRatioTTM: number;
  roeTTM:              number;
  roicTTM:             number;
  debtToEquityTTM:     number;
  currentRatioTTM:     number;
}

export interface FmpData {
  symbol:     string;
  name:       string;
  income:     FmpIncomeRow[];
  balance:    FmpBalanceRow[];
  cashflow:   FmpCashflowRow[];
  keyMetrics: FmpKeyMetrics | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function usd(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return '확인 필요';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T USD`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(2)}B USD`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(1)}M USD`;
  return `${sign}${abs.toLocaleString()} USD`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchFmpData(companyName: string, ticker?: string | null): Promise<FmpData | null> {
  const key = process.env.FMP_API_KEY;
  if (!key) return null;

  // 1. ticker 확보 (passed in → 직접 사용, 없으면 name 검색)
  let symbol = ticker?.toUpperCase() ?? null;

  if (!symbol) {
    const searchRes = await fetchJson<Array<{ symbol: string; name: string }>>(
      `${BASE}/search?query=${encodeURIComponent(companyName)}&limit=5&apikey=${key}`,
    );
    if (!searchRes?.length) return null;
    // 가장 이름이 유사한 항목 선택 (첫 번째)
    symbol = searchRes[0].symbol;
  }

  // 2. 재무제표 3종 + key metrics 병렬
  const [incomeRes, balanceRes, cashflowRes, metricsRes] = await Promise.allSettled([
    fetchJson<FmpIncomeRow[]>(`${BASE}/income-statement/${symbol}?limit=5&apikey=${key}`),
    fetchJson<FmpBalanceRow[]>(`${BASE}/balance-sheet-statement/${symbol}?limit=5&apikey=${key}`),
    fetchJson<FmpCashflowRow[]>(`${BASE}/cash-flow-statement/${symbol}?limit=5&apikey=${key}`),
    fetchJson<FmpKeyMetrics[]>(`${BASE}/key-metrics-ttm/${symbol}?limit=1&apikey=${key}`),
  ]);

  const income   = incomeRes.status   === 'fulfilled' ? (incomeRes.value   ?? []) : [];
  const balance  = balanceRes.status  === 'fulfilled' ? (balanceRes.value  ?? []) : [];
  const cashflow = cashflowRes.status === 'fulfilled' ? (cashflowRes.value ?? []) : [];
  const kmArr    = metricsRes.status  === 'fulfilled' ? (metricsRes.value  ?? []) : [];

  if (!income.length && !balance.length) return null;

  return {
    symbol,
    name:       companyName,
    income,
    balance,
    cashflow,
    keyMetrics: kmArr[0] ?? null,
  };
}

// ── Context builder ───────────────────────────────────────────────────────────

export function buildFmpContext(d: FmpData): string {
  const lines: string[] = [
    `=== FMP (Financial Modeling Prep) 재무 데이터 ===`,
    `기업: ${d.name}  (티커: ${d.symbol})`,
  ];

  // 손익계산서 (최근 3년)
  if (d.income.length) {
    lines.push('\n[손익계산서 — FMP 기준]');
    lines.push('항목         | ' + d.income.slice(0, 3).map(r => r.date.slice(0, 4)).join(' | '));
    lines.push('-------------|' + d.income.slice(0, 3).map(() => '----------').join('|'));
    const rows: [string, keyof FmpIncomeRow][] = [
      ['매출',          'revenue'],
      ['매출총이익',    'grossProfit'],
      ['영업이익',      'operatingIncome'],
      ['순이익',        'netIncome'],
      ['EBITDA',       'ebitda'],
    ];
    for (const [label, field] of rows) {
      lines.push(
        `${label.padEnd(12)} | ` +
        d.income.slice(0, 3).map(r => usd(r[field] as number)).join(' | ')
      );
    }
    lines.push('→ 재무 섹션에 이 수치를 우선 사용하고 "(FMP)" 출처를 명시하세요.');
  }

  // 재무상태표 (최근 연도)
  if (d.balance.length) {
    const b = d.balance[0];
    lines.push('\n[재무상태표 — 최근 연도]');
    lines.push(`· 현금·현금성: ${usd(b.cashAndEquivalents)}`);
    lines.push(`· 총자산:      ${usd(b.totalAssets)}`);
    lines.push(`· 총부채:      ${usd(b.totalLiabilities)}`);
    lines.push(`· 자본총계:    ${usd(b.totalEquity)}`);
    lines.push(`· 총차입금:    ${usd(b.totalDebt)}`);
  }

  // 현금흐름 (최근 연도)
  if (d.cashflow.length) {
    const c = d.cashflow[0];
    lines.push('\n[현금흐름 — 최근 연도]');
    lines.push(`· 영업 CF:  ${usd(c.operatingCashFlow)}`);
    lines.push(`· CapEx:    ${usd(c.capitalExpenditure)}`);
    lines.push(`· FCF:      ${usd(c.freeCashFlow)}`);
  }

  // Key metrics
  if (d.keyMetrics) {
    const km = d.keyMetrics;
    lines.push('\n[Valuation & Profitability — TTM]');
    if (km.marketCap)           lines.push(`· 시가총액: ${usd(km.marketCap)}`);
    if (km.peRatioTTM)          lines.push(`· P/E:   ${km.peRatioTTM.toFixed(1)}x`);
    if (km.priceToBookRatioTTM) lines.push(`· P/B:   ${km.priceToBookRatioTTM.toFixed(2)}x`);
    if (km.roeTTM)              lines.push(`· ROE:   ${(km.roeTTM * 100).toFixed(1)}%`);
    if (km.roicTTM)             lines.push(`· ROIC:  ${(km.roicTTM * 100).toFixed(1)}%`);
    if (km.debtToEquityTTM)     lines.push(`· D/E:   ${km.debtToEquityTTM.toFixed(2)}`);
  }

  return lines.join('\n');
}

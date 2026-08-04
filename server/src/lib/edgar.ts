// SEC EDGAR API client
import * as cheerio from 'cheerio';
import { supabase } from './supabase';

const EDGAR_HEADERS = { 'User-Agent': 'Latticework sg.van.p@gmail.com' };

async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 8-K 본문(primaryDocument) fetch — claude.ts의 fetch_url은 "SEC Archives 원문 금지" 규칙이 있어
// (10-K 등 대형 문서로 인한 지연/토큰 낭비 방지 목적) 여기서는 별도로, 서버가 트리거 이벤트
// 후보로 이미 좁혀진 8-K 1~2개만 직접 fetch — 10-K보다 훨씬 짧아 토큰 부담이 적음.
async function fetchEdgarDocumentText(cik: string, accessionNumber: string, primaryDocument: string): Promise<string | null> {
  const cikNoLeadingZeros = String(Number(cik));
  const accNoDashes = accessionNumber.replace(/-/g, '');
  const url = `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accNoDashes}/${primaryDocument}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, { headers: EDGAR_HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 6000) : null; // 토큰 예산 보호 — 8-K 본문은 보통 이보다 훨씬 짧음
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface SubmissionsData {
  name: string;
  filings: {
    recent: {
      form: string[];
      filingDate: string[];
      reportDate: string[];
      accessionNumber: string[];
      primaryDocument: string[];
      items: string[];
    };
  };
}

// 8-K 중 "트리거 이벤트"로 볼 아이템 코드 — 1.01 중요계약, 2.01 인수·매각 완료, 3.02 지분매각(자금조달)
const TRIGGER_EVENT_8K_ITEMS = new Set(['1.01', '2.01', '3.02']);
const TRIGGER_EVENT_LOOKBACK_DAYS = 365;

export interface TriggerEventCandidate {
  date: string;
  itemCodes: string;
  text: string;
}

interface XbrlUnit { form: string; fp?: string; fy?: number; val: number; end: string }
export interface XbrlAnnualPoint { year: string; val: number }

export interface EdgarRawSeries {
  ticker: string | null;
  cik: string;
  revenue: (number | null)[];
  grossProfit: (number | null)[];
  netIncome: (number | null)[];
  operatingIncome: (number | null)[];
  assets: (number | null)[];
  liabilities: (number | null)[];
  equity: (number | null)[];
  cash: (number | null)[];
  eps: (number | null)[];
  operatingCF: (number | null)[];
  investingCF: (number | null)[];
  financingCF: (number | null)[];
  fiscalYears: string[];
  filedAt: string;
  source: 'EDGAR';
}

export interface EdgarData {
  cik: string;
  companyName: string;
  ticker: string | null;
  filings: Array<{ form: string; filingDate: string }>;
  financials: {
    year?: string;
    revenue?: string;
    grossProfit?: string;
    operatingIncome?: string;
    netIncome?: string;
    ebitda?: string;
    totalAssets?: string;
    totalLiabilities?: string;
    totalEquity?: string;
    cash?: string;
    operatingCF?: string;
    investingCF?: string;
    financingCF?: string;
  };
  // 최근 10-K/20-F 최대 5개년 시계열 (fiscalYears[0]이 최신) — buildFinancialsV2FromRaw 등에서 사용
  rawSeries?: EdgarRawSeries;
  // 최근 12개월 이내 8-K 중 트리거 이벤트 후보(투자유치/M&A/대규모계약) 원문 — summary_v2 프롬프트에서 구조화
  triggerEvents?: TriggerEventCandidate[];
}

// ── cik_master 우선 조회 → EFTS 폴백 ─────────────────────────────────────────

async function lookupCik(
  name: string,
): Promise<{ cik: string; name: string; ticker: string | null } | null> {
  const norm = name.toUpperCase();

  // 1. 마스터 테이블 — ticker 일치
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('ticker', norm)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (ticker) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 2. 마스터 테이블 — exact name
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', name)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (exact) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 3. 마스터 테이블 — starts-with
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (startsWith) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 4. 마스터 테이블 — contains
  {
    const { data } = await supabase
      .from('cik_master')
      .select('cik, name, ticker')
      .ilike('name', `%${name}%`)
      .limit(1)
      .maybeSingle();
    if (data) {
      console.log(`[edgar] CIK lookup HIT (contains) "${name}" → ${data.cik} ${data.name}`);
      return { cik: data.cik, name: data.name, ticker: data.ticker ?? null };
    }
  }

  // 5. EFTS 검색 폴백
  console.log(`[edgar] CIK not in cik_master, trying EFTS search for "${name}"`);
  const q = encodeURIComponent(`"${name}"`);
  const searchRes = await fetchJson<{ hits: { hits: Array<{ _source: { entity_name?: string; entity_id?: string } }> } }>(
    `https://efts.sec.gov/LATEST/search-index?q=${q}&dateRange=custom&startdt=2015-01-01&forms=10-K,20-F`,
  );
  const hit = searchRes?.hits?.hits?.[0];
  if (!hit?._source.entity_id) {
    console.log(`[edgar] CIK MISS for "${name}" — EFTS no result`);
    return null;
  }

  const cik  = hit._source.entity_id.padStart(10, '0');
  const hname = hit._source.entity_name ?? name;
  console.log(`[edgar] CIK lookup HIT (EFTS) "${name}" → ${cik} ${hname}`);

  await supabase.from('cik_master').upsert(
    { cik, name: hname, ticker: null },
    { onConflict: 'cik' },
  );

  return { cik, name: hname, ticker: null };
}

// ── XBRL helpers ─────────────────────────────────────────────────────────────

function fmtUsd(val: number): string {
  const sign = val < 0 ? '-' : '';
  const abs  = Math.abs(val);
  const b    = abs / 1_000_000_000;
  return b >= 1
    ? `${sign}${b.toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

// 10-K/20-F 연간 데이터만 추출. 같은 회계연도 중복 시 최신 end 날짜 기준 유지. 최대 5개년(최신순).
export function extractAnnualSeries(units: XbrlUnit[] | undefined): XbrlAnnualPoint[] {
  if (!units) return [];

  const byYear = new Map<string, { val: number; end: string }>();
  for (const u of units) {
    if (!['10-K', '20-F'].includes(u.form)) continue;
    if (u.fp && u.fp !== 'FY') continue;
    if (u.val == null) continue;
    const fy = u.fy ? String(u.fy) : u.end?.slice(0, 4);
    if (!fy) continue;
    const cur = byYear.get(fy);
    if (!cur || u.end > cur.end) byYear.set(fy, { val: u.val, end: u.end });
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 5)
    .map(([year, { val }]) => ({ year, val }));
}

// 후보 concept 이름들(예: 'Revenues' → 'RevenueFromContractWithCustomerExcludingAssessedTax')은
// 우선순위가 아니라 회계기준 전환에 따른 동의어 목록 — 예전엔 "처음 매칭되는 concept" 선택이라,
// ASC 606 전환기(2018년경) 기업 상당수가 옛 concept('Revenues')에 단 1개년(전환 직전)만
// 태깅된 걸 그대로 채택하고, 실제로 다년치가 있는 새 concept은 아예 확인하지 않는 버그가 있었음
// (Apple 실측: Revenues=[2018]만 11건, RevenueFromContractWithCustomerExcludingAssessedTax=
// 2019~2025 37건 — 코드가 전자를 고르고 있었음). 최신 연도 → 데이터 개수 순으로 가장 나은
// concept을 선택하도록 변경.
export function pickConceptSeries(
  usGaap: Record<string, any>,
  ...names: string[]
): XbrlAnnualPoint[] {
  let best: XbrlAnnualPoint[] = [];
  for (const name of names) {
    const concept = usGaap[name];
    if (!concept) continue;
    const units: XbrlUnit[] | undefined =
      concept.units?.USD ??
      concept.units?.['USD/shares'] ??
      concept.units?.shares;
    const result = extractAnnualSeries(units);
    if (result.length === 0) continue;
    if (best.length === 0 || result[0].year > best[0].year ||
        (result[0].year === best[0].year && result.length > best.length)) {
      best = result;
    }
  }
  return best;
}

// ── Public API ────────────────────────────────────────────────────────────────

// cik_master DB 전용 조회 (EFTS API 없음 — 빠름, financial_cache 선체크용)
export async function lookupCikByName(
  name: string,
): Promise<{ cik: string; ticker: string | null } | null> {
  const norm = name.toUpperCase();
  const sel = 'cik, ticker';

  { const { data } = await supabase.from('cik_master').select(sel).ilike('ticker', norm).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', name).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', `${name}%`).limit(1).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  { const { data } = await supabase.from('cik_master').select(sel).ilike('name', `%${name}%`).limit(1).maybeSingle();
    if (data) return { cik: data.cik, ticker: data.ticker ?? null }; }

  return null;
}

export async function fetchEdgarData(companyName: string): Promise<EdgarData | null> {
  console.log(`[edgar] fetchEdgarData start: "${companyName}"`);
  const found = await lookupCik(companyName);
  if (!found) {
    console.log(`[edgar] fetchEdgarData MISS (no CIK): "${companyName}"`);
    return null;
  }
  return fetchEdgarDataById(found.cik, found.name, found.ticker);
}

// company_listings로 CIK를 이미 아는 경우(다중상장 회사 등) — 이름 기반 lookupCik를
// 건너뛰고 바로 SEC 조회. entityName은 로그/표시용일 뿐 조회 자체엔 안 쓰임.
export async function fetchEdgarDataByCik(cik: string, ticker: string | null, entityName?: string): Promise<EdgarData | null> {
  console.log(`[edgar] fetchEdgarDataByCik start: CIK ${cik}`);
  return fetchEdgarDataById(cik, entityName ?? ticker ?? cik, ticker);
}

async function fetchEdgarDataById(cik: string, entityName: string, ticker: string | null): Promise<EdgarData | null> {
  console.log(`[edgar] fetching submissions + companyfacts for CIK ${cik} (${entityName})`);

  // 최근 공시 + XBRL 전체 팩트(다년도 포함) 병렬 조회
  const [subRes, factsRes] = await Promise.all([
    fetchJson<SubmissionsData>(`https://data.sec.gov/submissions/CIK${cik}.json`),
    fetchJson<{ facts?: { 'us-gaap'?: Record<string, any> } }>(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
    ),
  ]);

  if (!subRes) {
    console.log(`[edgar] submissions fetch FAILED for CIK ${cik}`);
    return null;
  }

  const filings: EdgarData['filings'] = [];
  const targets = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K']);
  const recent  = subRes.filings.recent;

  for (let i = 0; i < Math.min(recent.form?.length ?? 0, 100); i++) {
    if (targets.has(recent.form[i])) {
      filings.push({ form: recent.form[i], filingDate: recent.filingDate[i] });
      if (filings.length >= 6) break;
    }
  }

  // 트리거 이벤트 후보 — 최근 12개월 8-K 중 투자유치/M&A/중요계약 아이템 코드만, 최대 2개 본문 fetch
  let triggerEvents: TriggerEventCandidate[] | undefined;
  {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - TRIGGER_EVENT_LOOKBACK_DAYS);
    const candidates: Array<{ date: string; itemCodes: string; accessionNumber: string; primaryDocument: string }> = [];
    for (let i = 0; i < Math.min(recent.form?.length ?? 0, 200); i++) {
      if (recent.form[i] !== '8-K') continue;
      const items = recent.items?.[i];
      if (!items) continue;
      const codes = items.split(',').map(c => c.trim());
      if (!codes.some(c => TRIGGER_EVENT_8K_ITEMS.has(c))) continue;
      const date = recent.reportDate?.[i] || recent.filingDate[i];
      if (new Date(date) < cutoff) continue;
      candidates.push({ date, itemCodes: items, accessionNumber: recent.accessionNumber[i], primaryDocument: recent.primaryDocument[i] });
      if (candidates.length >= 3) break; // 최신순 정렬이므로 3개면 충분한 후보 풀
    }
    if (candidates.length > 0) {
      const fetched = await Promise.all(
        candidates.slice(0, 2).map(async c => { // 본문 fetch는 지연/토큰 예산상 최대 2개만
          const text = await fetchEdgarDocumentText(cik, c.accessionNumber, c.primaryDocument);
          return text ? { date: c.date, itemCodes: c.itemCodes, text } : null;
        }),
      );
      const events = fetched.filter((e): e is TriggerEventCandidate => e !== null);
      if (events.length > 0) triggerEvents = events;
    }
  }

  const gaap = factsRes?.facts?.['us-gaap'];
  const financials: EdgarData['financials'] = {};
  let rawSeries: EdgarRawSeries | undefined;

  if (gaap) {
    const revData  = pickConceptSeries(gaap, 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet');
    const gpData   = pickConceptSeries(gaap, 'GrossProfit');
    const oiData   = pickConceptSeries(gaap, 'OperatingIncomeLoss');
    const niData   = pickConceptSeries(gaap, 'NetIncomeLoss', 'ProfitLoss');
    const aData    = pickConceptSeries(gaap, 'Assets');
    const lData    = pickConceptSeries(gaap, 'Liabilities');
    const eqData   = pickConceptSeries(gaap, 'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest');
    const cashData = pickConceptSeries(gaap, 'CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsAndShortTermInvestments');
    const opCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInOperatingActivities');
    const invCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInInvestingActivities');
    const finCFData = pickConceptSeries(gaap, 'NetCashProvidedByUsedInFinancingActivities');
    const daData   = pickConceptSeries(gaap, 'DepreciationDepletionAndAmortization', 'DepreciationAndAmortization');
    const epsData  = pickConceptSeries(gaap, 'EarningsPerShareBasic');

    // 최신 연도 단일값 — 기존 narrative(financials) 호환용.
    // 손익계산서 항목(gp/oi/ni/da)은 revenue와 같은 회계연도인지 검증 후에만 사용 — concept마다
    // 태깅이 끊긴 시점이 다를 수 있어(예: Berkshire Hathaway는 'OperatingIncomeLoss'를 2012년
    // 이후로 아예 태깅 안 함), 검증 없이 "최신"을 취하면 13년 전 수치가 "올해" 라벨을 달고
    // 나가는 사고가 남(2026-07-04 발견 — 5.4% 영업이익률이 실제론 2012년 수치였음).
    const latest = (d: XbrlAnnualPoint[]) => d[0] ?? null;
    const rev = latest(revData);
    const anchorYear = rev?.year;
    const matchYear = (d: XbrlAnnualPoint[]) => (d[0] && d[0].year === anchorYear) ? d[0] : null;
    const gp = matchYear(gpData), oi = matchYear(oiData), ni = matchYear(niData), da = matchYear(daData);
    const as_ = latest(aData), li = latest(lData), eq = latest(eqData), ca = latest(cashData);
    const ocf = latest(opCFData), icf = latest(invCFData), fcf = latest(finCFData);

    if (rev) { financials.revenue = fmtUsd(rev.val); financials.year = rev.year; }
    if (gp)  financials.grossProfit = fmtUsd(gp.val);
    if (oi)  financials.operatingIncome = fmtUsd(oi.val);
    if (ni)  financials.netIncome = fmtUsd(ni.val);
    if (oi && da) financials.ebitda = fmtUsd(oi.val + da.val);
    if (as_) financials.totalAssets = fmtUsd(as_.val);
    if (li)  financials.totalLiabilities = fmtUsd(li.val);
    if (eq)  financials.totalEquity = fmtUsd(eq.val);
    if (ca)  financials.cash = fmtUsd(ca.val);
    if (ocf) financials.operatingCF = fmtUsd(ocf.val);
    if (icf) financials.investingCF = fmtUsd(icf.val);
    if (fcf) financials.financingCF = fmtUsd(fcf.val);

    // 다년도 시계열 (최대 5개년, 매출 기준 회계연도 정렬 — 없으면 순이익 기준)
    const fiscalYears = revData.length > 0 ? revData.map(d => d.year) : niData.map(d => d.year);
    if (fiscalYears.length > 0) {
      const align = (series: XbrlAnnualPoint[]) => {
        const m = new Map(series.map(d => [d.year, d.val]));
        return fiscalYears.map(y => m.get(y) ?? null);
      };
      rawSeries = {
        ticker,
        cik: `CIK${cik}`,
        revenue: align(revData),
        grossProfit: align(gpData),
        netIncome: align(niData),
        operatingIncome: align(oiData),
        assets: align(aData),
        liabilities: align(lData),
        equity: align(eqData),
        cash: align(cashData),
        eps: align(epsData),
        operatingCF: align(opCFData),
        investingCF: align(invCFData),
        financingCF: align(finCFData),
        fiscalYears,
        filedAt: new Date().toISOString(),
        source: 'EDGAR',
      };
    }
  }

  console.log(`[edgar] XBRL result for "${entityName}" (CIK ${cik}): rev=${financials.revenue ?? 'null'} opInc=${financials.operatingIncome ?? 'null'} netInc=${financials.netIncome ?? 'null'} year=${financials.year ?? 'null'} years=${rawSeries?.fiscalYears.length ?? 0}`);

  return { cik, companyName: entityName, ticker, filings, financials, rawSeries, triggerEvents };
}

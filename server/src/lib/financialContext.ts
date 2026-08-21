// Orchestrates DART+KIS / EDGAR+FMP data fetch and formats as Claude prompt context

import { fetchDartData, fetchDartDataByCorpCode, DartData }                from './dart';
import { fetchEdgarData, fetchEdgarDataByCik, EdgarData, EdgarRawSeries, lookupCikByName } from './edgar';
import { fetchKisQuote, KisQuote }               from './kis';
import { fetchFmpData, FmpData, buildFmpContext } from './fmp';
import { supabase }                              from './supabase';

export type DataSource = 'dart' | 'edgar' | 'web_search';

// 라이브 DART/EDGAR 조회 성공 시 financial_cache에 반영(2026-08-21) — 지금까지 이 캐시는
// 배치 스크립트만 썼고 라이브 경로는 읽기 전용이라, 캐시가 만료돼 라이브로 최신 데이터를
// 가져와도 다음 조회 때 버려지고 있었다(데이원컴퍼니 FY2025 조사 계기). company_name
// UNIQUE 제약 기반 upsert라 배치와 동시에 같은 행을 써도 Postgres가 원자적으로 처리 —
// 마지막 커밋이 이길 뿐 데이터 손상 없음. 실패해도 이번 요청 응답 자체는 막지 않는다.
async function upsertFinancialCache(
  companyKey: string,
  source: 'DART' | 'EDGAR',
  contextText: string,
  raw: { raw_dart?: unknown; raw_edgar?: unknown },
): Promise<void> {
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from('financial_cache')
    .upsert(
      { company_name: companyKey, source, context_text: contextText, expires_at: expiresAt, ...raw },
      { onConflict: 'company_name' },
    );
  if (error) console.warn(`[financialCtx] financial_cache upsert 실패 (${companyKey}): ${error.message}`);
}

// company_listings 행 — 다중상장 회사(company_id에 EDGAR+DART 둘 다 있는 경우) 재무
// 우선순위 판단용. 하나만 있거나 아예 안 넘어오면 기존 이름 휴리스틱 경로를 그대로 탄다.
export interface CompanyListingRef {
  source: 'EDGAR' | 'DART';
  identifier: string;      // EDGAR: cik, DART: corp_code
  ticker: string | null;
}

export interface FinancialContext {
  source:      DataSource;
  contextText: string;
  rawEdgar?:   any;
  rawDart?:    any;
  // financial_cache(배치 프리컴퓨트) 히트 여부 — false면 EDGAR/DART 라이브 조회로,
  // 첫 조회 기업일 가능성이 높아 프론트에서 "조금 더 걸려요" 안내에 사용
  isCacheHit:  boolean;
  // 회사명이 정확일치가 아니라 유사매칭으로 결정됐는지(dart.ts/edgar.ts의 matchTier 그대로
  // 전달) — 'exact'/'ticker_exact'/'name_exact'가 아니면 낮은 신뢰도 신호. 이번 스코프는
  // 이 필드에 신호를 싣는 것까지만 — UI 표시는 별도 작업(2026-08-21).
  matchTier?: 'exact' | 'ticker_exact' | 'name_exact' | 'starts_with' | 'contains' | 'api_search';
}

// 한글 음절이 포함되면 한국 기업으로 판단
function isKoreanCompany(name: string): boolean {
  return /[가-힯]/.test(name);
}

function formatKrw(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return raw;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(1)}조원`;
  if (abs >= 100_000_000)       return `${(n / 100_000_000).toFixed(0)}억원`;
  if (abs >= 10_000)            return `${(n / 10_000).toFixed(0)}만원`;
  return `${n}원`;
}

// financialsTableBuilder.ts의 MAX_IS_YEARS(5개년)와 동일한 목표 연도 범위. edgar.ts/dart.ts가
// 최대 5개년을 요청해도 그 회사 자체에 해당 연도 재무제표가 없으면(설립/상장 이전, 그 해 미공시 등)
// 원천 응답에서 해당 연도가 통째로 빠짐 — 이 빈 연도를 Claude에게 명시하지 않으면 "조회 실패"로
// 오인해 "확인 필요"로 반환함(2026-07-09 Apple/라이콤 FY2021 공백 사고).
// 리터럴 하드코딩 대신 "오늘 기준 최근 5개년"으로 매번 계산 — 예전엔 해가 바뀌어도 이 배열을
// 수동으로 갱신해줘야 했고, 갱신을 놓치면 최신 회계연도가 이 창 어디에도 안 걸려 조용히
// "빠진 연도"로 오분류될 위험이 있었다(2026-08-15 발견).
const TARGET_FISCAL_YEARS = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 4 + i));

// 실제로 인접한 두 연도 모두 값이 확인되는 경우만 "YoY 1회"로 센다 — 중간에 빈 연도가
// 끼어 있으면(예: FY2023/FY2025는 있는데 FY2024가 없음) 진짜 연속 YoY가 아니므로 제외.
// "N년 평균 성장률" 같은 과장된 표현을 막기 위해 이 숫자를 Claude에게 명시적으로 준다
// (2026-08-13 워트인텔리전스 "2년 평균 43%" 사고 — 실제로는 YoY 1회(44.7%)뿐이었음).
function countAdjacentYoY(fiscalYears: string[], values: (number | null)[]): number {
  let count = 0;
  for (let i = 0; i < fiscalYears.length - 1; i++) {
    const y1 = Number(fiscalYears[i]);
    const y2 = Number(fiscalYears[i + 1]);
    if (Math.abs(y1 - y2) === 1 && values[i] != null && values[i + 1] != null) count++;
  }
  return count;
}

function growthDataAvailabilityNote(yoyCount: number, lang: 'ko' | 'en'): string {
  if (lang === 'ko') {
    return yoyCount <= 1
      ? `· 확인 가능한 전년 대비 성장률: ${yoyCount}개. 이걸 "N개년 평균"이나 "N년 평균 성장률"이라고 ` +
        `부르지 말 것 — "전년 대비 X% 증가" 형태로만 서술.`
      : `· 확인 가능한 전년 대비 성장률: ${yoyCount}개. 이 ${yoyCount}개를 실제로 평균낼 때만 "평균"이라고 ` +
        `부를 것 — 실제 데이터보다 더 많은 연도를 평균낸 것처럼 표현하지 말 것.`;
  }
  return yoyCount <= 1
    ? `· Confirmed YoY growth figures available: ${yoyCount}. Never call this an "N-year average" or CAGR — ` +
      `describe it as "grew X% YoY" only.`
    : `· Confirmed YoY growth figures available: ${yoyCount}. Only call something an "N-year average" if you're ` +
      `genuinely averaging across these ${yoyCount} figures — don't imply more years of data than this.`;
}

function missingYearsNote(presentYears: string[]): string | null {
  const missing = TARGET_FISCAL_YEARS.filter(y => !presentYears.includes(y));
  if (missing.length === 0) return null;
  return '\n[Years missing from source data]\n' + missing.map(y =>
    `· ${y}: no data — the source filing has no financial statement at all for this year (before ` +
    `founding/listing, or simply not filed that year). This isn't a lookup failure, so label revenue/` +
    `operating income/net income etc. for this year "Not applicable" instead of "Not disclosed."`
  ).join('\n');
}

// ── DART + KIS 컨텍스트 ───────────────────────────────────────────────────────

function buildDartContext(d: DartData, kis: KisQuote | null): string {
  const lines: string[] = [
    '=== DART 공시 데이터 (금융감독원 전자공시시스템) ===',
    `기업: ${d.corpName}  (corp_code: ${d.corpCode})`,
  ];

  if (d.financials.year) {
    lines.push(`\n[${d.financials.year}년 사업보고서 재무 수치 — 별도 기준]`);
    if (d.financials.revenue)          lines.push(`· 매출액:     ${formatKrw(d.financials.revenue)}`);
    if (d.financials.operatingProfit)  lines.push(`· 영업이익:   ${formatKrw(d.financials.operatingProfit)}`);
    if (d.financials.netIncome)        lines.push(`· 당기순이익: ${formatKrw(d.financials.netIncome)}`);
    lines.push('→ 재무 섹션에 이 수치를 우선 사용하고 "(DART 공시)" 출처를 명시하세요.');
  }

  const trend = d.rawSeries?.cfs ?? d.rawSeries?.ofs;
  if (trend) {
    if (trend.fiscalYears.length > 1) {
      lines.push('\n[다년도 매출 추이]');
      trend.fiscalYears.forEach((fy, i) => {
        const v = trend.revenue[i];
        lines.push(`· ${fy}: ${v != null ? formatKrw(String(v)) : '—'}`);
      });
    }
    const missingNote = missingYearsNote(trend.fiscalYears);
    if (missingNote) lines.push(missingNote);

    lines.push('\n[성장률 데이터 확인 범위]');
    lines.push(growthDataAvailabilityNote(countAdjacentYoY(trend.fiscalYears, trend.revenue), 'ko'));
  }

  // KIS 시세 데이터
  if (kis) {
    lines.push('\n[KIS 한국투자증권 시세 데이터]');
    if (kis.price     !== '-') lines.push(`· 현재가:     ${kis.price}`);
    if (kis.marketCap !== '-') lines.push(`· 시가총액:   ${kis.marketCap}`);
    if (kis.per       !== '-') lines.push(`· PER:        ${kis.per}`);
    if (kis.pbr       !== '-') lines.push(`· PBR:        ${kis.pbr}`);
    if (kis.eps       !== '-') lines.push(`· EPS:        ${kis.eps}`);
    if (kis.bps       !== '-') lines.push(`· BPS:        ${kis.bps}`);
    if (kis.high52    !== '-') lines.push(`· 52주 최고:  ${kis.high52}`);
    if (kis.low52     !== '-') lines.push(`· 52주 최저:  ${kis.low52}`);
    lines.push('→ 요약 섹션 시가총액/PER/PBR에 이 수치를 사용하고 "(KIS)" 출처를 명시하세요.');
  }

  if (d.disclosures.length) {
    lines.push('\n[최근 공시 목록]');
    [...d.disclosures]
      .sort((a, b) => b.rcept_dt.localeCompare(a.rcept_dt))
      .slice(0, 5)
      .forEach((dc) => {
        const date = dc.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
        lines.push(`· ${date}  ${dc.report_nm}  (제출: ${dc.flr_nm})`);
      });
  }

  if (d.triggerEvents?.length) {
    lines.push('\n[최근 트리거 이벤트 후보 — 주요사항보고서(B001), 최근 12개월]');
    lines.push('보고서명 자체가 사건 유형을 담고 있음(예: "유상증자결정"→투자유치/자금조달, ' +
      '"타법인주식및출자증권취득결정"→M&A/지분취득). summary_v2의 trigger_events 스키마 참고해 구조화.');
    d.triggerEvents.forEach((t) => {
      const date = t.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      lines.push(`· ${date}  ${t.reportName}`);
    });
  }

  return lines.join('\n');
}

// ── EDGAR + FMP 컨텍스트 ──────────────────────────────────────────────────────

function fmpUsd(n: number | undefined | null): string | undefined {
  if (n == null || isNaN(n)) return undefined;
  const sign = n < 0 ? '-' : '';
  const abs  = Math.abs(n);
  const b    = abs / 1_000_000_000;
  return b >= 1
    ? `${sign}${b.toFixed(1)}B USD`
    : `${sign}${(abs / 1_000_000).toFixed(0)}M USD`;
}

// EDGAR·FMP 둘 다 값이 없을 때, "조회 실패"인지 "이 기업 구조상 원래 존재하지 않는 항목"인지
// 구분해서 Claude에게 명시 — 안 그러면 Claude가 항상 "확인 필요"로만 반환해 파싱 실패처럼 보임.
// 대표 사례: Berkshire Hathaway(지주회사) — 보험/철도/투자 등 세그먼트 구조라 SEC XBRL에
// 연결 OperatingIncomeLoss를 아예 태깅하지 않음(전 연도 null) — 이건 데이터 누락이 아니라
// 그 기업 재무제표 자체의 구조.
function structurallyAbsentNote(label: string, rawSeries: EdgarRawSeries | undefined, key: keyof EdgarRawSeries): string | null {
  const arr = rawSeries?.[key];
  if (!Array.isArray(arr) || arr.length === 0 || !arr.every(v => v == null)) return null;
  return `· ${label.padEnd(14)} Not applicable — this company never tags this line item in its SEC ` +
    `filings across any year (likely a holding company, insurer, or other complex segment structure ` +
    `that structurally doesn't report it). This isn't a lookup failure, so label it "Not applicable" ` +
    `instead of "Not disclosed" in summary KPIs etc.`;
}

function buildEdgarContext(e: EdgarData, fmp: FmpData | null): string {
  const ef = e.financials;
  const fi = fmp?.income?.[0];
  const fb = fmp?.balance?.[0];
  const fc = fmp?.cashflow?.[0];

  // 항목별 EDGAR 우선, FMP 폴백
  const row = (label: string, edgarVal: string | undefined, fmpVal: number | undefined | null) => {
    const v = edgarVal ?? fmpUsd(fmpVal);
    if (!v) return null;
    const src = edgarVal ? '(EDGAR)' : '(FMP)';
    return `· ${label.padEnd(14)} ${v}  ${src}`;
  };

  const lines: string[] = [
    '=== SEC EDGAR / FMP financial data ===',
    `Company: ${e.companyName}  (CIK: ${e.cik}${e.ticker ? `  ticker: ${e.ticker}` : ''})`,
  ];

  const year = ef.year ?? fi?.date?.slice(0, 4);
  if (year) {
    lines.push(`\n[${year} annual income statement]`);
    const r: (string | null)[] = [
      row('Revenue',        ef.revenue,          fi?.revenue),
      row('Gross Profit',   ef.grossProfit,       fi?.grossProfit),
      row('Operating Inc.', ef.operatingIncome,   fi?.operatingIncome)
        ?? structurallyAbsentNote('Operating Inc.', e.rawSeries, 'operatingIncome'),
      row('Net Income',     ef.netIncome,         fi?.netIncome),
    ];
    r.filter(Boolean).forEach(l => lines.push(l!));
    // 순이익 concept이 NetIncomeLoss/ProfitLoss 중 하나로 선택됐는데 같은 연도에 두 태그 값이
    // 10%+ 다르면(edgar.ts의 pickConceptSeriesWithConflict) 숨기지 않고 그대로 노출 — Claude가
    // sources[] 각주에 "어느 태그 기준인지" 반영하도록.
    if (ef.netIncomeConceptNote) lines.push(`  (Net Income source note: ${ef.netIncomeConceptNote})`);

    lines.push(`\n[Balance sheet]`);
    const b: (string | null)[] = [
      row('Cash',           ef.cash,              fb?.cashAndEquivalents),
      row('Total Assets',   ef.totalAssets,       fb?.totalAssets),
      row('Total Liab.',    ef.totalLiabilities,  fb?.totalLiabilities),
      row('Total Equity',   ef.totalEquity,       fb?.totalEquity),
    ];
    b.filter(Boolean).forEach(l => lines.push(l!));

    lines.push(`\n[Cash flow]`);
    const cf: (string | null)[] = [
      row('Operating CF',   ef.operatingCF,       fc?.operatingCashFlow),
      row('Investing CF',   ef.investingCF,       fc?.capitalExpenditure != null ? -Math.abs(fc.capitalExpenditure) : undefined),
      row('Financing CF',   ef.financingCF,       fc?.dividendsPaid      != null ? -Math.abs(fc.dividendsPaid)      : undefined),
    ];
    cf.filter(Boolean).forEach(l => lines.push(l!));

    lines.push('→ Use these figures in the financials section and cite each source ((EDGAR) or (FMP)).');
  }

  if (e.rawSeries) {
    if (e.rawSeries.fiscalYears.length > 1) {
      // 매출만 다년도로 주면 Claude가 나머지 계정과목의 과거 연도는 추세로 추측해 "(추정)"을
      // 붙이거나 "확인 필요"로 반환함 — 실제 EDGAR 다년치 원본은 이미 있는데 프롬프트엔
      // 최근 1개년치만 실려서 벌어지는 문제(2026-08 MSFT 재무탭 빈약 사고 원인 — 이 문제는
      // 배치 프리컴퓨트(edgarBatchPrecompute.ts) 쪽이 원본이었지만, 라이브 조회 경로도
      // 매출/영업이익/순이익만 다년도였고 매출총이익/총자산/총부채/자본총계/현금은 최근
      // 1개년치뿐이라 동일 클래스 문제라 함께 확장). 전 계정과목을 연도별로 명시.
      const absent = (arr: (number | null)[]) => arr.every(v => v == null);
      const oiAbsent = absent(e.rawSeries.operatingIncome);
      const niAbsent = absent(e.rawSeries.netIncome);
      const gpAbsent = absent(e.rawSeries.grossProfit);
      const cashAbsent = absent(e.rawSeries.cash);
      const naLabel = (fieldAbsent: boolean) => fieldAbsent ? 'Not applicable' : 'Not disclosed';
      const fmt = (v: number | null, fieldAbsent: boolean) => v != null ? fmpUsd(v) : naLabel(fieldAbsent);
      lines.push('\n[Multi-year income statement / balance sheet trend — all official EDGAR figures, do not label "(estimated)"]');
      e.rawSeries.fiscalYears.forEach((fy, i) => {
        lines.push(
          `· ${fy}: Revenue ${fmt(e.rawSeries!.revenue[i], false)}` +
          `, Gross Profit ${fmt(e.rawSeries!.grossProfit[i], gpAbsent)}` +
          `, Operating Inc. ${fmt(e.rawSeries!.operatingIncome[i], oiAbsent)}` +
          `, Net Income ${fmt(e.rawSeries!.netIncome[i], niAbsent)}` +
          `, Total Assets ${fmt(e.rawSeries!.assets[i], false)}` +
          `, Total Liab. ${fmt(e.rawSeries!.liabilities[i], false)}` +
          `, Equity ${fmt(e.rawSeries!.equity[i], false)}` +
          `, Cash ${fmt(e.rawSeries!.cash[i], cashAbsent)}`,
        );
      });
    }
    const missingNote = missingYearsNote(e.rawSeries.fiscalYears);
    if (missingNote) lines.push(missingNote);

    lines.push('\n[Growth rate data availability]');
    lines.push(growthDataAvailabilityNote(countAdjacentYoY(e.rawSeries.fiscalYears, e.rawSeries.revenue), 'en'));
  }

  // FMP key metrics (valuation)
  if (fmp?.keyMetrics) {
    const km = fmp.keyMetrics;
    lines.push('\n[Valuation — TTM]');
    if (km.marketCap)           lines.push(`· Market Cap     ${fmpUsd(km.marketCap)}  (FMP)`);
    if (km.peRatioTTM)          lines.push(`· P/E            ${km.peRatioTTM.toFixed(1)}x  (FMP)`);
    if (km.priceToBookRatioTTM) lines.push(`· P/B            ${km.priceToBookRatioTTM.toFixed(2)}x  (FMP)`);
    if (km.roeTTM)              lines.push(`· ROE            ${(km.roeTTM * 100).toFixed(1)}%  (FMP)`);
    if (km.roicTTM)             lines.push(`· ROIC           ${(km.roicTTM * 100).toFixed(1)}%  (FMP)`);
    if (km.debtToEquityTTM)     lines.push(`· D/E            ${km.debtToEquityTTM.toFixed(2)}  (FMP)`);
  }

  if (e.filings.length) {
    lines.push('\n[Recent filings]');
    e.filings.slice(0, 5).forEach((f) => {
      lines.push(`· ${f.filingDate}  ${f.form}`);
    });
  }

  if (e.triggerEvents?.length) {
    lines.push('\n[Recent trigger event candidates — 8-K excerpts, last 12 months]');
    lines.push('Item codes: 1.01 material agreement / 2.01 acquisition or disposal completed / ' +
      '3.02 unregistered equity sale (fundraising). Use the summary_v2 trigger_events schema to ' +
      'structure date/amount/counterparty/type from the source text.');
    e.triggerEvents.forEach((t) => {
      lines.push(`· [${t.date}, item ${t.itemCodes}] ${t.text}`);
    });
  }

  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

// force=true면 financial_cache 만료 여부와 무관하게 DART/EDGAR를 무조건 재조회한다 —
// "데이터 새로고침" 버튼(refreshFinancials) 전용, 기본값 false로 기존 동작(캐시 우선) 유지.
export async function fetchFinancialContext(
  companyName: string,
  listings?: CompanyListingRef[],
  force = false,
): Promise<FinancialContext> {
  console.log(`[financialCtx] start "${companyName}"`);

  // 다중상장 회사(company_listings에 EDGAR+DART 둘 다 존재) — 이름 기반 한글 휴리스틱
  // 대신 이미 아는 identifier로 직접 조회. 다중상장 재무 우선순위 원칙: EDGAR 우선,
  // 없으면 DART, 둘 다 없으면 웹추정(기존 web_search 폴백 재사용).
  const edgarListing = listings?.find(l => l.source === 'EDGAR');
  const dartListing  = listings?.find(l => l.source === 'DART');
  if (edgarListing && dartListing) {
    try {
      const edgar = await fetchEdgarDataByCik(edgarListing.identifier, edgarListing.ticker);
      if (edgar && edgar.rawSeries && !edgar.hasFetchError) {
        const fmpData = edgarListing.ticker
          ? await fetchFmpData(companyName, edgarListing.ticker).catch(() => null)
          : null;
        console.log(`[financialCtx] "${companyName}" → 다중상장 source=edgar (CIK ${edgarListing.identifier})`);
        return { source: 'edgar', contextText: buildEdgarContext(edgar, fmpData), rawEdgar: edgar.rawSeries, isCacheHit: false, matchTier: edgar.matchTier };
      }
      const dart = await fetchDartDataByCorpCode(dartListing.identifier, dartListing.ticker, companyName);
      if (dart && dart.rawSeries && !dart.hasFetchError) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        console.log(`[financialCtx] "${companyName}" → 다중상장, EDGAR 데이터 없음 → source=dart (corp_code ${dartListing.identifier})`);
        return { source: 'dart', contextText: buildDartContext(dart, kis), rawDart: dart.rawSeries, isCacheHit: false, matchTier: dart.matchTier };
      }
      console.log(`[financialCtx] "${companyName}" → 다중상장, EDGAR/DART 둘 다 실패 → source=web_search`);
      return { source: 'web_search', contextText: '', isCacheHit: false };
    } catch (e) {
      console.warn(`[financialCtx] 다중상장 identifier 조회 실패, 기존 휴리스틱으로 폴백: ${(e as Error).message}`);
      // 아래 기존 경로로 이어감 — identifier 조회가 실패해도 전체 실패시키지 않음
    }
  }

  const isKorean = isKoreanCompany(companyName);

  try {
    if (isKorean) {
      if (!force) {
        // financial_cache 선체크 (DART 배치 프리컴퓨트 데이터)
        const { data: corpRow } = await supabase
          .from('corp_master')
          .select('stock_code')
          .ilike('corp_name', companyName)
          .not('stock_code', 'is', null)
          .maybeSingle();
        if (corpRow?.stock_code) {
          const { data: cachedDart } = await supabase
            .from('financial_cache')
            .select('context_text, raw_dart')
            .eq('company_name', corpRow.stock_code)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          if (cachedDart?.context_text) {
            console.log(`[financialCtx] "${companyName}" → financial_cache HIT DART (${corpRow.stock_code})`);
            return { source: 'dart', contextText: cachedDart.context_text, rawDart: cachedDart.raw_dart ?? undefined, isCacheHit: true };
          }
        }
      }

      // DART + KIS 병렬
      const dart = await fetchDartData(companyName);
      if (dart && dart.rawSeries && !dart.hasFetchError) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        const contextText = buildDartContext(dart, kis);
        if (dart.stockCode && !dart.hasFetchError) await upsertFinancialCache(dart.stockCode, 'DART', contextText, { raw_dart: dart.rawSeries });
        return { source: 'dart', contextText, rawDart: dart.rawSeries, isCacheHit: false, matchTier: dart.matchTier };
      }
      // DART 실패 시 EDGAR 시도
      const edgar = await fetchEdgarData(companyName);
      if (edgar && edgar.rawSeries && !edgar.hasFetchError) {
        const fmpData = edgar.ticker
          ? await fetchFmpData(companyName, edgar.ticker).catch(() => null)
          : null;
        const contextText = buildEdgarContext(edgar, fmpData);
        if (edgar.ticker && !edgar.hasFetchError) await upsertFinancialCache(edgar.ticker, 'EDGAR', contextText, { raw_edgar: edgar.rawSeries });
        return { source: 'edgar', contextText, rawEdgar: edgar.rawSeries, isCacheHit: false, matchTier: edgar.matchTier };
      }
    } else {
      if (!force) {
        // financial_cache 선체크 (EDGAR 배치 프리컴퓨트 데이터)
        const cikInfo = await lookupCikByName(companyName).catch(() => null);
        // CIK 조회 티커 우선, 없으면 companyName 자체가 ticker인 경우 직접 시도
        const lookupTicker =
          cikInfo?.ticker?.toUpperCase() ??
          (/^[A-Z0-9]{1,6}$/.test(companyName.toUpperCase()) ? companyName.toUpperCase() : null);
        if (lookupTicker) {
          const { data: cached } = await supabase
            .from('financial_cache')
            .select('context_text, raw_edgar')
            .eq('company_name', lookupTicker)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();
          if (cached?.context_text) {
            console.log(`[financialCtx] "${companyName}" → financial_cache HIT EDGAR (${lookupTicker})`);
            return { source: 'edgar', contextText: cached.context_text, rawEdgar: cached.raw_edgar ?? undefined, isCacheHit: true };
          }
        }
      }

      // EDGAR + FMP 병렬
      const [edgar, fmpData] = await Promise.allSettled([
        fetchEdgarData(companyName),
        fetchFmpData(companyName, null),
      ]);

      const e = edgar.status  === 'fulfilled' ? edgar.value  : null;
      const f = fmpData.status === 'fulfilled' ? fmpData.value : null;

      if (e && e.rawSeries && !e.hasFetchError) {
        // FMP는 EDGAR ticker를 우선 사용해 재시도
        const fmpFinal = f ?? (e.ticker
          ? await fetchFmpData(companyName, e.ticker).catch(() => null)
          : null);
        console.log(`[financialCtx] "${companyName}" → source=edgar (EDGAR+FMP) rev=${e.financials.revenue ?? 'null'}`);
        const contextText = buildEdgarContext(e, fmpFinal);
        if (e.ticker && !e.hasFetchError) await upsertFinancialCache(e.ticker, 'EDGAR', contextText, { raw_edgar: e.rawSeries });
        return { source: 'edgar', contextText, rawEdgar: e.rawSeries, isCacheHit: false, matchTier: e.matchTier };
      }
      if (f) {
        // EDGAR 없이 FMP만 있는 경우 (raw 데이터 없어 캐시 반영 스킵)
        console.log(`[financialCtx] "${companyName}" → source=edgar (FMP only)`);
        return { source: 'edgar', contextText: buildFmpContext(f), isCacheHit: false };
      }

      // EDGAR/FMP 모두 실패 시 DART 시도
      const dart = await fetchDartData(companyName);
      if (dart && dart.rawSeries && !dart.hasFetchError) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        const contextText = buildDartContext(dart, kis);
        if (dart.stockCode && !dart.hasFetchError) await upsertFinancialCache(dart.stockCode, 'DART', contextText, { raw_dart: dart.rawSeries });
        return { source: 'dart', contextText, rawDart: dart.rawSeries, isCacheHit: false, matchTier: dart.matchTier };
      }
    }
  } catch {
    // unexpected error → graceful fallback
  }

  console.log(`[financialCtx] "${companyName}" → source=web_search (all failed)`);
  return { source: 'web_search', contextText: '', isCacheHit: false };
}

// Orchestrates DART+KIS / EDGAR+FMP data fetch and formats as Claude prompt context

import { fetchDartData, DartData }                from './dart';
import { fetchEdgarData, EdgarData, EdgarRawSeries, lookupCikByName } from './edgar';
import { fetchKisQuote, KisQuote }               from './kis';
import { fetchFmpData, FmpData, buildFmpContext } from './fmp';
import { supabase }                              from './supabase';

export type DataSource = 'dart' | 'edgar' | 'web_search';

export interface FinancialContext {
  source:      DataSource;
  contextText: string;
  rawEdgar?:   any;
  rawDart?:    any;
  // financial_cache(배치 프리컴퓨트) 히트 여부 — false면 EDGAR/DART 라이브 조회로,
  // 첫 조회 기업일 가능성이 높아 프론트에서 "조금 더 걸려요" 안내에 사용
  isCacheHit:  boolean;
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

// analyze.ts/AnalysisCard.tsx의 IS_COLS(2021~2025)와 동일한 목표 연도 범위. edgar.ts/dart.ts가
// 최대 5개년을 요청해도 그 회사 자체에 해당 연도 재무제표가 없으면(설립/상장 이전, 그 해 미공시 등)
// 원천 응답에서 해당 연도가 통째로 빠짐 — 이 빈 연도를 Claude에게 명시하지 않으면 "조회 실패"로
// 오인해 "확인 필요"로 반환함(2026-07-09 Apple/라이콤 FY2021 공백 사고).
const TARGET_FISCAL_YEARS = ['2021', '2022', '2023', '2024', '2025'];

function missingYearsNote(presentYears: string[]): string | null {
  const missing = TARGET_FISCAL_YEARS.filter(y => !presentYears.includes(y));
  if (missing.length === 0) return null;
  return '\n[원천 데이터에 없는 연도]\n' + missing.map(y =>
    `· ${y}: 데이터 없음 — 원천 공시에 해당 연도 재무제표 자체가 존재하지 않음(설립/상장 이전이거나 ` +
    `그 해 공시가 없음). 조회 실패가 아니므로 이 연도의 매출/영업이익/순이익 등은 "확인 필요" 대신 ` +
    `"해당없음"으로 표기하세요.`
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
  return `· ${label.padEnd(14)} 해당없음 — 이 기업은 SEC 재무제표에 이 항목을 전 연도에 걸쳐 ` +
    `별도 태깅하지 않음(지주회사/보험/복합 사업구조 등으로 구조적 미보고 가능성 높음). ` +
    `데이터 조회 실패가 아니므로 요약 KPI 등에서 "확인 필요" 대신 "해당없음"으로 표기하세요.`;
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
    '=== SEC EDGAR / FMP 재무 데이터 ===',
    `기업: ${e.companyName}  (CIK: ${e.cik}${e.ticker ? `  ticker: ${e.ticker}` : ''})`,
  ];

  const year = ef.year ?? fi?.date?.slice(0, 4);
  if (year) {
    lines.push(`\n[${year} 연간 손익계산서]`);
    const r: (string | null)[] = [
      row('Revenue',        ef.revenue,          fi?.revenue),
      row('Gross Profit',   ef.grossProfit,       fi?.grossProfit),
      row('Operating Inc.', ef.operatingIncome,   fi?.operatingIncome)
        ?? structurallyAbsentNote('Operating Inc.', e.rawSeries, 'operatingIncome'),
      row('Net Income',     ef.netIncome,         fi?.netIncome),
      row('EBITDA',         ef.ebitda,            fi?.ebitda),
    ];
    r.filter(Boolean).forEach(l => lines.push(l!));

    lines.push(`\n[재무상태표]`);
    const b: (string | null)[] = [
      row('Cash',           ef.cash,              fb?.cashAndEquivalents),
      row('Total Assets',   ef.totalAssets,       fb?.totalAssets),
      row('Total Liab.',    ef.totalLiabilities,  fb?.totalLiabilities),
      row('Total Equity',   ef.totalEquity,       fb?.totalEquity),
    ];
    b.filter(Boolean).forEach(l => lines.push(l!));

    lines.push(`\n[현금흐름]`);
    const cf: (string | null)[] = [
      row('Operating CF',   ef.operatingCF,       fc?.operatingCashFlow),
      row('Investing CF',   ef.investingCF,       fc?.capitalExpenditure != null ? -Math.abs(fc.capitalExpenditure) : undefined),
      row('Financing CF',   ef.financingCF,       fc?.dividendsPaid      != null ? -Math.abs(fc.dividendsPaid)      : undefined),
    ];
    cf.filter(Boolean).forEach(l => lines.push(l!));

    lines.push('→ 재무 섹션에 이 수치들을 사용하고 각 출처((EDGAR) 또는 (FMP))를 명시하세요.');
  }

  if (e.rawSeries) {
    if (e.rawSeries.fiscalYears.length > 1) {
      // 매출만 다년도로 주면 Claude가 영업이익/순이익의 과거 연도는 추세로 추측해 "(추정)"을
      // 붙이게 됨 — 실제 EDGAR 수치인데 추정으로 오분류되는 원인. 세 지표 모두 연도별로 명시.
      const oiAbsent = e.rawSeries.operatingIncome.every(v => v == null);
      const niAbsent = e.rawSeries.netIncome.every(v => v == null);
      const naLabel = (fieldAbsent: boolean) => fieldAbsent ? '해당없음' : '확인 필요';
      lines.push('\n[다년도 손익 추이 — 전부 EDGAR 공식 수치, "(추정)" 표기 금지]');
      e.rawSeries.fiscalYears.forEach((fy, i) => {
        const rev = e.rawSeries!.revenue[i];
        const oi  = e.rawSeries!.operatingIncome[i];
        const ni  = e.rawSeries!.netIncome[i];
        lines.push(
          `· ${fy}: Revenue ${rev != null ? fmpUsd(rev) : '확인 필요'}` +
          `, Operating Inc. ${oi != null ? fmpUsd(oi) : naLabel(oiAbsent)}` +
          `, Net Income ${ni != null ? fmpUsd(ni) : naLabel(niAbsent)}`
        );
      });
    }
    const missingNote = missingYearsNote(e.rawSeries.fiscalYears);
    if (missingNote) lines.push(missingNote);
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
    lines.push('\n[최근 공시 목록]');
    e.filings.slice(0, 5).forEach((f) => {
      lines.push(`· ${f.filingDate}  ${f.form}`);
    });
  }

  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchFinancialContext(companyName: string): Promise<FinancialContext> {
  console.log(`[financialCtx] start "${companyName}"`);
  const isKorean = isKoreanCompany(companyName);

  try {
    if (isKorean) {
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

      // DART + KIS 병렬
      const dart = await fetchDartData(companyName);
      if (dart) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        return { source: 'dart', contextText: buildDartContext(dart, kis), rawDart: dart.rawSeries, isCacheHit: false };
      }
      // DART 실패 시 EDGAR 시도
      const edgar = await fetchEdgarData(companyName);
      if (edgar) {
        const fmpData = edgar.ticker
          ? await fetchFmpData(companyName, edgar.ticker).catch(() => null)
          : null;
        return { source: 'edgar', contextText: buildEdgarContext(edgar, fmpData), rawEdgar: edgar.rawSeries, isCacheHit: false };
      }
    } else {
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

      // EDGAR + FMP 병렬
      const [edgar, fmpData] = await Promise.allSettled([
        fetchEdgarData(companyName),
        fetchFmpData(companyName, null),
      ]);

      const e = edgar.status  === 'fulfilled' ? edgar.value  : null;
      const f = fmpData.status === 'fulfilled' ? fmpData.value : null;

      if (e) {
        // FMP는 EDGAR ticker를 우선 사용해 재시도
        const fmpFinal = f ?? (e.ticker
          ? await fetchFmpData(companyName, e.ticker).catch(() => null)
          : null);
        console.log(`[financialCtx] "${companyName}" → source=edgar (EDGAR+FMP) rev=${e.financials.revenue ?? 'null'}`);
        return { source: 'edgar', contextText: buildEdgarContext(e, fmpFinal), rawEdgar: e.rawSeries, isCacheHit: false };
      }
      if (f) {
        // EDGAR 없이 FMP만 있는 경우
        console.log(`[financialCtx] "${companyName}" → source=edgar (FMP only)`);
        return { source: 'edgar', contextText: buildFmpContext(f), isCacheHit: false };
      }

      // EDGAR/FMP 모두 실패 시 DART 시도
      const dart = await fetchDartData(companyName);
      if (dart) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        return { source: 'dart', contextText: buildDartContext(dart, kis), rawDart: dart.rawSeries, isCacheHit: false };
      }
    }
  } catch {
    // unexpected error → graceful fallback
  }

  console.log(`[financialCtx] "${companyName}" → source=web_search (all failed)`);
  return { source: 'web_search', contextText: '', isCacheHit: false };
}

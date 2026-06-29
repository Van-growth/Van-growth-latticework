// Orchestrates DART+KIS / EDGAR+FMP data fetch and formats as Claude prompt context

import { fetchDartData, DartData }                from './dart';
import { fetchEdgarData, EdgarData, lookupCikByName } from './edgar';
import { fetchKisQuote, KisQuote }               from './kis';
import { fetchFmpData, FmpData, buildFmpContext } from './fmp';
import { supabase }                              from './supabase';

export type DataSource = 'dart' | 'edgar' | 'web_search';

export interface FinancialContext {
  source:      DataSource;
  contextText: string;
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
      row('Operating Inc.', ef.operatingIncome,   fi?.operatingIncome),
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
          .select('context_text')
          .eq('company_name', corpRow.stock_code)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (cachedDart?.context_text) {
          console.log(`[financialCtx] "${companyName}" → financial_cache HIT DART (${corpRow.stock_code})`);
          return { source: 'dart', contextText: cachedDart.context_text };
        }
      }

      // DART + KIS 병렬
      const dart = await fetchDartData(companyName);
      if (dart) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        return { source: 'dart', contextText: buildDartContext(dart, kis) };
      }
      // DART 실패 시 EDGAR 시도
      const edgar = await fetchEdgarData(companyName);
      if (edgar) {
        const fmpData = edgar.ticker
          ? await fetchFmpData(companyName, edgar.ticker).catch(() => null)
          : null;
        return { source: 'edgar', contextText: buildEdgarContext(edgar, fmpData) };
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
          .select('context_text')
          .eq('company_name', lookupTicker)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();
        if (cached?.context_text) {
          console.log(`[financialCtx] "${companyName}" → financial_cache HIT EDGAR (${lookupTicker})`);
          return { source: 'edgar', contextText: cached.context_text };
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
        return { source: 'edgar', contextText: buildEdgarContext(e, fmpFinal) };
      }
      if (f) {
        // EDGAR 없이 FMP만 있는 경우
        console.log(`[financialCtx] "${companyName}" → source=edgar (FMP only)`);
        return { source: 'edgar', contextText: buildFmpContext(f) };
      }

      // EDGAR/FMP 모두 실패 시 DART 시도
      const dart = await fetchDartData(companyName);
      if (dart) {
        const kis = dart.stockCode ? await fetchKisQuote(dart.stockCode).catch(() => null) : null;
        return { source: 'dart', contextText: buildDartContext(dart, kis) };
      }
    }
  } catch {
    // unexpected error → graceful fallback
  }

  console.log(`[financialCtx] "${companyName}" → source=web_search (all failed)`);
  return { source: 'web_search', contextText: '' };
}

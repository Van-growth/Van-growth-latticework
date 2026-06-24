// Orchestrates DART+KIS / EDGAR+FMP data fetch and formats as Claude prompt context

import { fetchDartData, DartData }   from './dart';
import { fetchEdgarData, EdgarData } from './edgar';
import { fetchKisQuote, KisQuote }   from './kis';
import { fetchFmpData, buildFmpContext } from './fmp';

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

function buildEdgarContext(e: EdgarData, fmpText: string | null): string {
  const lines: string[] = [
    '=== SEC EDGAR 공시 데이터 (미국 증권거래위원회) ===',
    `기업: ${e.companyName}  (CIK: ${e.cik}${e.ticker ? `  ticker: ${e.ticker}` : ''})`,
  ];

  if (e.financials.year) {
    lines.push(`\n[${e.financials.year} 10-K 재무 수치 — XBRL 기준]`);
    if (e.financials.revenue)        lines.push(`· Revenue:          ${e.financials.revenue}`);
    if (e.financials.operatingIncome) lines.push(`· Operating Income: ${e.financials.operatingIncome}`);
    if (e.financials.netIncome)      lines.push(`· Net Income:       ${e.financials.netIncome}`);
    lines.push('→ 재무 섹션에 이 수치를 우선 사용하고 "(SEC EDGAR)" 출처를 명시하세요.');
  }

  if (fmpText) {
    lines.push('');
    lines.push(fmpText);
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
  const isKorean = isKoreanCompany(companyName);

  try {
    if (isKorean) {
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
        const fmpText = fmpData ? buildFmpContext(fmpData) : null;
        return { source: 'edgar', contextText: buildEdgarContext(edgar, fmpText) };
      }
    } else {
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
        const fmpText = fmpFinal ? buildFmpContext(fmpFinal) : null;
        return { source: 'edgar', contextText: buildEdgarContext(e, fmpText) };
      }
      if (f) {
        // EDGAR 없이 FMP만 있는 경우
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

  return { source: 'web_search', contextText: '' };
}

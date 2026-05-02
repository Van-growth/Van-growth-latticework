// Orchestrates DART / EDGAR data fetch and formats it as Claude prompt context

import { fetchDartData, DartData } from './dart';
import { fetchEdgarData, EdgarData } from './edgar';

export type DataSource = 'dart' | 'edgar' | 'web_search';

export interface FinancialContext {
  source: DataSource;
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

function buildDartContext(d: DartData): string {
  const lines: string[] = [
    '=== DART 공시 데이터 (금융감독원 전자공시시스템) ===',
    `기업: ${d.corpName}  (corp_code: ${d.corpCode})`,
  ];

  if (d.financials.year) {
    lines.push(`\n[${d.financials.year}년 사업보고서 재무 수치 — 별도 기준]`);
    if (d.financials.revenue)         lines.push(`· 매출액:       ${formatKrw(d.financials.revenue)}`);
    if (d.financials.operatingProfit) lines.push(`· 영업이익:     ${formatKrw(d.financials.operatingProfit)}`);
    if (d.financials.netIncome)       lines.push(`· 당기순이익:   ${formatKrw(d.financials.netIncome)}`);
    lines.push('→ 재무 섹션에 이 수치를 우선 사용하고 "(DART 공시)" 출처를 명시하세요.');
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

function buildEdgarContext(e: EdgarData): string {
  const lines: string[] = [
    '=== SEC EDGAR 공시 데이터 (미국 증권거래위원회) ===',
    `기업: ${e.companyName}  (CIK: ${e.cik})`,
  ];

  if (e.financials.year) {
    lines.push(`\n[${e.financials.year} 10-K 재무 수치 — XBRL 기준]`);
    if (e.financials.revenue)        lines.push(`· Revenue:         ${e.financials.revenue}`);
    if (e.financials.operatingIncome) lines.push(`· Operating Income: ${e.financials.operatingIncome}`);
    if (e.financials.netIncome)      lines.push(`· Net Income:      ${e.financials.netIncome}`);
    lines.push('→ 재무 섹션에 이 수치를 우선 사용하고 "(SEC EDGAR)" 출처를 명시하세요.');
  }

  if (e.filings.length) {
    lines.push('\n[최근 공시 목록]');
    e.filings.slice(0, 5).forEach((f) => {
      lines.push(`· ${f.filingDate}  ${f.form}`);
    });
  }

  return lines.join('\n');
}

export async function fetchFinancialContext(companyName: string): Promise<FinancialContext> {
  const isKorean = isKoreanCompany(companyName);

  try {
    if (isKorean) {
      const dart = await fetchDartData(companyName);
      if (dart) return { source: 'dart', contextText: buildDartContext(dart) };
      const edgar = await fetchEdgarData(companyName);
      if (edgar) return { source: 'edgar', contextText: buildEdgarContext(edgar) };
    } else {
      const edgar = await fetchEdgarData(companyName);
      if (edgar) return { source: 'edgar', contextText: buildEdgarContext(edgar) };
      const dart = await fetchDartData(companyName);
      if (dart) return { source: 'dart', contextText: buildDartContext(dart) };
    }
  } catch {
    // Any unexpected error → graceful fallback
  }

  return { source: 'web_search', contextText: '' };
}

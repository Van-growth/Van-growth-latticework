import { FinancialsV2 } from '@/types';

// -999 등 placeholder 값 감지 — 웹(AnalysisCard)·PDF(AnalysisPdf) 양쪽에서 공용으로 사용
export function isPlaceholder(v: string | number | null | undefined): boolean {
  if (v == null) return false;
  return /^-999([.,]\d+)?([%\s]|$)/.test(String(v).trim());
}

export interface FinancialsReliabilityCounts {
  estimatedCount: number;
  unknownCount: number;
}

// income_statement/balance_sheet 행에 실제로 존재하는 fy{year} 컬럼만 오름차순으로 추출 —
// 회사마다 보유 연도 수가 다르므로(신규 상장사는 적고, 오래된 기업은 최대 5개) 더 이상
// 고정된 fy2021~fy2025 리터럴을 가정하지 않는다. 웹(AnalysisCard)·PDF(AnalysisPdf) 공용.
export function getFinancialYearCols(row: Record<string, string | undefined>): string[] {
  return Object.keys(row).filter(k => /^fy\d{4}$/.test(k)).sort();
}

// 재무 탭/PDF에 표시되는 필드들 중 (추정) 배지 값과 확인 필요(플레이스홀더) 값 카운트
export function countFinancialsReliability(f: FinancialsV2): FinancialsReliabilityCounts {
  const values: (string | undefined)[] = [
    ...f.income_statement.flatMap(row => getFinancialYearCols(row).map(k => row[k])),
    ...f.balance_sheet.flatMap(row => getFinancialYearCols(row).map(k => row[k])),
    f.cash_flow.operating, f.cash_flow.investing, f.cash_flow.financing, f.cash_flow.fcf,
  ];
  let estimatedCount = 0;
  let unknownCount = 0;
  for (const v of values) {
    if (!v) continue;
    if (v.includes('(추정)') || v.includes('(estimated)')) estimatedCount++;
    else if (isPlaceholder(v) || v === '확인 필요' || v === '공개 없음' || v === 'Not disclosed') unknownCount++;
  }
  return { estimatedCount, unknownCount };
}

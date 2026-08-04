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

// 재무 탭/PDF에 표시되는 필드들 중 (추정) 배지 값과 확인 필요(플레이스홀더) 값 카운트
export function countFinancialsReliability(f: FinancialsV2): FinancialsReliabilityCounts {
  const values: (string | undefined)[] = [
    ...f.income_statement.flatMap(row => [row.fy2021, row.fy2022, row.fy2023, row.fy2024, row.fy2025]),
    ...f.balance_sheet.flatMap(row => [row.fy2023, row.fy2024, row.fy2025]),
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

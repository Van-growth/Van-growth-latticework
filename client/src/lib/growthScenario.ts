// 웹(AnalysisCard.tsx)과 PDF(AnalysisPdf.tsx)가 동일한 성장 시나리오 숫자를 보여줘야
// 하므로, CAGR 계산/포맷과 매출 포맷은 각자 재구현하지 않고 여기 단일 소스로 관리한다
// (2026-08-16, PDF에 CAGR+그래프 추가 작업 계기 — 이전엔 AnalysisPdf.tsx의
// fmtPdfRevenue가 AnalysisCard.tsx의 fmtGrowthRevenue를 "손으로 미러링"하고 있었음,
// 재구현 없이 import로 전환).

// 라인 자기 자신의 첫 연도 → 마지막 연도 구간 CAGR — 라인 간 교차 계산 없음(2026-08-17).
// years는 항상 3이지만(server/src/services/monteCarloService.ts 기본값, 오버라이드하는
// 호출부 없음) 배열 길이 기반으로 일반화해 나중에 바뀌어도 안전하게 뒀다.
export function calcCagr(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const first = values[0];
  const last = values[n - 1];
  if (first <= 0 || last <= 0) return null;
  return (last / first) ** (1 / (n - 1)) - 1;
}

export function fmtCagr(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}

export function fmtGrowthRevenue(v: number, currency: 'KRW' | 'USD'): string {
  const abs = Math.abs(v);
  if (currency === 'KRW') {
    if (abs >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조원`;
    if (abs >= 100_000_000)       return `${(v / 100_000_000).toFixed(0)}억원`;
    return `${Math.round(v).toLocaleString()}원`;
  }
  const b = abs / 1_000_000_000;
  return b >= 1 ? `${(v / 1_000_000_000).toFixed(1)}B USD` : `${(v / 1_000_000).toFixed(0)}M USD`;
}

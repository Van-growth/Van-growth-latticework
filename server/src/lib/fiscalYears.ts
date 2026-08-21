// 최근 N개년 회계연도 라벨(내림차순, "2025"/"2024"/...) — DART bsns_year 파라미터 계산에
// 공용으로 쓰인다. 순수 함수, 외부 의존성 없음(라이브 조회 dart.ts와 배치 프리컴퓨트
// dartBatchPrecompute.ts가 이 하나만 공유해, "배치가 라이브 로직을 복제하다 한쪽만
// 최신화 안 되는" 반복 패턴을 원천 차단 — 2026-08-21, 데이원컴퍼니 FY2025 미표시 조사
// 계기). 당해년도(from 기준)는 아직 사업보고서가 안 나왔을 수 있어 currentYear-1부터.
export function getRecentFiscalYears(count: number, from: Date = new Date()): string[] {
  const currentYear = from.getFullYear();
  return Array.from({ length: count }, (_, i) => String(currentYear - 1 - i));
}

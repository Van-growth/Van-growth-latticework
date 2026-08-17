-- 목적 상세(purpose_detail) 입력 원문을 정리(오타 수정/구어체→문어체)한 표시 전용
-- 텍스트(2026-08-17, 분석 시작 전 확인 다이얼로그 통합 작업 계기) — 9개 섹션 생성
-- 프롬프트에는 절대 주입되지 않는다(analyses.purpose_detail 원문만 계속 사용,
-- claude.ts의 purposeBlock 참고). 웹 리포트 헤더/PDF 표지에서만
-- purpose_detail_formatted ?? purpose_detail 순서로 표시.
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS purpose_detail_formatted TEXT;

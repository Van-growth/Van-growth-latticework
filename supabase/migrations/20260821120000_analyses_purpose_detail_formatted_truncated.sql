-- purpose_detail_formatted가 Claude 응답 잘림(stop_reason='max_tokens') 상태로 저장됐는지
-- 표시하는 플래그(2026-08-21, generateReformattedPurpose() max_tokens=200 하드코딩
-- truncation 버그 수정 후속) — 재시도(1회)까지 실패해 잘린 텍스트를 그대로 저장할 때만 true.
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS purpose_detail_formatted_truncated BOOLEAN NOT NULL DEFAULT false;

-- 공유 링크/PDF에 "이 분석은 OOO의 ICP 기준으로 생성됨" 라벨을 붙일 때 쓸 표시명.
-- 이메일은 마스킹해도 실제 이메일에서 유도된 PII라 어떤 형태로도 공개 화면에 노출하지
-- 않기로 결정(2026-08-15) — 대신 유저가 선택적으로 입력하는 닉네임만 사용. 미입력이면
-- 공유 화면은 소유자 이름 없이 일반 문구로 대체(share.ts 참고).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname text;

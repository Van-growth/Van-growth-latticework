// 로그인(구글 OAuth) 미구현 상태의 임시 브라우저 식별자 — 분석 횟수 제한(analysis_usage)에 사용.
// 로그인 도입 후 실제 auth user_id 기준으로 전환 예정.
const STORAGE_KEY = 'lw_client_id';

export function getClientId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

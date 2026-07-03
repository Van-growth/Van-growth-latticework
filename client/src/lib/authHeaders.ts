// 로그인 시 Authorization Bearer가 서버에서 우선 사용됨(analysis_usage.user_id, isPremium 판정) —
// 비로그인 유저는 X-Client-Id(localStorage)만 보내는 기존 체험 그대로 유지.
export function buildAuthHeaders(clientId: string | null, accessToken?: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (clientId) headers['X-Client-Id'] = clientId;
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return headers;
}

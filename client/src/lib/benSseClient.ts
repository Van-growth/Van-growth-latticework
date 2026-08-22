// Ben 채팅의 SSE 프레임 파싱 — analysis Ben(useBenChat)과 관리자 Ben(useAdminInsightsChat)이
// 프로토콜(히스토리를 서버가 들고 있는지 vs 클라이언트가 매번 실어보내는지)은 다르지만
// event:/data: 프레이밍을 읽는 방식은 완전히 동일해서 이 부분만 공유한다.
export interface RateLimitInfo {
  usedCount: number;
  limit: number;
  nextAvailableAt: string | null;
}

export interface BenStreamHandlers {
  onToken: (text: string) => void;
  onRateLimited: (info: RateLimitInfo) => void;
  onServerError: (reason: string) => void;
}

export async function consumeBenSseStream(res: Response, handlers: BenStreamHandlers): Promise<void> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const lines = part.split('\n');
      let eventType = 'message';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7).trim();
        if (line.startsWith('data: ')) dataStr = line.slice(6);
      }
      if (!dataStr) continue;

      try {
        const payload = JSON.parse(dataStr);
        if (eventType === 'token') {
          handlers.onToken(payload.text ?? '');
        } else if (eventType === 'rate_limited') {
          handlers.onRateLimited({ usedCount: payload.usedCount ?? 0, limit: payload.limit ?? 0, nextAvailableAt: payload.nextAvailableAt ?? null });
        } else if (eventType === 'error') {
          handlers.onServerError(payload.reason ?? 'unknown');
        }
      } catch { /* skip malformed SSE payload */ }
    }
  }
}

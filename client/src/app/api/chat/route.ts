import { NextResponse } from 'next/server';

// AI 비서 우측 패널이 UI에서 제거된 상태라 이 라우트도 비활성화한다.
// 재활성화 시 인증(X-Client-Id 등) + 레이트리밋(analysisUsage.ts 패턴 참고)을 반드시 추가할 것.
export async function POST() {
  return NextResponse.json({ error: 'Gone' }, { status: 410 });
}

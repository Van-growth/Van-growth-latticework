import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

// NEXT_PUBLIC_* 값은 빌드 타임에 번들에 박히므로, 런타임(client)에서 없으면 던지는
// 걸로는 늦다 — connect-src가 조용히 'self'만 남아 배포된 뒤에야 전체 API 호출이
// CSP로 막히는 장애가 재발한다(2026-07-04 script-src 사고와 같은 패턴). 빌드 자체를
// 실패시켜서 Render 클라이언트 서비스에 빌드타임 env var 누락을 즉시 드러낸다.
if (process.env.NODE_ENV === 'production' && !apiUrl) {
  throw new Error(
    'NEXT_PUBLIC_API_URL이 비어있습니다 — 프로덕션 빌드에 필수. ' +
    'Render 클라이언트 서비스의 빌드타임 환경변수로 설정되어 있는지 확인할 것 ' +
    '(connect-src CSP가 API 서버 호출을 전부 차단하게 됨).'
  );
}

// 개발 모드(next dev)는 HMR/react-refresh가 인라인 스크립트+eval을 쓰므로
// CSP는 production 빌드에서만 적용한다. 나머지 헤더는 dev/prod 공통 적용.
//
// script-src 'unsafe-inline' — 임시 완화 조치 (2026-07-04).
// Next.js App Router가 hydration에 필수로 쓰는 inline script를 'self'만으로는
// 차단해 프로덕션 화면이 안 뜨는 장애가 발생했음. 추후 middleware.ts에서
// 요청마다 nonce를 생성해 CSP 헤더와 실제 script 태그에 동일 nonce를 적용하는
// 방식으로 전환 필요 (Security Principles 참고).
//
// script-src 'wasm-unsafe-eval' — PDF 내보내기(@react-pdf/renderer → yoga-layout)가
// 브라우저에서 WebAssembly.instantiate로 flexbox 레이아웃 엔진을 로드함. 'unsafe-eval'
// 전체가 아니라 WASM 컴파일만 허용하는 좁은 범위의 값을 사용 (2026-07-04 발견).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https://fchart.stock.naver.com https://finviz.com`,
  "font-src 'self'",
  `connect-src 'self' ${apiUrl}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy', value: csp }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

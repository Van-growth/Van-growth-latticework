import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

// 개발 모드(next dev)는 HMR/react-refresh가 인라인 스크립트+eval을 쓰므로
// CSP는 production 빌드에서만 적용한다. 나머지 헤더는 dev/prod 공통 적용.
//
// script-src 'unsafe-inline' — 임시 완화 조치 (2026-07-04).
// Next.js App Router가 hydration에 필수로 쓰는 inline script를 'self'만으로는
// 차단해 프로덕션 화면이 안 뜨는 장애가 발생했음. 추후 middleware.ts에서
// 요청마다 nonce를 생성해 CSP 헤더와 실제 script 태그에 동일 nonce를 적용하는
// 방식으로 전환 필요 (Security Principles 참고).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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

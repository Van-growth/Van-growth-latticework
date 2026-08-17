import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

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
// supabase-js가 세션 조회/갱신(getSession, onAuthStateChange)을 위해 Supabase 프로젝트
// URL로 직접 fetch를 보낸다 — 없으면 구글 로그인 자체가 connect-src에 막혀 조용히 실패.
if (process.env.NODE_ENV === 'production' && !supabaseUrl) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL이 비어있습니다 — 프로덕션 빌드에 필수. ' +
    'Render 클라이언트 서비스의 빌드타임 환경변수로 설정되어 있는지 확인할 것 ' +
    '(connect-src CSP가 Supabase Auth 호출을 전부 차단하게 됨).'
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
//
// img-src에 lh3.googleusercontent.com — 구글 로그인 프로필 사진.
// connect-src에 supabaseUrl — supabase-js의 세션 조회/갱신 fetch (구글 로그인, 2026-07-03).
//
// connect-src에 data: — PDF 생성 중 콘솔에 찍히던 CSP 위반(2026-08-17 조사) 원인 확정
// 및 실측 재현. @react-pdf/renderer → @react-pdf/layout이 flexbox 레이아웃 엔진으로 쓰는
// yoga-layout이 자신의 WASM 바이너리를 data:application/octet-stream;base64,... 문자열로
// 코드에 인라인해두고, 그걸 fetch(dataUri)로 다시 읽어 WebAssembly.instantiateStreaming에
// 넘긴다(node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js, Emscripten 표준
// 로더 패턴). 최근 추가된 SVG 차트/CAGR 배지와는 무관 — <Image> 컴포넌트 자체를 안 쓰므로
// @react-pdf/image의 base64 이미지 경로도 아니었음. fetch()가 대상이 data: URI라도 Chrome은
// connect-src로 이 호출을 막는데(실제 네트워크 연결은 없음에도), 여태 connect-src에 data:가
// 없었던 것 — script-src의 'wasm-unsafe-eval'(2026-07-04, WASM 컴파일 허용)만으로는
// 부족했다. Playwright로 실제 프로덕션 빌드(next build && next start)에 두 CSP를 각각
// 적용해 재현 — 수정 전 CSP에서 사용자가 제보한 것과 토씨 하나 다르지 않은 콘솔 에러
// 재현 확인, 수정 후엔 0건. ⚠️ 다만 이 콘솔 에러 자체가 PDF 생성을 "완전히 멈춤"으로
// 만드는지는 검증 범위 밖 — yoga-layout이 스트리밍 컴파일 실패 시 fetch 재시도 →
// 최종적으로 atob() 기반 동기 디코드로 폴백하는 3단 체인을 갖고 있어, 격리 테스트(간단한
// 1페이지 문서)에서는 이 CSP 위반이 있어도 PDF 생성 자체는 끝까지 완료됐음(무한 정지 아님).
// 다만 그 폴백 경로는 스트리밍 컴파일보다 느리고 메인 스레드를 더 오래 점유하는 동기
// 디코드라, 실제 프로덕션 리포트(21+페이지, NotoSerifKR 풀 글리프셋)처럼 이미 메인 스레드
// 점유가 큰 상황(2026-08-16 진행률 프리징 조사 참고)에서는 체감상 "멈춘 것처럼" 보일
// 정도로 오래 걸렸을 가능성이 있다 — 배포 후 실사용 재현 테스트로 최종 확인 필요.
// data: URI는 브라우저가 로컬에서 그대로 해석할 뿐 원격 서버로의 연결이 발생하지 않으므로
// (exfiltration 벡터 없음) connect-src에 허용해도 이 지시어의 본래 방어 목적(공격자
// 서버로의 데이터 유출 차단)을 훼손하지 않는다. yoga-layout이 export하는 로더가
// 'yoga-layout/load' 단일 진입점뿐이라 데이터 URI를 안 쓰는 대체 로딩 경로 자체가 없음
// (패치 없이는 우회 불가) — CSP 허용이 유일한 실용적 해결책.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: https://lh3.googleusercontent.com`,
  "font-src 'self'",
  `connect-src 'self' data: ${apiUrl} ${supabaseUrl}`.trim(),
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

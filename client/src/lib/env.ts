// dev/prod 배포 구분 플래그 (서버의 server/src/lib/env.ts와 동일한 목적).
// 브라우저에서 읽어야 하므로 NEXT_PUBLIC_ 접두사 필수 — 빌드 타임에 번들에 박힘.
export type AppEnv = 'production' | 'development';

export const APP_ENV: AppEnv = process.env.NEXT_PUBLIC_APP_ENV === 'production' ? 'production' : 'development';
export const isProduction = APP_ENV === 'production';

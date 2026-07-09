// dev/prod 배포 구분 플래그. NODE_ENV는 쓰지 않음 — `tsc && node dist/index.js`가
// dev/prod 어느 Render 서비스에서 돌든 NODE_ENV 자체를 dev/prod로 구분해주지 않으므로,
// 배포 환경 구분은 이 별도 플래그(APP_ENV)로 한다.
export type AppEnv = 'production' | 'development';

export const APP_ENV: AppEnv = process.env.APP_ENV === 'production' ? 'production' : 'development';
export const isProduction = APP_ENV === 'production';

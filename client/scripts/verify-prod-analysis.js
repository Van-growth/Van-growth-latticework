const { chromium } = require('playwright');

const URL = process.argv[2];
const COMPANY = process.argv[3];
const OUT_DIR = process.argv[4];
const PROFILE_DIR = process.argv[5];
const SCREENSHOT_NAME = process.argv[6] || 'result.png';
const TIMEOUT_MS = Number(process.argv[7] || 150000);

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('response', res => {
    if (res.url().includes('/api/analyze') && res.status() >= 400) {
      networkErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  console.log(`=== ${COMPANY} ===`);
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  await page.fill('input[placeholder*="기업명"]', COMPANY);
  await page.click('button:has-text("분석하기")');

  // 요청 시작 확인
  await page.waitForSelector('button:has-text("분석 중...")', { timeout: 10000 }).catch(() => {
    console.log('WARN: "분석 중..." 상태를 못 봤음 (너무 빨리 캐시 히트했을 수 있음)');
  });

  // 완료(버튼 텍스트 복귀) 대기
  const start = Date.now();
  await page.waitForSelector('button:has-text("분석하기"):not(:has-text("분석 중"))', { timeout: TIMEOUT_MS });
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`ANALYSIS_COMPLETED_IN: ${elapsedSec}s`);

  await page.waitForTimeout(1000);

  // 실제 상단 에러 배너만 특정 (HomeContent.tsx: bg-red-50 border-red-200 rounded-2xl p-5 text-red-700 text-sm)
  const errorBanner = await page.locator('div.bg-red-50.border-red-200.text-red-700').count();
  console.log('ERROR_BANNER_COUNT:', errorBanner);
  if (errorBanner > 0) {
    console.log('ERROR_BANNER_TEXT:', await page.locator('div.bg-red-50.border-red-200.text-red-700').first().textContent());
  }

  const companyHeading = await page.locator('h2').first().textContent().catch(() => null);
  console.log('COMPANY_HEADING:', companyHeading);

  console.log('NETWORK_ERRORS:', JSON.stringify(networkErrors));
  console.log('CONSOLE_ERRORS_COUNT:', consoleErrors.length);
  const rlsRelated = consoleErrors.filter(e => e.includes('42501') || e.toLowerCase().includes('row-level security'));
  console.log('RLS_RELATED_CONSOLE_ERRORS:', JSON.stringify(rlsRelated));
  if (consoleErrors.length > 0) console.log('ALL_CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2));

  await page.screenshot({ path: `${OUT_DIR}/${SCREENSHOT_NAME}`, fullPage: true });

  await context.close();
})();

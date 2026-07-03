const { chromium } = require('playwright');

const URL = process.argv[2];
const OUT_DIR = process.argv[3];
const PROFILE_DIR = process.argv[4];

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => { pageErrors.push(err.message); });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const heading = await page.locator('text=기업 심층 분석').count();
  console.log('HEADING_FOUND:', heading);

  const searchInput = await page.locator('input[placeholder*="기업명"]').count();
  console.log('SEARCH_INPUT_FOUND:', searchInput);

  await page.screenshot({ path: `${OUT_DIR}/prod-check.png`, fullPage: true });

  console.log('CONSOLE_ERRORS_COUNT:', consoleErrors.length);
  console.log('CONSOLE_ERRORS:', JSON.stringify(consoleErrors, null, 2));
  console.log('PAGE_ERRORS_COUNT:', pageErrors.length);
  console.log('PAGE_ERRORS:', JSON.stringify(pageErrors, null, 2));

  await context.close();
})();

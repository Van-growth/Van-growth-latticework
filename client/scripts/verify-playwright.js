const { chromium } = require('playwright');

const ANALYSIS_ID  = process.argv[2];
const OUT_DIR       = process.argv[3];
const PROFILE_DIR   = process.argv[4];
const SCREENSHOT_NAME = process.argv[5] || 'screenshot.png';
const FORCE_CLIENT_ID = process.argv[6] || null;

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    viewport: { width: 1280, height: 900 },
  });
  if (FORCE_CLIENT_ID) {
    await context.addInitScript((id) => { window.localStorage.setItem('lw_client_id', id); }, FORCE_CLIENT_ID);
  }
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`http://localhost:3000/?id=${ANALYSIS_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=성장 시나리오', { timeout: 15000 });

  const usagePill = await page.locator('text=/무료 분석/').first().textContent().catch(() => null);
  console.log('USAGE_PILL:', usagePill);

  const clientId = await page.evaluate(() => window.localStorage.getItem('lw_client_id'));
  console.log('CLIENT_ID:', clientId);

  await page.click('text=성장 시나리오');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT_DIR}/${SCREENSHOT_NAME}`, fullPage: true });

  const lockedText = await page.locator('text=프리미엄 전용 기능이에요').count();
  console.log('LOCKED_MESSAGE_FOUND:', lockedText);
  const proBadge = await page.locator('text=PRO').count();
  console.log('PRO_BADGE_FOUND:', proBadge);
  const tableRows = await page.locator('text=/Year \\+/').count();
  console.log('SIMULATION_TABLE_ROWS_FOUND:', tableRows);

  console.log('CONSOLE_ERRORS:', JSON.stringify(errors));

  await context.close();
})();

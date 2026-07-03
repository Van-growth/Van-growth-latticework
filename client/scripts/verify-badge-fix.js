const { chromium } = require('playwright');

const URL = process.argv[2];
const OUT_DIR = process.argv[3];
const PROFILE_DIR = process.argv[4];

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { viewport: { width: 1280, height: 1100 } });
  const page = await context.newPage();

  await page.goto(`${URL}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[placeholder*="기업명"]', 'Adobe');
  await page.click('button:has-text("분석하기")');
  await page.waitForSelector('button:has-text("분석하기"):not(:has-text("분석 중"))', { timeout: 30000 });
  await page.waitForTimeout(800);

  await page.click('button:has-text("재무")');
  await page.waitForTimeout(800);

  // 손익계산서 테이블 전체 텍스트 확보
  const tableText = await page.locator('table').first().textContent().catch(() => '');
  const hasPlaceholder = tableText.includes('확인 필요');
  console.log('HAS_PLACEHOLDER_CELL:', hasPlaceholder);

  // 배지(파란/초록 점) 총 개수와, "확인 필요" 텍스트를 담은 행(tr) 안에 점이 있는지 검사
  const rows = await page.locator('table tr').all();
  let placeholderRowsWithBadge = 0;
  let placeholderRowsTotal = 0;
  let realValueRowsWithBadge = 0;
  let realValueCellsTotal = 0;

  for (const row of rows) {
    const cells = await row.locator('td').all();
    for (const cell of cells) {
      const text = (await cell.textContent()) ?? '';
      const badgeCount = await cell.locator('span.rounded-full').count();
      if (text.includes('확인 필요')) {
        placeholderRowsTotal++;
        if (badgeCount > 0) placeholderRowsWithBadge++;
      } else if (/[0-9]/.test(text)) {
        realValueCellsTotal++;
        if (badgeCount > 0) realValueRowsWithBadge++;
      }
    }
  }

  console.log('PLACEHOLDER_CELLS_TOTAL:', placeholderRowsTotal);
  console.log('PLACEHOLDER_CELLS_WITH_BADGE (should be 0):', placeholderRowsWithBadge);
  console.log('REAL_VALUE_CELLS_TOTAL:', realValueCellsTotal);
  console.log('REAL_VALUE_CELLS_WITH_BADGE (should be > 0):', realValueRowsWithBadge);

  await page.screenshot({ path: `${OUT_DIR}/badge-fix-check.png`, fullPage: true });

  await context.close();
})();

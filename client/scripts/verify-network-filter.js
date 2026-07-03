const { chromium } = require('playwright');

const ANALYSIS_ID = process.argv[2];
const PROFILE_DIR = process.argv[3];

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const responses = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/analyses/') || url.includes('/api/analyze/')) {
      try {
        const body = await res.text();
        responses.push({ url, hasField: body.includes('growth_scenario_v2'), snippet: body.includes('growth_scenario_v2') ? body.match(/"growth_scenario_v2":([^,}]*[}\]]?[^,}]*)/)?.[0] : null });
      } catch {}
    }
  });

  await page.goto(`http://localhost:3000/?id=${ANALYSIS_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=성장 시나리오', { timeout: 15000 });
  await page.click('text=성장 시나리오');
  await page.waitForTimeout(500);

  console.log('=== Network responses touching analyses/analyze endpoints ===');
  for (const r of responses) {
    console.log(r.url, '->', r.hasField ? `FIELD PRESENT: ${r.snippet}` : 'no growth_scenario_v2 key at all, OR null');
  }

  const lockedText = await page.locator('text=프리미엄 전용 기능이에요').count();
  console.log('LOCKED_UI_SHOWN:', lockedText > 0);

  await context.close();
})();

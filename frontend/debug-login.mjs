import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

process.env.LD_LIBRARY_PATH = '/workspace/ssd/toolchain/libs/usr/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/libs/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/postgres/lib:' + (process.env.LD_LIBRARY_PATH || '');

const DIR = '/workspace/ssd/screenshots';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

// Capture console
page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));
page.on('response', resp => {
  if (resp.url().includes('/api/')) {
    console.log(`[API] ${resp.status()} ${resp.url()}`);
  }
});
page.on('requestfailed', req => console.log(`[FAIL] ${req.url()} — ${req.failure()?.errorText}`));

await page.goto('http://localhost:5175/login');
await page.waitForLoadState('networkidle');

console.log('--- Filling form ---');
const inputs = await page.locator('input').all();
console.log(`Inputs: ${inputs.length}`);
for (let i = 0; i < inputs.length; i++) {
  const typ = await inputs[i].getAttribute('type');
  console.log(`  input[${i}] type=${typ}`);
}

await inputs[0].fill('admin');
await inputs[1].fill('Qlttxd@2026');
console.log('--- Clicking submit ---');

// Intercept the response
const [response] = await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/v1/auth/login'), { timeout: 10000 }).catch(() => null),
  page.getByRole('button', { name: 'Đăng nhập' }).click()
]);

if (response) {
  console.log(`Login response: ${response.status()}`);
  const body = await response.json().catch(() => response.text());
  console.log(`Body: ${JSON.stringify(body).substring(0, 500)}`);
} else {
  console.log('No API response captured!');
}

await page.waitForTimeout(3000);
console.log(`Final URL: ${page.url()}`);

await page.screenshot({ path: `${DIR}/debug-after-login.png` });
await browser.close();

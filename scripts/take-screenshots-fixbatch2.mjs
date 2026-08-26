// Chụp FIX-BATCH-2 — SPA navigation qua history API (giữ phiên, không reload)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const FE = 'http://127.0.0.1:5199';
const OUT = '/workspace/ssd/qlttxd/docs/screenshots/v0.3.2';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });

await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await page.locator('label:has-text("Tên đăng nhập") input').fill('admin');
await page.locator('label:has-text("Mật khẩu") input').fill('Qlttxd@2026');
await page.locator('button:has-text("Đăng nhập")').click();
await page.waitForTimeout(5000);
if (!(await page.locator('header').count())) throw new Error('LOGIN FAILED');

async function spaNav(path) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(3000);
}

// Trang Trạng thái hồ sơ
await spaNav('/admin/settings/v2/workflow-states');
console.log('WF URL:', page.url());
console.log('WF HAS ASIDE:', await page.locator('aside').count());
await page.screenshot({ path: `${OUT}/fixbatch2-workflow-states-edit.png` });
console.log('shot 1 ok');

// Trang Loại tệp cho phép
await spaNav('/admin/settings/v2/mime-types');
console.log('MIME URL:', page.url());
await page.screenshot({ path: `${OUT}/fixbatch2-mime-types-toggle.png` });
console.log('shot 2 ok');

await browser.close();
console.log('DONE');

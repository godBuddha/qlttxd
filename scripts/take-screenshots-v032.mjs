import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const DIR = '/workspace/ssd/qlttxd/docs/screenshots/v0.3.2';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });

let idx = 0;
async function snap(page, name) {
  idx++;
  const padded = String(idx).padStart(2, '0');
  await page.screenshot({ path: `${DIR}/${padded}-${name}.png`, fullPage: true });
  console.log(`✅ ${padded}-${name}.png`);
}

async function login(page, username, password) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.locator('label:has-text("Tên đăng nhập") input').fill(username);
  await page.locator('label:has-text("Mật khẩu") input').fill(password);
  await page.click('button:has-text("Đăng nhập")');
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

async function clickNav(page, text, name) {
  // In-app navigation via sidebar button — reliable, no full reload
  const btn = page.locator(`nav button:has-text("${text}")`).first();
  await btn.click();
  await page.waitForTimeout(2500);
  await snap(page, name);
}

// ============ LOGIN PAGE ============
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.waitForLoadState('networkidle');
  await snap(p, 'login-page');
  await ctx.close();
}

// ============ ADMIN ============
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await login(page, 'admin', 'Qlttxd@2026');

await snap(page, 'admin-dashboard'); // /dashboard after login
await clickNav(page, 'Hồ sơ xử lý', 'admin-cases');

// Case detail — click first row Chi tiết
try {
  await page.waitForSelector('table tbody tr', { timeout: 15000 });
  await page.waitForTimeout(600);
  const dtBtn = page.locator('table tbody tr button.text-button:has-text("Chi tiết")').first();
  if (await dtBtn.count()) {
    await dtBtn.click();
    await page.waitForTimeout(2500);
    await snap(page, 'admin-case-detail');
    for (const tab of ['Quyết định', 'Khắc phục', 'Biên bản', 'Ảnh', 'Timeline']) {
      try {
        const t = page.locator(`.tabs button:has-text("${tab}")`).first();
        if (await t.count()) { await t.click(); await page.waitForTimeout(1200); await snap(page, `admin-case-${tab}`); }
      } catch {}
    }
  }
} catch (e) { console.log(`⚠️ case-detail: ${e.message.substring(0,80)}`); }

// Back to cases, then other admin pages
await clickNav(page, 'Hồ sơ xử lý', 'admin-cases-2');
await clickNav(page, 'Báo cáo vi phạm', 'admin-officer-reports');
await clickNav(page, 'Bản đồ', 'admin-ban-do');
await clickNav(page, 'Người dùng', 'admin-users');
await clickNav(page, 'Phân quyền', 'admin-roles');
await clickNav(page, 'Nhật ký hệ thống', 'admin-audit-log');
await clickNav(page, 'Địa điểm', 'admin-locations');
await clickNav(page, 'Danh mục', 'admin-catalog');
await clickNav(page, 'Báo cáo', 'admin-report');
await clickNav(page, 'Hồ sơ', 'admin-profile');

// ============ CITIZEN ============
try {
  await page.click('button:has-text("Đăng xuất")');
  await page.waitForTimeout(1500);
  await login(page, 'congdan01', 'Qlttxd@2026');
  await snap(page, 'citizen-dashboard');
  await clickNav(page, 'Báo cáo vi phạm', 'citizen-report');
  await clickNav(page, 'Hồ sơ', 'citizen-profile');
} catch (e) { console.log(`⚠️ citizen: ${e.message.substring(0,80)}`); }

// ============ HANDLER ============
try {
  await page.click('button:has-text("Đăng xuất")');
  await page.waitForTimeout(1500);
  await login(page, 'canbo01', 'Qlttxd@2026');
  await snap(page, 'handler-dashboard');
  await clickNav(page, 'Hồ sơ xử lý', 'handler-cases');
  await clickNav(page, 'Báo cáo vi phạm', 'handler-officer-reports');
} catch (e) { console.log(`⚠️ handler: ${e.message.substring(0,80)}`); }

// ============ VERIFIER ============
try {
  await page.click('button:has-text("Đăng xuất")');
  await page.waitForTimeout(1500);
  await login(page, 'xacthuc01', 'Qlttxd@2026');
  await snap(page, 'verifier-dashboard');
  await clickNav(page, 'Hồ sơ xử lý', 'verifier-cases');
} catch (e) { console.log(`⚠️ verifier: ${e.message.substring(0,80)}`); }

// ============ LEADER ============
try {
  await page.click('button:has-text("Đăng xuất")');
  await page.waitForTimeout(1500);
  await login(page, 'lanhdao01', 'Qlttxd@2026');
  await snap(page, 'leader-dashboard');
  await clickNav(page, 'Báo cáo', 'leader-report');
} catch (e) { console.log(`⚠️ leader: ${e.message.substring(0,80)}`); }

await ctx.close();

// ============ RESPONSIVE (mobile) ============
try {
  const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mob = await mobCtx.newPage();
  await login(mob, 'admin', 'Qlttxd@2026');
  await snap(mob, 'mobile-dashboard');
  await clickNav(mob, 'Hồ sơ xử lý', 'mobile-cases');
  await clickNav(mob, 'Bản đồ', 'mobile-ban-do');
  await mobCtx.close();
} catch (e) { console.log(`⚠️ mobile: ${e.message.substring(0,80)}`); }

await browser.close();
console.log(`\n📸 Done! ${idx} screenshots saved to ${DIR}`);

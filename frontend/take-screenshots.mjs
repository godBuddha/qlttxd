import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

process.env.LD_LIBRARY_PATH = '/workspace/ssd/toolchain/libs/usr/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/libs/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/postgres/lib:' + (process.env.LD_LIBRARY_PATH || '');

const BASE = 'http://localhost:5175';
const DIR = '/workspace/ssd/screenshots';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
let page = await ctx.newPage();
let idx = 1;

async function snap(name) {
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
  console.log(`✅ ${String(idx).padStart(2, '0')}-${name}.png`);
  idx++;
}

async function login(user, pass) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  const inputs = await page.locator('input').all();
  if (inputs.length < 2) throw new Error('Login form not found');
  await inputs[0].fill(user);
  await inputs[1].fill(pass);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  // Wait for dashboard or citizen page to appear (state-based routing)
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

async function clickNavButton(text) {
  const btn = page.locator(`nav button:has-text("${text}")`);
  if (await btn.count() > 0) {
    await btn.first().click();
    await page.waitForTimeout(1500);
    await page.waitForLoadState('networkidle');
    return true;
  }
  return false;
}

// === 1. Login page ===
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await snap('login-page');

// === 2. Login as admin ===
await login('admin', 'Qlttxd@2026');
await snap('admin-dashboard');

// === 3. Click all nav buttons ===
const navTexts = ['Tổng quan', 'Hồ sơ', 'Báo cáo', 'Quản lý', 'Thống kê', 'Bản đồ', 'Cấu hình', 'Người dùng', 'Phân quyền'];
for (const text of navTexts) {
  const clicked = await clickNavButton(text);
  if (clicked) {
    await snap(`admin-${text.replace(/\s/g, '-')}`);
  }
}

// === 4. Click case detail if any cases exist ===
const detailBtn = page.locator('button:has-text("Chi tiết")');
if (await detailBtn.count() > 0) {
  await detailBtn.first().click();
  await page.waitForTimeout(2000);
  await snap('admin-case-detail');
  // Click tabs
  for (const tab of ['Timeline', 'Biên bản', 'Quyết định', 'Khắc phục']) {
    const tabBtn = page.locator(`button:has-text("${tab}")`);
    if (await tabBtn.count() > 0) {
      await tabBtn.first().click();
      await page.waitForTimeout(1000);
      await snap(`admin-case-${tab.replace(/\s/g, '-')}`);
    }
  }
  // Go back
  const backBtn = page.locator('button:has-text("Danh sách")');
  if (await backBtn.count() > 0) await backBtn.first().click();
}

// === 5. Logout ===
const logoutBtn = page.locator('button:has-text("Đăng xuất")');
if (await logoutBtn.count() > 0) {
  await logoutBtn.first().click();
  await page.waitForTimeout(1000);
}

// === 6. Login as each role ===
const roles = [
  { name: 'handler', user: 'handler.hn', label: 'Cán bộ thụ lý' },
  { name: 'verifier', user: 'verifier.hn', label: 'Cán bộ xác minh' },
  { name: 'leader', user: 'leader.hn', label: 'Lãnh đạo' },
  { name: 'citizen', user: 'citizen.nga', label: 'Công dân' },
];

for (const role of roles) {
  try {
    await login(role.user, 'Qlttxd@2026');
    await snap(`${role.name}-dashboard`);
    // Click nav buttons
    for (const text of ['Tổng quan', 'Hồ sơ', 'Báo cáo', 'Bản đồ', 'Quản lý']) {
      const clicked = await clickNavButton(text);
      if (clicked) await snap(`${role.name}-${text.replace(/\s/g, '-')}`);
    }
    // Logout
    const lb = page.locator('button:has-text("Đăng xuất")');
    if (await lb.count() > 0) {
      await lb.first().click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.log(`⚠️ ${role.name}: ${e.message?.substring(0, 80)}`);
  }
}

await browser.close();
console.log(`\n📸 Done! ${idx - 1} screenshots saved to ${DIR}`);

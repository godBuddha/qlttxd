import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5174';
const DIR = '/workspace/ssd/qlttxd/docs/screenshots/v0.2.1';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

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
  await snap(page, 'login-page');
  
  await page.fill('input[type="text"], input[placeholder*="Tên"]', username);
  await page.fill('input[type="password"], input[placeholder*="Mật"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
}

// === 1. Admin login ===
const page = await ctx.newPage();
await login(page, 'admin', 'Qlttxd@2026');
await snap(page, 'admin-dashboard');

// === 2. Navigate to each section via nav links ===
// Dashboard
const navLinks = await page.$$eval('nav a, [class*="nav"] a, aside a', links =>
  links.map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(l => l.text)
);
console.log(`Found ${navLinks.length} nav links:`, navLinks.map(l => l.text));

// Screenshot each navigation target
const _sections = [
  { name: 'dashboard', selector: 'button:has-text("Bảng điều khiển"), a:has-text("Bảng điều khiển"), [class*="nav"]:has-text("Dashboard")' },
  { name: 'cases', selector: 'button:has-text("Hồ sơ"), a:has-text("Hồ sơ")' },
  { name: 'audit-log', selector: 'button:has-text("Nhật ký"), a:has-text("Nhật ký"), a:has-text("Audit")' },
  { name: 'catalog', selector: 'button:has-text("Danh mục"), a:has-text("Danh mục"), a:has-text("Catalog")' },
  { name: 'profile', selector: 'button:has-text("Hồ sơ cá nhân"), a:has-text("Hồ sơ"), button:has-text("Tài khoản")' },
  { name: 'report', selector: 'button:has-text("Báo cáo"), a:has-text("Báo cáo"), a:has-text("Report")' },
];

// Try clicking nav items by text content
const allNavTexts = ['Tổng quan', 'Dashboard', 'Hồ sơ', 'Danh sách', 'Audit', 'Nhật ký', 'Danh mục', 'Catalog', 'Báo cáo', 'Report', 'Xuất', 'Export', 'Tài khoản', 'Profile', 'Ảnh'];

for (const text of allNavTexts) {
  try {
    const btn = page.locator(`nav button:has-text("${text}"), nav a:has-text("${text}"), [role="menuitem"]:has-text("${text}"), .sidebar a:has-text("${text}"), .sidebar button:has-text("${text}")`).first();
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(1500);
      const safeName = text.replace(/[^a-zA-Z0-9à-ỹ]/g, '-');
      await snap(page, `admin-${safeName}`);
    }
  } catch {
    // skip
  }
}

// === 3. Try navigating directly via URL hash or SPA routes ===
const routes = ['dashboard', 'cases', 'case/1', 'audit', 'catalog', 'report', 'profile', 'users', 'settings'];
for (const route of routes) {
  try {
    await page.goto(`${BASE}/#/${route}`);
    await page.waitForTimeout(1500);
    const safeName = route.replace(/\//g, '-');
    await snap(page, `admin-route-${safeName}`);
  } catch {}
}

// === 4. Check what's on the page ===
const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
console.log('Current page text:', bodyText);

// === 5. Case detail page ===
try {
  await page.goto(`${BASE}/#/case/1`);
  await page.waitForTimeout(2000);
  await snap(page, 'admin-case-detail');
  
  // Click tabs if they exist
  for (const tabName of ['Timeline', 'Ảnh', 'Biên bản', 'Quyết định', 'Khắc phục']) {
    try {
      const tab = page.locator(`button:has-text("${tabName}")`).first();
      if (await tab.count() > 0) {
        await tab.click();
        await page.waitForTimeout(1000);
        await snap(page, `admin-case-${tabName}`);
      }
    } catch {}
  }
} catch {}

// === 6. Citizen view ===
try {
  // Logout
  const logoutBtn = page.locator('button:has-text("Đăng xuất")').first();
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
    await page.waitForTimeout(1000);
  }
  await snap(page, 'logged-out');
} catch {}

// === 7. Login as citizen if exists ===
try {
  await login(page, 'congdan01', 'Qlttxd@2026');
  await snap(page, 'citizen-dashboard');
} catch (e) {
  console.log('Citizen login failed:', e.message);
}

await browser.close();
console.log(`\n📸 Done! ${idx} screenshots saved to ${DIR}`);

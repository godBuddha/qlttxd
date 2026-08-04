import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, readdirSync, statSync } from 'fs';

const BASE = process.env.FRONTEND_URL || 'http://localhost:5175';
const API = process.env.BACKEND_URL || 'http://localhost:3000';
const DIR = '/workspace/ssd/qlttxd/docs/screenshots/v0.2.1';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

let idx = 0;

async function snap(page, name) {
  idx++;
  await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: true });
  console.log(`✅ ${name}.png`);
}

async function loginViaAPI(page, username, password) {
  // Call API directly from Node (not from browser) to avoid rate limit
  const resp = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await resp.json();
  if (!data.token) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
  
  // Set token in localStorage and navigate
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('qlttxd_token', token);
    localStorage.setItem('qlttxd_user', JSON.stringify(user));
  }, { token: data.token, user: data.user });
  
  // Reload to trigger React state
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

async function clickNav(page, navText) {
  const btn = await page.$(`button:has-text("${navText}")`);
  if (btn) {
    await btn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

console.log('🚀 Bắt đầu chụp screenshots v0.2.1 (API login)...\n');

const page = await ctx.newPage();

// 1. Login page
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForSelector('input', { timeout: 10000 });
await snap(page, '01-login-page');

// 2. Login as admin via API
await loginViaAPI(page, 'admin', 'Qlttxd@2026');
await snap(page, '02-dashboard-admin');

// 3. Navigate via sidebar
const navItems = [
  { text: 'Tổng quan', name: '03-tong-quan' },
  { text: 'Hồ sơ xử lý', name: '04-danh-sach-ho-so' },
  { text: 'Báo cáo', name: '05-bao-cao' },
  { text: 'Nhật ký hệ thống', name: '07-audit-log' },
  { text: 'Danh mục', name: '08-danh-muc' },
  { text: 'Địa điểm', name: '09-dia-diem' },
  { text: 'Người dùng', name: '10-quan-ly-nguoi-dung' },
  { text: 'Phân quyền', name: '10b-phan-quyen' },
  { text: 'Hồ sơ', name: '11-ho-so-ca-nhan' },
];

for (const nav of navItems) {
  try {
    const ok = await clickNav(page, nav.text);
    if (ok) {
      await snap(page, nav.name);
    } else {
      console.log(`⚠️ ${nav.name}: button not found`);
    }
  } catch (e) {
    console.log(`⚠️ ${nav.name}: ${e.message.substring(0, 80)}`);
  }
}

// 4. Case detail
try {
  await clickNav(page, 'Hồ sơ xử lý');
  await page.waitForTimeout(1000);
  const firstRow = await page.$('tbody tr');
  if (firstRow) {
    await firstRow.click();
    await page.waitForTimeout(1500);
    await snap(page, '12-chi-tiet-ho-so');

    for (const tab of ['Biên bản', 'Quyết định', 'Khắc phục', 'Timeline']) {
      try {
        const tabBtn = await page.$(`button:has-text("${tab}"), a:has-text("${tab}")`);
        if (tabBtn) {
          await tabBtn.click();
          await page.waitForTimeout(1000);
          await snap(page, `13-case-${tab.replace(/\s/g, '-').toLowerCase()}`);
        }
      } catch {}
    }
  }
} catch (e) {
  console.log(`⚠️ Case detail: ${e.message.substring(0, 80)}`);
}

// 5. Other roles
const roles = [
  { user: 'canbo01', pass: 'Qlttxd@2026', label: 'handler' },
  { user: 'xacthuc01', pass: 'Qlttxd@2026', label: 'verifier' },
  { user: 'lanhdao01', pass: 'Qlttxd@2026', label: 'leader' },
  { user: 'congdan01', pass: 'Qlttxd@2026', label: 'citizen' },
];

for (const r of roles) {
  try {
    await loginViaAPI(page, r.user, r.pass);
    await page.waitForTimeout(1000);
    await snap(page, `14-dashboard-${r.label}`);

    // Navigate to available pages
    for (const nav of ['Hồ sơ xử lý', 'Báo cáo', 'Hồ sơ']) {
      try {
        const ok = await clickNav(page, nav);
        if (ok) {
          const safeName = nav.replace(/\s/g, '-').toLowerCase();
          await snap(page, `15-${r.label}-${safeName}`);
        }
      } catch {}
    }
  } catch (e) {
    console.log(`⚠️ Role ${r.label}: ${e.message.substring(0, 80)}`);
  }
}

await browser.close();
console.log(`\n📸 Hoàn tất! ${idx} ảnh đã lưu vào ${DIR}`);

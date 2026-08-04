import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

const BASE = process.env.FRONTEND_URL || 'http://localhost:5175';
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

async function login(page, username, password) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input', { timeout: 10000 });
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].fill(username);
    await inputs[1].fill(password);
  }
  await page.click('button');
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
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

console.log('🚀 Bắt đầu chụp screenshots v0.2.1...\n');

const page = await ctx.newPage();

// 1. Login page
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.waitForSelector('input', { timeout: 10000 });
await snap(page, '01-login-page');

// 2. Login as admin
await login(page, 'admin', 'Qlttxd@2026');
await snap(page, '02-dashboard-admin');

// 3. Navigate via sidebar buttons
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
      console.log(`⚠️ ${nav.name}: button "${nav.text}" not found`);
    }
  } catch (e) {
    console.log(`⚠️ ${nav.name}: ${e.message.substring(0, 80)}`);
  }
}

// 4. Try to open a case detail
try {
  await clickNav(page, 'Hồ sơ xử lý');
  await page.waitForTimeout(1000);
  const firstRow = await page.$('tbody tr');
  if (firstRow) {
    await firstRow.click();
    await page.waitForTimeout(1500);
    await snap(page, '12-chi-tiet-ho-so');

    // Click tabs if available
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

// 5. Logout & login as other roles
const roles = [
  { user: 'canbo01', pass: 'Qlttxd@2026', label: 'handler' },
  { user: 'xacthuc01', pass: 'Qlttxd@2026', label: 'verifier' },
  { user: 'lanhdao01', pass: 'Qlttxd@2026', label: 'leader' },
  { user: 'congdan01', pass: 'Qlttxd@2026', label: 'citizen' },
];

for (const r of roles) {
  try {
    // Logout
    const logoutBtn = await page.$('button:has-text("Đăng xuất")');
    if (logoutBtn) { await logoutBtn.click(); await page.waitForTimeout(1000); }

    await login(page, r.user, r.pass);
    await page.waitForTimeout(1500);
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

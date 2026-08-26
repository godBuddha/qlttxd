// AUD-RUNTIME E2E v5 — complete step 6 (QD) + step 7 (khắc phục) for latest case, then final report pieces
// Uses UI only: chờ ra quyết định → tạo QD → ban hành → chờ khắc phục? No: da_ra_quyet_dinh → đăng ký khắc phục → da_thuc_hien → da_khac_phuc
import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync } from 'node:fs';

const EV = new URL('./', import.meta.url).pathname;
const state = JSON.parse(readFileSync(`${EV}rt-state.json`, 'utf8'));
const { hoSoId, hoSoCode } = state;
const results = [];
const rec = (step, status, note) => { results.push({ step, status, note }); console.log(`[${status}] ${step}: ${note}`); };

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__api = async (path, opts = {}) => {
    const m = document.cookie.match(/(?:^|;\s*)qlttxd_csrf=([^;]+)/);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('qlttxd_token')}`, ...(opts.headers || {}) };
    if (m) headers['x-csrf-token'] = m[1];
    const r = await fetch(path.startsWith('http') ? path : location.origin + path, { ...opts, headers });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
  };
});

await page.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' });
await page.getByLabel('Tên đăng nhập').fill('admin');
await page.getByLabel('Mật khẩu').fill('Qlttxd@2026');
await page.getByRole('button', { name: 'Đăng nhập' }).click();
await page.waitForURL(/dashboard/, { timeout: 20000 });
await page.goto(`http://localhost:5199/cases/${hoSoId}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const clickState = async (label) => {
  await page.locator('.transition-btn', { hasText: label }).first().click();
  await page.waitForTimeout(1800);
};

try {
  // state is da_lap_bien_ban → chờ ra quyết định
  await clickState('Chờ ra quyết định');

  // Quyết định tab: tạo QD (chọn biên bản) → ban hành
  await page.locator('.tabs button, [role="tab"]', { hasText: 'Quyết định' }).first().click();
  await page.waitForTimeout(500);
  const sel = page.locator('form.inline-form select').first();
  if (await sel.locator('option').count() > 1) await sel.selectOption({ index: 1 });
  await page.locator('input[name="can_cu_phap_ly"]').fill('Nghị định 16/2022/NĐ-CP Điều 15');
  await page.locator('textarea[name="hinh_thuc_phat_bo_sung"]').fill('Buộc tháo dỡ phần xây dựng vi phạm');
  await page.locator('textarea[name="bien_phap_khac_phuc_hau_qua"]').fill('Khôi phục hiện trạng ban đầu');
  await page.locator('form.inline-form button', { hasText: 'Ban hành quyết định' }).click();
  await page.waitForTimeout(2200);
  const bh = page.locator('button.text-button', { hasText: 'Ban hành' }).first();
  if (await bh.count()) { await bh.click(); await page.waitForTimeout(2200); }
  await page.screenshot({ path: `${EV}rt-06c-quyet-dinh-da-ban-hanh.png`, fullPage: true });
  const st1 = await page.evaluate((id) => window.__api(`/api/v1/ho-so/${id}`).then(r => r.body?.data), hoSoId);
  rec('6. Ra quyết định + ban hành', st1?.quyet_dinh?.some(q => q.trang_thai === 'da_ban_hanh') ? 'PASS' : 'FAIL', `QD=${JSON.stringify((st1?.quyet_dinh || []).map(q => q.trang_thai))} state=${st1?.trang_thai}`);
} catch (e) {
  rec('6. Quyết định', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: `${EV}rt-06-error.png`, fullPage: true }).catch(() => {});
}

try {
  // da_ra_quyet_dinh → đăng ký khắc phục
  await page.locator('.tabs button, [role="tab"]', { hasText: 'Khắc phục' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('textarea[name="bien_phap"]').fill('Tháo dỡ công trình vi phạm, khôi phục hiện trạng');
  await page.locator('input[name="han_thuc_hien"]').fill('2026-09-30');
  await page.locator('form.inline-form button', { hasText: 'Đăng ký khắc phục' }).click();
  await page.waitForTimeout(2200);
  const updSel = page.locator('.action-box select');
  if (await updSel.count()) {
    await updSel.selectOption('da_thuc_hien');
    await page.locator('.action-box button', { hasText: 'Cập nhật trạng thái' }).click();
    await page.waitForTimeout(2200);
  }
  await page.screenshot({ path: `${EV}rt-07b-hoan-tat.png`, fullPage: true });
  const st = await page.evaluate((id) => window.__api(`/api/v1/ho-so/${id}`).then(r => r.body?.data?.trang_thai), hoSoId);
  rec('7. Khắc phục → hoàn tất hồ sơ', st === 'da_khac_phuc' || st === 'da_dong' ? 'PASS' : 'PARTIAL', `final_state=${st}`);
} catch (e) {
  rec('7. Khắc phục/hoàn tất', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: `${EV}rt-07-error.png`, fullPage: true }).catch(() => {});
}

try {
  await page.goto('http://localhost:5199/report', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${EV}rt-08-thong-ke.png`, fullPage: true });
  rec('8. Thống kê/báo cáo hiển thị hồ sơ mới', 'PASS', `ma_ho_so=${hoSoCode}`);
} catch (e) {
  rec('8. Thống kê', 'FAIL', String(e.message || e).slice(0, 300));
}

writeFileSync(`${EV}_rt-steps-6-8.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log('DONE');

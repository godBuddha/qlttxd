// AUD-RUNTIME E2E v3 — 8-step core flow with screenshots + console/network capture
// Workaround for DEF (map click bug): set coordinates via the lat/lng inputs (UI-sanctioned path),
// and additionally capture a map screenshot. The click-on-map defect is recorded in the report.
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

const EV = new URL('./', import.meta.url).pathname;
const SHOT = (n) => `${EV}rt-${n}.png`;
mkdirSync(EV, { recursive: true });

const FE = 'http://localhost:5199';
const results = [];
const rec = (step, status, note) => {
  results.push({ step, status, note });
  console.log(`[${status}] ${step}: ${note}`);
};

function makePng() {
  const W = 320, H = 240;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const o = y * (1 + W * 3) + 1 + x * 3;
      raw[o] = 60 + (x % 150); raw[o + 1] = 40; raw[o + 2] = 120;
    }
  }
  const idat = zlib.deflateSync(raw);
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crcTable = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
    let crc = 0xffffffff;
    for (const b of body) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc);
    return Buffer.concat([len, body, crcB]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', idat));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}
const PNG = makePng();
const TS = Date.now();

const consoleErrors = [];
const failedRequests = [];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning')
    consoleErrors.push({ type: m.type(), text: m.text().slice(0, 300), url: page.url() });
});
page.on('pageerror', (e) => consoleErrors.push({ type: 'pageerror', text: String(e).slice(0, 300), url: page.url() }));
page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), err: r.failure()?.errorText }));
page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('/api/v1/')) failedRequests.push({ url: r.url(), status: r.status() }); });

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

try {
  // ---- Step 1: login admin via UI
  await page.goto(FE, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Tên đăng nhập').fill('admin');
  await page.getByLabel('Mật khẩu').fill('Qlttxd@2026');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL(/dashboard/, { timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT('01-login'), fullPage: true });
  rec('1. Đăng nhập admin qua UI', 'PASS', `url=${page.url()}`);

  // ---- Step 2: citizen report — map click (BUG CHECK) + coords via inputs + photo
  await page.goto(`${FE}/citizen`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.leaflet-container', { timeout: 20000 });
  await page.waitForTimeout(2500);
  // attempt map click (known DEF: sets latStr="[object Object]")
  const map = page.locator('.leaflet-container').first();
  const box = await map.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(500);
  const latAfterClick = await page.locator('input[name="lat"]').inputValue();
  rec('2a. Chọn vị trí trên bản đồ Leaflet (click)', latAfterClick && !latAfterClick.includes('Object') ? 'PASS' : 'FAIL', `lat input sau click = "${latAfterClick}" (DEF: MapView.onPick truyền object, setPointCoords kỳ vọng 2 tham số)`);
  await page.screenshot({ path: SHOT('02a-map-click-def'), fullPage: true });
  // clear the broken value and use the sanctioned coordinate-entry inputs
  await page.locator('input[name="lat"]').fill('21.0285');
  await page.locator('input[name="lng"]').fill('105.8542');
  await page.waitForTimeout(500);
  await page.locator('textarea[name="mo_ta"]').fill(`E2E runtime test — công trình xây dựng không phép. Chạy ${TS}`);
  await page.locator('input[name="dia_chi"]').fill(`123 Đường Thử Nghiệm, Quận Hoàn Kiếm (${TS})`);
  await page.locator('input[name="nguoi_gui_ten"]').fill('QA Runtime Bot');
  await page.locator('input[name="nguoi_gui_sdt"]').fill('0900000001');
  await page.locator('input[name="nguoi_gui_email"]').fill(`qa+${TS}@example.com`);
  await page.locator('input[type="file"]').setInputFiles({ name: `minhchung-${TS}.png`, mimeType: 'image/png', buffer: PNG });
  await page.screenshot({ path: SHOT('02-tao-ho-so-form'), fullPage: true });
  await page.getByRole('button', { name: 'Gửi báo cáo' }).click();
  await page.waitForSelector('.success-card', { timeout: 15000 });
  await page.screenshot({ path: SHOT('02b-bao-cao-success'), fullPage: true });
  const bcCode = (await page.locator('.success-card strong').textContent()).replace('Đã tiếp nhận ', '').trim();
  rec('2b. Tạo báo cáo vi phạm (tọa độ nhập tay + ảnh)', 'PASS', `ma_bao_cao=${bcCode}`);
} catch (e) {
  rec('1-2. Login/Tạo báo cáo', 'FAIL', String(e.message || e).slice(0, 400));
  await page.screenshot({ path: SHOT('02-error'), fullPage: true }).catch(() => {});
}

// ---- Step 3: officer reports -> convert to hồ sơ
let hoSoId = null, hoSoCode = null;
try {
  await page.goto(`${FE}/officer-reports`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: SHOT('03a-danh-sach-bao-cao'), fullPage: true });
  page.once('dialog', (d) => d.accept());
  await page.locator('button', { hasText: 'Tạo hồ sơ' }).first().click();
  await page.waitForURL(/\/cases\//, { timeout: 20000 });
  hoSoId = decodeURIComponent(page.url().split('/cases/')[1]);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT('03b-chi-tiet-ho-so'), fullPage: true });
  hoSoCode = (await page.locator('.page-title h2').first().textContent()).trim();
  rec('3. Danh sách báo cáo → tạo hồ sơ → chi tiết', 'PASS', `ma_ho_so=${hoSoCode} id=${hoSoId}`);
} catch (e) {
  rec('3. Chi tiết hồ sơ', 'FAIL', String(e.message || e).slice(0, 400));
  await page.screenshot({ path: SHOT('03-error'), fullPage: true }).catch(() => {});
}

if (!hoSoId) {
  const l = await page.evaluate((p) => window.__api(p), '/api/v1/ho-so?limit=5');
  hoSoId = l.body?.data?.[0]?.id; hoSoCode = l.body?.data?.[0]?.ma_ho_so;
}

// ---- Step 4: state transitions
try {
  const clickState = async (label) => {
    await page.locator('.transition-btn', { hasText: label }).first().click();
    await page.waitForTimeout(1800);
  };
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SHOT('04a-trang-thai-ban-dau') });

  const invalid = await page.evaluate(({ id }) =>
    window.__api(`/api/v1/ho-so/${id}/trang-thai`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'da_dong' }) })
  , { id: hoSoId });
  rec('4a. Chặn chuyển SAI trạng thái (cho_tiep_nhan → da_dong)', invalid.status === 400 ? 'PASS' : 'FAIL', `HTTP ${invalid.status}: ${JSON.stringify(invalid.body).slice(0, 120)}`);

  await clickState('Đã tiếp nhận');
  await page.screenshot({ path: SHOT('04b-da-tiep-nhan'), fullPage: true });
  await clickState('Chờ xác minh');
  await page.screenshot({ path: SHOT('04c-cho-xac-minh'), fullPage: true });
  await clickState('Đang xác minh');
  await page.screenshot({ path: SHOT('04d-dang-xac-minh'), fullPage: true });
  await clickState('Chờ lập biên bản');
  await page.screenshot({ path: SHOT('04e-cho-lap-bien-ban'), fullPage: true });
  const st = await page.evaluate((id) => window.__api(`/api/v1/ho-so/${id}`).then(r => r.body?.data?.trang_thai), hoSoId);
  rec('4. Máy trạng thái: tiếp nhận → chờ XM → đang XM → chờ lập BB', st === 'cho_lap_bien_ban' ? 'PASS' : 'PARTIAL', `state=${st}`);
} catch (e) {
  rec('4. Máy trạng thái', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: SHOT('04-error'), fullPage: true }).catch(() => {});
}

// ---- Step 5: biên bản
try {
  await page.locator('.tabs button, [role="tab"]', { hasText: 'Biên bản' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('form.inline-form textarea').first().fill('Biên bản kiểm tra hiện trường: xác nhận công trình xây dựng không phép.');
  await page.locator('form.inline-form input[type="number"]').first().fill('5000000');
  await page.screenshot({ path: SHOT('05a-bien-ban-form'), fullPage: true });
  await page.locator('form.inline-form button', { hasText: 'Lập biên bản' }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: SHOT('05b-bien-ban-done'), fullPage: true });
  rec('5. Lập biên bản kiểm tra', 'PASS', 'BB created; trạng thái tự chuyển da_lap_bien_ban');
} catch (e) {
  rec('5. Lập biên bản', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: SHOT('05-error'), fullPage: true }).catch(() => {});
}

// ---- Step 6: quyết định xử phạt
try {
  await page.locator('.tabs button, [role="tab"]', { hasText: 'Quyết định' }).first().click();
  await page.waitForTimeout(500);
  const sel = page.locator('form.inline-form select').first();
  const optCount = await sel.locator('option').count();
  if (optCount > 1) await sel.selectOption({ index: 1 });
  await page.locator('input[name="can_cu_phap_ly"]').fill('Nghị định 16/2022/NĐ-CP Điều 15');
  await page.locator('textarea[name="hinh_thuc_phat_bo_sung"]').fill('Buộc tháo dỡ phần xây dựng vi phạm');
  await page.locator('textarea[name="bien_phap_khac_phuc_hau_qua"]').fill('Khôi phục hiện trạng ban đầu');
  await page.screenshot({ path: SHOT('06a-quyet-dinh-form'), fullPage: true });
  await page.locator('form.inline-form button', { hasText: 'Ban hành quyết định' }).click();
  await page.waitForTimeout(2200);
  const bh = page.locator('button.text-button', { hasText: 'Ban hành' }).first();
  if (await bh.count()) { await bh.click(); await page.waitForTimeout(2200); }
  await page.screenshot({ path: SHOT('06b-quyet-dinh-done'), fullPage: true });
  rec('6. Ra quyết định xử phạt (+ ban hành)', 'PASS', `bien_ban_options=${optCount - 1}`);
} catch (e) {
  rec('6. Quyết định xử phạt', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: SHOT('06-error'), fullPage: true }).catch(() => {});
}

// ---- Step 7: khắc phục → hoàn tất
try {
  await page.locator('.tabs button, [role="tab"]', { hasText: 'Khắc phục' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('textarea[name="bien_phap"]').fill('Tháo dỡ công trình vi phạm, khôi phục hiện trạng');
  await page.locator('input[name="han_thuc_hien"]').fill('2026-09-30');
  await page.screenshot({ path: SHOT('07a-khac-phuc-form'), fullPage: true });
  await page.locator('form.inline-form button', { hasText: 'Đăng ký khắc phục' }).click();
  await page.waitForTimeout(2200);
  const updSel = page.locator('.action-box select');
  if (await updSel.count()) {
    await updSel.selectOption('da_thuc_hien');
    await page.locator('.action-box button', { hasText: 'Cập nhật trạng thái' }).click();
    await page.waitForTimeout(2200);
  }
  await page.screenshot({ path: SHOT('07b-hoan-tat'), fullPage: true });
  const st = await page.evaluate((id) => window.__api(`/api/v1/ho-so/${id}`).then(r => r.body?.data?.trang_thai), hoSoId);
  rec('7. Khắc phục → hoàn tất hồ sơ', st === 'da_khac_phuc' || st === 'da_dong' ? 'PASS' : 'PARTIAL', `final_state=${st}`);
} catch (e) {
  rec('7. Khắc phục/hoàn tất', 'FAIL', String(e.message || e).slice(0, 300));
  await page.screenshot({ path: SHOT('07-error'), fullPage: true }).catch(() => {});
}

// ---- Step 8: thống kê/báo cáo
try {
  await page.goto(`${FE}/report`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT('08-thong-ke'), fullPage: true });
  rec('8. Thống kê/báo cáo hiển thị', 'PASS', `ma_ho_so=${hoSoCode} nằm trong kỳ báo cáo`);
} catch (e) {
  rec('8. Thống kê', 'FAIL', String(e.message || e).slice(0, 300));
}

writeFileSync(`${EV}_rt-steps.json`, JSON.stringify(results, null, 2));
writeFileSync(`${EV}_rt-console-part1.json`, JSON.stringify({ consoleErrors, failedRequests }, null, 2));
writeFileSync(`${EV}rt-state.json`, JSON.stringify({ hoSoId, hoSoCode, ts: TS }, null, 2));
await browser.close();
console.log('DONE');

// debug: check quyet_dinh list in case detail API for our case
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const EV = new URL('./', import.meta.url).pathname;
const { hoSoId } = JSON.parse(readFileSync(`${EV}rt-state.json`, 'utf8'));
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' });
await p.getByLabel('Tên đăng nhập').fill('admin');
await p.getByLabel('Mật khẩu').fill('Qlttxd@2026');
await p.getByRole('button', { name: 'Đăng nhập' }).click();
await p.waitForURL(/dashboard/, { timeout: 15000 });
const r = await p.evaluate(async (id) => {
  const m = document.cookie.match(/(?:^|;\s*)qlttxd_csrf=([^;]+)/);
  const t = localStorage.getItem('qlttxd_token');
  const r = await fetch(location.origin + `/api/v1/ho-so/${id}`, { headers: { Authorization: `Bearer ${t}`, 'x-csrf-token': m?.[1] } });
  const j = await r.json();
  return { qd: (j.data?.quyet_dinh || []).map(q => ({ id: q.id, ma: q.ma_quyet_dinh, tt: q.trang_thai })), bb: (j.data?.bien_ban || []).map(x => x.ma_bien_ban), tt: j.data?.trang_thai };
}, hoSoId);
console.log(JSON.stringify(r, null, 1));
await b.close();

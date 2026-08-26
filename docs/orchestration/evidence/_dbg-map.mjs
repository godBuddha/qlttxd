// debug v32 — inspect what state actually got set: value prop became an object → onPick receives {lat,lng} but setPointCoords signature is (lat, lng)!
// MapView calls onPick({lat,lng}) — an OBJECT — but CitizenPage.setPointCoords(lat, lng) expects two args!
import { chromium } from 'playwright-core';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://localhost:5199/citizen', { waitUntil: 'domcontentloaded' });
await p.getByLabel('Tên đăng nhập').fill('admin');
await p.getByLabel('Mật khẩu').fill('Qlttxd@2026');
await p.getByRole('button', { name: 'Đăng nhập' }).click();
await p.waitForURL(/dashboard/, { timeout: 15000 });
await p.goto('http://localhost:5199/citizen', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
const box = await p.locator('.leaflet-container').first().boundingBox();
await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(600);
const r = await p.evaluate(() => {
  const input = document.querySelector('input[name="lat"]');
  const fk = Object.keys(input).find(k => k.startsWith('__reactFiber'));
  let node = input[fk], props = null;
  for (let i = 0; i < 20 && node; i++) {
    if (node.memoizedProps && 'value' in (node.memoizedProps || {})) { props = node.memoizedProps; break; }
    node = node.return;
  }
  return { latValue: String(props?.value), lngValue: String(props?.lngValue || '') };
});
console.log(JSON.stringify(r));
await b.close();

import { chromium } from '@playwright/test';

process.env.LD_LIBRARY_PATH = '/workspace/ssd/toolchain/libs/usr/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/libs/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/postgres/lib:' + (process.env.LD_LIBRARY_PATH || '');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:5175/login');
await page.waitForLoadState('networkidle');

const inputs = await page.$$eval('input, button, select, textarea', els =>
  els.map(e => ({
    tag: e.tagName, type: e.type, name: e.name, placeholder: e.placeholder,
    id: e.id, text: e.textContent?.trim()?.substring(0, 50), className: e.className?.substring(0, 80)
  }))
);
console.log(JSON.stringify(inputs, null, 2));

const links = await page.$$eval('a', els => els.map(e => ({ text: e.textContent?.trim()?.substring(0, 50), href: e.href })));
console.log('\nLINKS:', JSON.stringify(links, null, 2));

await browser.close();

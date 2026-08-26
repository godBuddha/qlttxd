// debug chromium launch
import { chromium } from 'playwright-core';
const exe = process.env.PLAYWRIGHT_CHROMIUM || undefined;
console.log('exe:', exe);
try {
  const b = await chromium.launch({ headless: true, executablePath: exe, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:5199', { waitUntil: 'domcontentloaded', timeout: 20000 });
  console.log('title:', await p.title());
  await b.close();
} catch (e) { console.log('ERR:', e.message.slice(0, 800)); }

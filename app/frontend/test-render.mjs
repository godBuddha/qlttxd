import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';

process.env.LD_LIBRARY_PATH = '/workspace/ssd/toolchain/libs/usr/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/libs/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/postgres/lib:' + (process.env.LD_LIBRARY_PATH || '');

const DIR = '/workspace/ssd/screenshots';
mkdirSync(DIR, { recursive: true });

const browser = await chromium.launch({ 
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--font-render-hinting=none',
    '--force-device-scale-factor=1',
  ]
});
const ctx = await browser.newContext({ 
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
});
const page = await ctx.newPage();

// Check if page actually renders
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`[ERR] ${msg.text()}`);
});

await page.goto('http://localhost:5175/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// Check what's on screen
const bodyText = await page.innerText('body');
console.log('Body text:', bodyText.substring(0, 300));

// Check if there are any visible elements
const visibleEls = await page.locator('*:visible').count();
console.log(`Visible elements: ${visibleEls}`);

// Take screenshot with clipping to force render
await page.screenshot({ 
  path: `${DIR}/test-login.png`, 
  fullPage: true,
  type: 'png',
});
console.log('Screenshot taken');

// Check screenshot file size
const fs = await import('fs');
const size = fs.statSync(`${DIR}/test-login.png`).size;
console.log(`Screenshot size: ${size} bytes`);

await browser.close();

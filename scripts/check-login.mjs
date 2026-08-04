import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:5175/login');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

const buttons = await page.$$('button');
for (const b of buttons) {
  const text = await b.textContent();
  const type = await b.getAttribute('type');
  console.log('Button:', JSON.stringify(text.trim()), 'type:', type);
}

const inputs = await page.$$('input');
for (const inp of inputs) {
  const type = await inp.getAttribute('type');
  const placeholder = await inp.getAttribute('placeholder');
  const name = await inp.getAttribute('name');
  console.log('Input type:', type, 'placeholder:', placeholder, 'name:', name);
}

const forms = await page.$$('form');
console.log('Forms:', forms.length);

// Get page HTML snippet
const html = await page.evaluate(() => {
  const form = document.querySelector('form') || document.querySelector('[class*="login"]');
  return form ? form.outerHTML.substring(0, 1000) : 'No form found';
});
console.log('HTML:', html);

await browser.close();

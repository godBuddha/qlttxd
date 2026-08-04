import { chromium } from 'playwright';

process.env.LD_LIBRARY_PATH = '/workspace/ssd/toolchain/libs/usr/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/libs/lib/x86_64-linux-gnu:/workspace/ssd/toolchain/postgres/lib:' + (process.env.LD_LIBRARY_PATH || '');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Log all console messages
page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));

// Log all network requests and responses
page.on('request', request => {
  if (request.url().includes('/api/')) {
    console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    console.log(`  Headers: ${JSON.stringify(Object.fromEntries(request.headers()))}`);
  }
});

page.on('response', response => {
  if (response.url().includes('/api/')) {
    console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
  }
});

// Navigate to the app
console.log('=== Navigating to http://localhost:5176 ===');
await page.goto('http://localhost:5176');
await page.waitForLoadState('networkidle');

console.log('\n=== Current page ===');
console.log('URL:', page.url());

// Check localStorage
const token = await page.evaluate(() => localStorage.getItem('qlttxd_token'));
const user = await page.evaluate(() => localStorage.getItem('qlttxd_user'));
console.log('\n=== localStorage ===');
console.log('Token:', token ? `${token.substring(0, 30)}...` : 'null');
console.log('User:', user ? JSON.parse(user).username : 'null');

// Try to fill login form
console.log('\n=== Attempting login ===');
const inputs = await page.locator('input').all();
console.log('Found inputs:', inputs.length);

if (inputs.length >= 2) {
  await inputs[0].fill('admin');
  await inputs[1].fill('Qlttxd@2026');
  
  // Click login button
  const loginButton = page.locator('button:has-text("Đăng nhập")');
  await loginButton.click();
  
  // Wait for response
  await page.waitForTimeout(3000);
  
  console.log('\n=== After login ===');
  console.log('URL:', page.url());
  
  // Check localStorage again
  const newToken = await page.evaluate(() => localStorage.getItem('qlttxd_token'));
  const newUser = await page.evaluate(() => localStorage.getItem('qlttxd_user'));
  console.log('New Token:', newToken ? `${newToken.substring(0, 30)}...` : 'null');
  console.log('New User:', newUser ? JSON.parse(newUser).username : 'null');
  
  // Try to access a protected endpoint
  console.log('\n=== Testing protected endpoint ===');
  const testResult = await page.evaluate(async () => {
    const token = localStorage.getItem('qlttxd_token');
    try {
      const response = await fetch('/api/v1/thong-ke/tong-quan', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return { status: response.status, ok: response.ok };
    } catch (error) {
      return { error: error.message };
    }
  });
  console.log('Test result:', testResult);
}

await browser.close();

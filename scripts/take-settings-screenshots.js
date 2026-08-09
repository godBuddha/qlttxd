const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Login page
  await page.goto('http://localhost:5173/login');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'docs/screenshots/settings-01-login.png' });
  console.log('Screenshot 1: login page');

  // Find inputs
  const inputs = await page.locator('input').all();
  console.log('Found', inputs.length, 'inputs');
  const buttons = await page.locator('button').all();
  console.log('Found', buttons.length, 'buttons');

  if (inputs.length >= 2) {
    await inputs[0].fill('admin');
    await inputs[1].fill('Admin@123');
    await buttons[0].click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'docs/screenshots/settings-02-dashboard.png' });
    console.log('Screenshot 2: dashboard');

    // Settings Center
    await page.goto('http://localhost:5173/admin/settings');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-03-center.png' });
    console.log('Screenshot 3: settings center');

    // Settings Auth
    await page.goto('http://localhost:5173/admin/settings/auth');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-04-auth.png' });
    console.log('Screenshot 4: settings auth');

    // Settings Rate Limit
    await page.goto('http://localhost:5173/admin/settings/rate-limit');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-05-rate-limit.png' });
    console.log('Screenshot 5: settings rate limit');

    // Settings Security
    await page.goto('http://localhost:5173/admin/settings/security');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-06-security.png' });
    console.log('Screenshot 6: settings security');

    // Settings Workflow States
    await page.goto('http://localhost:5173/admin/settings/workflow-states');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-07-workflow-states.png' });
    console.log('Screenshot 7: workflow states');

    // Settings Role Permissions
    await page.goto('http://localhost:5173/admin/settings/role-permissions');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'docs/screenshots/settings-08-role-permissions.png' });
    console.log('Screenshot 8: role permissions');
  } else {
    console.log('Could not find inputs on login page');
    const html = await page.content();
    console.log('Page URL:', page.url());
    console.log('Page HTML (first 500 chars):', html.substring(0, 500));
  }

  await browser.close();
  console.log('Done!');
})();

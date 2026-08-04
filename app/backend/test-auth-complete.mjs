// Test: login then immediately call protected endpoint
import http from 'http';

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  // Step 1: Login via Vite proxy (port 5176)
  console.log('=== Step 1: Login via Vite proxy (5176) ===');
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 5176,
    path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }));
  
  console.log('Status:', loginRes.status);
  const loginData = JSON.parse(loginRes.body);
  
  if (loginRes.status !== 200) {
    console.log('Login FAILED:', loginData.error);
    return;
  }
  
  console.log('Login OK, token:', loginData.token ? loginData.token.substring(0, 30) + '...' : 'MISSING');
  
  // Step 2: Call protected endpoint WITH token via Vite proxy
  console.log('\n=== Step 2: Protected endpoint WITH token (via proxy 5176) ===');
  const withTokenRes = await makeRequest({
    hostname: 'localhost', port: 5176,
    path: '/api/v1/thong-ke/tong-quan', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });
  console.log('Status:', withTokenRes.status);
  console.log('Body:', withTokenRes.body.substring(0, 100));
  
  // Step 3: Call protected endpoint WITHOUT token via Vite proxy
  console.log('\n=== Step 3: Protected endpoint WITHOUT token (via proxy 5176) ===');
  const noTokenRes = await makeRequest({
    hostname: 'localhost', port: 5176,
    path: '/api/v1/thong-ke/tong-quan', method: 'GET'
  });
  console.log('Status:', noTokenRes.status);
  console.log('Body:', noTokenRes.body);
  
  // Step 4: Call protected endpoint WITH token DIRECTLY to backend (3001)
  console.log('\n=== Step 4: Protected endpoint WITH token (direct 3001) ===');
  const directRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/thong-ke/tong-quan', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });
  console.log('Status:', directRes.status);
  console.log('Body:', directRes.body.substring(0, 100));
  
  // Step 5: Login DIRECTLY to backend (3001) - bypass proxy
  console.log('\n=== Step 5: Login DIRECTLY to backend (3001) ===');
  const directLoginRes = await makeRequest({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }));
  console.log('Status:', directLoginRes.status);
  console.log('Body:', directLoginRes.body.substring(0, 100));
}

main().catch(console.error);

import http from 'http';

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

async function main() {
  // Login via Vite proxy
  console.log('=== Login via Vite proxy :5173 ===');
  const login = await req({
    hostname: 'localhost', port: 5173,
    path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }));
  
  console.log('Status:', login.status);
  const data = JSON.parse(login.body);
  console.log('Token:', data.token ? data.token.substring(0, 40) + '...' : 'MISSING');
  console.log('User:', data.user?.full_name);
  
  if (!data.token) { console.log('NO TOKEN - stopping'); return; }
  
  // Call protected endpoint WITH token via proxy
  console.log('\n=== GET /api/v1/thong-ke/tong-quan WITH token (via proxy :5173) ===');
  const stats = await req({
    hostname: 'localhost', port: 5173,
    path: '/api/v1/thong-ke/tong-quan', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + data.token }
  });
  console.log('Status:', stats.status);
  console.log('Body:', stats.body.substring(0, 150));
  
  // Call protected endpoint WITHOUT token
  console.log('\n=== GET /api/v1/thong-ke/tong-quan WITHOUT token (via proxy :5173) ===');
  const noAuth = await req({
    hostname: 'localhost', port: 5173,
    path: '/api/v1/thong-ke/tong-quan', method: 'GET'
  });
  console.log('Status:', noAuth.status);
  console.log('Body:', noAuth.body);
  
  // Check if proxy is actually working - test direct backend
  console.log('\n=== Login DIRECT to backend :3001 ===');
  const directLogin = await req({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }));
  console.log('Status:', directLogin.status);
  const ddata = JSON.parse(directLogin.body);
  console.log('Token:', ddata.token ? ddata.token.substring(0, 40) + '...' : 'MISSING');
  
  // Check CORS headers
  console.log('\n=== CORS check - OPTIONS preflight ===');
  const cors = await req({
    hostname: 'localhost', port: 3001,
    path: '/api/v1/thong-ke/tong-quan', method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'Authorization'
    }
  });
  console.log('Status:', cors.status);
  console.log('CORS headers:', JSON.stringify(cors.headers, null, 2));
}

main().catch(console.error);

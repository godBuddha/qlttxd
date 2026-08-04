
'use strict';
const http = require('http');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-smoke';
process.env.PGHOST = '/tmp';
process.env.PGPORT = '5432';
process.env.PGDATABASE = 'qlttxd';
process.env.PGUSER = 'postgres';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const { buildApp, createPool } = require('./server');
const PORT = 3097;
const BASE = `http://127.0.0.1:${PORT}`;

function req(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method, hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, headers: { ...headers }
    };
    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

async function main() {
  const pool = createPool();
  const app = buildApp({ pool });
  const server = app.listen(PORT, '127.0.0.1', async () => {
    let pass = 0, fail = 0;
    function check(name, cond, detail) {
      const ok = !!cond;
      if (ok) pass++; else fail++;
      console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' — ' + detail : ''));
    }

    try {
      console.log('\n=== CORS WITH ORIGIN SET ===');
      const corsResp = await req('OPTIONS', '/api/v1/admin/quan-huyen', {
        headers: { 'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' }
      });
      check('CORS: OPTIONS returns 200/204', corsResp.status <= 204, `status=${corsResp.status}`);
      const acao = corsResp.headers['access-control-allow-origin'];
      check('CORS: Access-Control-Allow-Origin present (with CORS_ORIGIN set)', !!acao, `value=${acao || 'MISSING'}`);
      check('CORS: matches origin', acao === 'http://localhost:5173', `value=${acao}`);

      console.log('\n=== ADDITIONAL SECURITY ===');
      // Test login rate limit - does it accept wrong passwords?
      for (let i = 0; i < 3; i++) {
        const r = await req('POST', '/api/v1/auth/login', {
          body: { username: 'admin', password: 'WrongPw' + i + '!' }
        });
        if (i === 0) check('Login wrong → 401 (not 429 yet)', r.status === 401, `status=${r.status}`);
      }

      // Admin login
      const login = await req('POST', '/api/v1/auth/login', {
        body: { username: 'admin', password: 'Qlttxd@2026' }
      });
      let token;
      try { token = JSON.parse(login.body).token; } catch(e) {}
      check('Admin login still works after wrong attempts', login.status === 200, `status=${login.status}`);

      if (token) {
        const AH = { 'Authorization': 'Bearer ' + token };
        // POST bad boundary -> 400
        const bb = await req('POST', '/api/v1/admin/quan-huyen', {
          body: { ma: 'BCORS01', ten: 'Bad', boundary: { type: 'Point', coordinates: [105, 21] } },
          headers: AH
        });
        check('POST bad boundary type → 400', bb.status === 400, `status=${bb.status}`);
        
        // Rate limit: health check works
        const h = await req('GET', '/health');
        check('Health endpoint works', h.status === 200, `status=${h.status}`);
      }

      console.log(`\nCORS/Security: ${pass} PASS, ${fail} FAIL`);
      process.exitCode = fail > 0 ? 1 : 0;
    } catch (e) {
      console.error('FATAL:', e.message);
      process.exitCode = 1;
    } finally {
      server.close();
      await pool.end();
    }
  });
}
main();

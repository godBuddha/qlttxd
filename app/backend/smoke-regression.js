'use strict';
const http = require('http');

// Import and start server inline
const { buildApp, createPool } = require('./server');

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-smoke';
process.env.PGHOST = '/tmp';
process.env.PGPORT = '5432';
process.env.PGDATABASE = 'qlttxd';
process.env.PGUSER = 'postgres';

const PORT = 3098;
const BASE = `http://127.0.0.1:${PORT}`;

function req(method, path, { body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };
    if (body) {
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}

function ok(name, cond, detail) {
  console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' — ' + detail : ''));
  return cond;
}

async function main() {
  const pool = createPool();
  const app = buildApp({ pool });
  const server = app.listen(PORT, '127.0.0.1', async () => {
    const results = { pass: 0, fail: 0 };

    function check(name, cond, detail) {
      if (ok(name, cond, detail)) results.pass++;
      else results.fail++;
    }

    try {
      // ============ SECURITY SMOKE ============
      console.log('\n=== SECURITY SMOKE ===\n');

      // 1. X-Request-Id header
      const xrid = await req('GET', '/api/v1/danh-muc/quan-huyen');
      check(
        'X-Request-Id header present',
        !!xrid.headers['x-request-id'],
        `value=${xrid.headers['x-request-id'] || 'MISSING'}`
      );

      // 2. CORS headers (OPTIONS)
      const corsResp = await req('OPTIONS', '/api/v1/admin/quan-huyen', {
        headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
      });
      check('CORS: OPTIONS returns <=204', corsResp.status <= 204, `status=${corsResp.status}`);
      check(
        'CORS: Access-Control-Allow-Origin present',
        !!corsResp.headers['access-control-allow-origin'],
        `value=${corsResp.headers['access-control-allow-origin'] || 'MISSING'}`
      );

      // 3. Security headers
      const secH = await req('GET', '/');
      check(
        'Content-Security-Policy present',
        !!secH.headers['content-security-policy'],
        `value=${(secH.headers['content-security-policy'] || '').substring(0, 100)}`
      );
      check(
        'X-Content-Type-Options: nosniff',
        secH.headers['x-content-type-options'] === 'nosniff',
        `value=${secH.headers['x-content-type-options']}`
      );
      check(
        'X-Frame-Options present',
        !!secH.headers['x-frame-options'],
        `value=${secH.headers['x-frame-options']}`
      );
      check(
        'Referrer-Policy present',
        !!secH.headers['referrer-policy'],
        `value=${secH.headers['referrer-policy']}`
      );
      check(
        'Permissions-Policy present',
        !!secH.headers['permissions-policy'],
        `value=${(secH.headers['permissions-policy'] || '').substring(0, 80)}`
      );

      // 4. RBAC: no token → 401
      const noToken = await req('GET', '/api/v1/admin/quan-huyen');
      check('RBAC: no token → 401', noToken.status === 401, `status=${noToken.status}`);

      // 5. RBAC: bad token → 401
      const badToken = await req('GET', '/api/v1/admin/quan-huyen', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      check('RBAC: bad token → 401', badToken.status === 401, `status=${badToken.status}`);

      // 6. RBAC: expired token → 401
      const jwt = require('jsonwebtoken');
      const expToken = jwt.sign({ sub: 'test', roles: ['admin'] }, process.env.JWT_SECRET, {
        expiresIn: '-1h',
      });
      const expResp = await req('GET', '/api/v1/admin/quan-huyen', {
        headers: { Authorization: 'Bearer ' + expToken },
      });
      check('RBAC: expired token → 401', expResp.status === 401, `status=${expResp.status}`);

      // ============ AUTH FLOW ============
      console.log('\n=== AUTH FLOW ===\n');

      // 7. Login as admin
      const login = await req('POST', '/api/v1/auth/login', {
        body: { username: 'admin', password: 'Qlttxd@2026' },
      });
      check('Admin login → 200', login.status === 200, `status=${login.status}`);
      let adminToken;
      try {
        adminToken = JSON.parse(login.body).token;
      } catch {}
      check('Admin login returns JWT', !!adminToken, adminToken ? 'token present' : 'MISSING');

      if (!adminToken) {
        console.log('\nCannot proceed without admin token.');
        results.fail += 10;
      } else {
        const AH = { Authorization: 'Bearer ' + adminToken };

        // 8. Protected with admin → 200
        const adminAccess = await req('GET', '/api/v1/admin/quan-huyen', { headers: AH });
        check('RBAC: admin → 200', adminAccess.status === 200, `status=${adminAccess.status}`);

        // ============ API SMOKE ============
        console.log('\n=== API SMOKE ===\n');

        // 9. GET list quan-huyen
        const listQH = await req('GET', '/api/v1/admin/quan-huyen', { headers: AH });
        check('API: GET quan-huyen → 200', listQH.status === 200, `status=${listQH.status}`);
        let qhList;
        try {
          qhList = JSON.parse(listQH.body).data;
        } catch {}
        check(
          'API: quan-huyen returns array',
          Array.isArray(qhList),
          `count=${qhList ? qhList.length : 'N/A'}`
        );

        // 10. POST create district
        const createQH = await req('POST', '/api/v1/admin/quan-huyen', {
          body: { ma: 'SMOKE01', ten: 'Quận Smoke Test' },
          headers: AH,
        });
        check('API: POST quan-huyen → 201', createQH.status === 201, `status=${createQH.status}`);
        let newQHId;
        try {
          newQHId = JSON.parse(createQH.body).data?.id;
        } catch {}

        // 11. POST duplicate → 409
        const dupQH = await req('POST', '/api/v1/admin/quan-huyen', {
          body: { ma: 'SMOKE01', ten: 'Dup' },
          headers: AH,
        });
        check('API: POST duplicate ma → 409', dupQH.status === 409, `status=${dupQH.status}`);

        // 12. POST missing ma → 400
        const badQH = await req('POST', '/api/v1/admin/quan-huyen', {
          body: { ten: 'No ma' },
          headers: AH,
        });
        check('API: POST missing ma → 400', badQH.status === 400, `status=${badQH.status}`);

        // 13. PATCH update
        if (newQHId) {
          const patchQH = await req('PATCH', `/api/v1/admin/quan-huyen/${newQHId}`, {
            body: { ten: 'Quận Smoke Updated' },
            headers: AH,
          });
          check('API: PATCH quan-huyen → 200', patchQH.status === 200, `status=${patchQH.status}`);
        }

        // 14. GET phuong-xa
        const listPX = await req('GET', '/api/v1/admin/phuong-xa', { headers: AH });
        check('API: GET phuong-xa → 200', listPX.status === 200, `status=${listPX.status}`);

        // 15. POST create ward
        const createPX = await req('POST', '/api/v1/admin/phuong-xa', {
          body: {
            ma: 'SMOKEPX01',
            ten: 'Phường Smoke Test',
            quan_huyen_id: newQHId || '00000000-0000-0000-0000-000000000000',
          },
          headers: AH,
        });
        check('API: POST phuong-xa → 201', createPX.status === 201, `status=${createPX.status}`);
        let newPXId;
        try {
          newPXId = JSON.parse(createPX.body).data?.id;
        } catch {}

        // 16. DELETE ward
        if (newPXId) {
          const delPX = await req('DELETE', `/api/v1/admin/phuong-xa/${newPXId}`, { headers: AH });
          check('API: DELETE phuong-xa → 200', delPX.status === 200, `status=${delPX.status}`);
        }

        // 17. DELETE district
        if (newQHId) {
          const delQH = await req('DELETE', `/api/v1/admin/quan-huyen/${newQHId}`, { headers: AH });
          check('API: DELETE quan-huyen → 200', delQH.status === 200, `status=${delQH.status}`);
        }

        // 18. GET public danh-muc
        const pubQH = await req('GET', '/api/v1/danh-muc/quan-huyen');
        check(
          'Public: GET danh-muc/quan-huyen → 200',
          pubQH.status === 200,
          `status=${pubQH.status}`
        );
        const pubPX = await req('GET', '/api/v1/danh-muc/phuong-xa');
        check(
          'Public: GET danh-muc/phuong-xa → 200',
          pubPX.status === 200,
          `status=${pubPX.status}`
        );

        // 19. Rate limit test (setup-admin should respect rate)
        const rl1 = await req('POST', '/api/v1/auth/login', {
          body: { username: 'admin', password: 'WrongPassword123!' },
        });
        check('Rate limit: login wrong pw returns 401', rl1.status === 401, `status=${rl1.status}`);
      }

      // ============ SUMMARY ============
      console.log('\n=== SMOKE SUMMARY ===');
      console.log(
        `Total: ${results.pass + results.fail} | PASS: ${results.pass} | FAIL: ${results.fail}`
      );

      if (results.fail > 0) {
        console.log('\nSMOKE TEST FAILED');
        process.exitCode = 1;
      } else {
        console.log('\nALL SMOKE CHECKS PASSED');
      }
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

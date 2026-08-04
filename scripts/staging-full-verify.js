#!/usr/bin/env node
// Staging full verification — run: node scripts/staging-full-verify.js
const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

function psql(cmd) {
  return execSync(`psql -h /tmp -p 5432 -U postgres -d qlttxd -t -c "${cmd}"`, { encoding: 'utf8' }).trim();
}
function req(method, path, headers = {}, body) {
  return new Promise(r => {
    const opts = { hostname: '127.0.0.1', port: 3001, path, method, headers: { ...headers }, timeout: 5000 };
    const r2 = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => r({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r2.on('error', e => r({ error: e.message }));
    r2.on('timeout', () => { r2.destroy(); r({ error: 'timeout' }); });
    if (body) r2.write(body);
    r2.end();
  });
}
(async () => {
  const R = [];
  function ok(n, p, d) { R.push({n,p,d}); console.log(`${p?'PASS':'FAIL'} | ${n}${d?' — '+d:''}`); }
  console.log('=== DB ===');
  try { const t = psql("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"); ok('Tables', parseInt(t)>=19, t.trim()); } catch(e) { ok('Tables',false,e.message.slice(0,80)); }
  try { const g = psql("SELECT PostGIS_Version()"); ok('PostGIS', g.includes('3.'), g.trim()); } catch(e) { ok('PostGIS',false,e.message.slice(0,80)); }
  console.log('\n=== HEADERS ===');
  const h = await req('GET','/health');
  ['content-security-policy','x-content-type-options','x-frame-options','referrer-policy','permissions-policy'].forEach(x => { ok(x,!!h.headers[x],h.headers[x]||'MISSING'); });
  ok('x-powered-by disabled',!h.headers['x-powered-by'],'OK');
  console.log('\n=== AUTH ===');
  const lg = await req('POST','/api/v1/auth/login',{'Content-Type':'application/json'},JSON.stringify({username:'admin',password:'Qlttxd@2026'}));
  ok('Login',lg.status===200,'status='+lg.status);
  const tk = JSON.parse(lg.body).token;
  for (const u of ['handler.hn','verifier.hn','leader.hn','citizen.nga']) {
    const r = await req('POST','/api/v1/auth/login',{'Content-Type':'application/json'},JSON.stringify({username:u,password:'Qlttxd@2026'}));
    ok('Login '+u, r.status===200, 'status='+r.status);
  }
  ok('Bad pw -> 401', (await req('POST','/api/v1/auth/login',{'Content-Type':'application/json'},JSON.stringify({username:'admin',password:'wrong'}))).status===401);
  console.log('\n=== PROTECTED ===');
  for (const rt of ['/api/v1/ho-so','/api/v1/bao-cao','/api/v1/thong-ke/tong-quan']) {
    ok(rt+' auth', (await req('GET',rt,{Authorization:'Bearer '+tk})).status===200);
    ok(rt+' no-auth->401', (await req('GET',rt)).status===401);
  }
  console.log('\n=== CORS ===');
  const co = await req('OPTIONS','/api/v1/ho-so',{'Origin':'http://localhost:5173','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Authorization'});
  ok('CORS allowed', co.status===204, 'ACAO='+(co.headers['access-control-allow-origin']||'none'));
  const ce = await req('OPTIONS','/api/v1/ho-so',{'Origin':'http://evil.com','Access-Control-Request-Method':'GET'});
  ok('CORS blocked', !ce.headers['access-control-allow-origin']||ce.headers['access-control-allow-origin']!=='http://evil.com');
  console.log('\n=== DATA ===');
  try { ok('Users', parseInt(psql("SELECT count(*) FROM users WHERE is_active=true"))>=5); ok('Roles', parseInt(psql("SELECT count(*) FROM roles"))>=3); ok('Perms', parseInt(psql("SELECT count(*) FROM permissions"))>=5); ok('Quans', parseInt(psql("SELECT count(*) FROM quan_huyen"))>=5); ok('Phuongs', parseInt(psql("SELECT count(*) FROM phuong_xa"))>=10); ok('Audit', parseInt(psql("SELECT count(*) FROM audit_log"))>0); } catch(e) { ok('Data',false,e.message.slice(0,80)); }
  const p=R.filter(r=>r.p).length, f=R.filter(r=>!r.p).length;
  console.log(`\n=== ${p} PASS, ${f} FAIL / ${R.length} ===`);
  process.exit(f>0?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

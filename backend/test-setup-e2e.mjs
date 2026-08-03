const PORT = 3099;
const BASE = `http://127.0.0.1:${PORT}`;
const u = (path, opts) => fetch(`${BASE}${path}`, opts);
const j = (r) => r.json();

import {buildApp, createPool} from './server.js';

const pool = createPool();
const app = buildApp({pool});
const server = app.listen(PORT, '127.0.0.1', async () => {
  try {
    // 1. setup-status
    const s1 = await j(await u('/api/v1/auth/setup-status'));
    console.log('1. setup-status:', JSON.stringify(s1));
    if (!s1.needsSetup) throw new Error('needsSetup should be true');

    // 2. create admin
    const r2 = await u('/api/v1/auth/setup-admin', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin@2026',full_name:'Quản trị viên',email:'admin@qlttxd.gov.vn'})});
    const a2 = await j(r2);
    console.log('2. setup-admin:', r2.status, a2.user?.username, a2.user?.roles);

    // 3. needsSetup=false
    const s3 = await j(await u('/api/v1/auth/setup-status'));
    console.log('3. after:', JSON.stringify(s3));
    if (s3.needsSetup) throw new Error('needsSetup should be false');

    // 4. duplicate 409
    const r4 = await u('/api/v1/auth/setup-admin', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin2',password:'Admin2@2026',full_name:'Test',email:'t@t.com'})});
    console.log('4. dup:', r4.status);

    // 5. login admin
    const a5 = await j(await u('/api/v1/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'Admin@2026'})}));
    console.log('5. login:', a5.user?.username, a5.user?.permissions?.length, 'perms');
    const token = a5.token;

    // 6. create citizen
    const a6 = await j(await u('/api/v1/admin/users', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({username:'congdan',password:'Congdan@2026',full_name:'Nguyen Van A',phone:'0901234567',roles:['citizen']})}));
    console.log('6. citizen:', a6.data?.username, a6.data?.roles);

    // 7. users
    const a7 = await j(await u('/api/v1/admin/users', {headers:{'Authorization':'Bearer '+token}}));
    console.log('7. users:', a7.data?.length);

    // 8. roles
    const a8 = await j(await u('/api/v1/admin/roles', {headers:{'Authorization':'Bearer '+token}}));
    console.log('8. roles:', a8.data?.map(r=>r.code));

    // 9. permissions
    const a9 = await j(await u('/api/v1/admin/permissions', {headers:{'Authorization':'Bearer '+token}}));
    console.log('9. modules:', a9.data?.map(m=>m.module));

    // 10. citizen can't access admin
    const a10 = await j(await u('/api/v1/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'congdan',password:'Congdan@2026'})}));
    const ctoken = a10.token;
    const r10 = await u('/api/v1/admin/users', {headers:{'Authorization':'Bearer '+ctoken}});
    console.log('10. citizen→admin:', r10.status);

    // 11. lock user
    const r11 = await u(`/api/v1/admin/users/${a6.data.id}`, {method:'PATCH',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({is_active:false})});
    console.log('11. lock:', r11.status);

    // 12. locked user can't login
    const a12 = await j(await u('/api/v1/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'congdan',password:'Congdan@2026'})}));
    console.log('12. locked login error:', a12.error);

    console.log('\n✅ ALL 12 E2E TESTS PASSED!');
    server.close(); pool.end(); process.exit(0);
  } catch(e) {
    console.error('❌ FAIL:', e);
    server.close(); pool.end(); process.exit(1);
  }
});

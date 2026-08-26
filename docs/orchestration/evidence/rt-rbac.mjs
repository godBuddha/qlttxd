// AUD-RUNTIME RBAC — 4 roles matrix via API (pure node fetch, no browser)
import { writeFileSync } from 'node:fs';

const BE = 'http://localhost:4100';
const users = [
  { username: 'qa_handler', password: 'QaTest2026abc', full_name: 'QA Thụ lý', email: 'qa_handler@e2e.test', roles: ['case_handler'] },
  { username: 'qa_verifier', password: 'QaTest2026abc', full_name: 'QA Xác minh', email: 'qa_verifier@e2e.test', roles: ['verifier'] },
  { username: 'qa_leader', password: 'QaTest2026abc', full_name: 'QA Lãnh đạo', email: 'qa_leader@e2e.test', roles: ['leader'] },
  { username: 'qa_citizen', password: 'QaTest2026abc', full_name: 'QA Công dân', email: 'qa_citizen@e2e.test', roles: ['citizen'] },
];

async function api(path, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const r = await fetch(BE + path, { ...opts, headers });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}

// admin login
const adminLogin = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }) });
const adminToken = adminLogin.body?.token;
if (!adminToken) { console.log('ADMIN LOGIN FAILED', adminLogin); process.exit(1); }

const created = [];
for (const u of users) {
  const r = await api('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(u) }, adminToken);
  created.push({ username: u.username, create_status: r.status, error: r.body?.error });
  console.log('create', u.username, r.status, r.body?.error || 'OK');
}

const latest = await api('/api/v1/ho-so?limit=1', {}, adminToken);
const caseId = latest.body?.data?.[0]?.id;
console.log('caseId', caseId);

const matrix = [];
for (const u of users) {
  const login = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: u.username, password: u.password }) });
  const token = login.body?.token;
  const row = { role: u.roles[0], username: u.username, login_status: login.status, checks: {} };
  if (!token) { row.checks.error = login.body; matrix.push(row); continue; }

  const createUser = await api('/api/v1/admin/users', { method: 'POST', body: JSON.stringify({ username: 'hack_' + Date.now(), password: 'Xtest1234', full_name: 'Hacker', email: 'h@x.test' }) }, token);
  row.checks.tao_user_quan_tri = { status: createUser.status, expected: 403, pass: createUser.status === 403 };

  const cfg = await api('/api/v1/config/auth', { method: 'PATCH', body: JSON.stringify({ bcrypt_rounds: 10 }) }, token);
  row.checks.sua_cau_hinh = { status: cfg.status, expected: 403, pass: cfg.status === 403 };

  const cases = await api('/api/v1/ho-so?limit=5', {}, token);
  row.checks.xem_danh_sach_ho_so = { status: cases.status, total: cases.body?.total };

  if (cases.body?.data?.length) {
    const cid = cases.body.data[0].id;
    const detail = await api(`/api/v1/ho-so/${cid}`, {}, token);
    row.checks.xem_chi_tiet_ho_so = { status: detail.status, pass: u.roles[0] === 'citizen' ? (detail.status === 403 || detail.status === 404) : detail.status === 200 };
  }

  if (caseId) {
    const trans = await api(`/api/v1/ho-so/${caseId}/trang-thai`, { method: 'PATCH', body: JSON.stringify({ trang_thai: 'da_dong' }) }, token);
    row.checks.chuyen_trang_thai_ngoai_ma_tran = { status: trans.status, body: trans.body?.error || trans.body?.data?.trang_thai };
  }

  if (u.roles[0] === 'citizen') {
    const rep = await api('/api/v1/ho-so', { method: 'POST', body: JSON.stringify({ dia_chi: 'test' }) }, token);
    row.checks.tao_ho_so_officer_only = { status: rep.status, expected: 403, pass: rep.status === 403 };
    const own = await api('/api/v1/bao-cao', {}, token);
    row.checks.xem_bao_cao_cua_minh = { status: own.status };
  }
  if (u.roles[0] === 'case_handler' && caseId) {
    const qd = await api(`/api/v1/ho-so/${caseId}/quyet-dinh`, { method: 'POST', body: JSON.stringify({ bien_ban_id: '00000000-0000-0000-0000-000000000000' }) }, token);
    row.checks.ra_quyet_dinh_khong_phai_leader = { status: qd.status, expected: 403, pass: qd.status === 403 };
  }
  if (u.roles[0] === 'leader' && caseId) {
    const bb = await api(`/api/v1/ho-so/${caseId}/bien-ban`, { method: 'POST', body: JSON.stringify({ noi_dung: 'leader thử' }) }, token);
    row.checks.lap_bien_ban_khong_phai_handler = { status: bb.status, expected: 403, pass: bb.status === 403 };
  }
  if (u.roles[0] === 'verifier' && caseId) {
    const kp = await api(`/api/v1/ho-so/${caseId}/khac-phuc`, { method: 'POST', body: JSON.stringify({ bien_phap: 'verifier thử' }) }, token);
    row.checks.quan_ly_khac_phuc_khong_phai_handler = { status: kp.status, expected: 403, pass: kp.status === 403 };
  }
  matrix.push(row);
  console.log('matrix', u.username, JSON.stringify(row.checks));
}

const summary = matrix.map(r => ({ role: r.role, checks: Object.fromEntries(Object.entries(r.checks || {}).map(([k, v]) => [k, v.pass === undefined ? v.status : (v.pass ? 'PASS' : 'FAIL')])) }));
writeFileSync(new URL('./rbac-results.json', import.meta.url).pathname, JSON.stringify({ created_users: created, matrix, summary, generated_at: new Date().toISOString() }, null, 2));
console.log('SUMMARY', JSON.stringify(summary, null, 1));
console.log('DONE');

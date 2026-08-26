// retest config edit with correct verb PUT + existing key
import { writeFileSync, readFileSync } from 'node:fs';
const BE = 'http://localhost:4100';
const EV = new URL('./', import.meta.url).pathname;
const rbac = JSON.parse(readFileSync(`${EV}rbac-results.json`, 'utf8'));

async function api(path, opts = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const r = await fetch(BE + path, { ...opts, headers });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
const adminLogin = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }) });
const adminToken = adminLogin.body?.token;
// find an existing editable key
const keys = await api('/api/v1/config?category=ui', {}, adminToken);
console.log('config list status', keys.status, JSON.stringify(keys.body).slice(0, 300));

const retest = [];
for (const row of rbac.matrix) {
  const login = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ username: row.username, password: 'QaTest2026abc' }) });
  const token = login.body?.token;
  const r = await api('/api/v1/config/ui/home_lat', { method: 'PUT', body: JSON.stringify({ value: 21.0285 }) }, token);
  retest.push({ role: row.role, status: r.status, body: r.body, pass: r.status === 403 });
  console.log(row.role, 'PUT config/ui/home_lat →', r.status, JSON.stringify(r.body).slice(0, 100));
}
writeFileSync(`${EV}rbac-config-retest.json`, JSON.stringify(retest, null, 2));
console.log('DONE');

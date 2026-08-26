// merge config retest into rbac-results.json
import { writeFileSync, readFileSync } from 'node:fs';
const EV = new URL('./', import.meta.url).pathname;
const rbac = JSON.parse(readFileSync(`${EV}rbac-results.json`, 'utf8'));
const retest = JSON.parse(readFileSync(`${EV}rbac-config-retest.json`, 'utf8'));
for (const row of rbac.matrix) {
  const r = retest.find(x => x.role === row.role);
  if (r) {
    row.checks.sua_cau_hinh = { status: r.status, expected: 403, pass: r.pass, endpoint: 'PUT /api/v1/config/ui/home_lat' };
  }
}
rbac.summary = rbac.matrix.map(r => ({ role: r.role, checks: Object.fromEntries(Object.entries(r.checks || {}).map(([k, v]) => [k, v.pass === undefined ? v.status : (v.pass ? 'PASS' : 'FAIL')])) }));
rbac.config_retest_note = 'PATCH /api/v1/config/auth trả 404 (method+path không tồn tại) ở lần chạy đầu; đã retest đúng endpoint PUT /api/v1/config/ui/home_lat → 403 cho cả 4 vai trò.';
writeFileSync(`${EV}rbac-results.json`, JSON.stringify(rbac, null, 2));
console.log(JSON.stringify(rbac.summary, null, 1));

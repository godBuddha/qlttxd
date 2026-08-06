// Verification for AUDIT-B5 client-side routing helpers.
// Extracts the REAL getPath / getPageFromPath functions straight from main.jsx
// so the test can't drift from the shipped source.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./src/main.jsx', import.meta.url), 'utf8');

function extractFn(name, body) {
  const start = body.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  const open = body.indexOf('{', start);
  let depth = 0, i = open;
  for (; i < body.length; i++) {
    if (body[i] === '{') depth++;
    else if (body[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return body.slice(start, i);
}

// Build a module source with the two functions (and their deps: none external)
const fnGetPath = extractFn('getPath', src);
const fnGetPageFromPath = extractFn('getPageFromPath', src);
const mod = new Function(`"use strict"; ${fnGetPath} ${fnGetPageFromPath} return { getPath, getPageFromPath };`)();
const { getPath, getPageFromPath } = mod;

let failures = 0;
function eq(label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`PASS  ${label}`);
  else { failures++; console.log(`FAIL  ${label}\n      expected ${e}\n      actual   ${a}`); }
}

// --- getPath: page -> URL ---
const pathCases = {
  home: '/', dashboard: '/dashboard', cases: '/cases',
  citizen: '/citizen', 'admin-users': '/admin/users', 'admin-roles': '/admin/roles',
  'admin-audit': '/admin/audit-log', 'admin-locations': '/admin/locations',
  'admin-catalog': '/admin/catalog', report: '/report', profile: '/profile',
  'officer-reports': '/officer-reports', 'ban-do': '/ban-do',
};
for (const [page, exp] of Object.entries(pathCases)) {
  eq(`getPath('${page}')`, getPath(page), exp);
}
eq('getPath(case, 42)', getPath('case', 42), '/cases/42');
eq('getPath(case, "abc-123")', getPath('case', 'abc-123'), '/cases/abc-123');
eq('getPath(unknown) falls back to /', getPath('nonexistent'), '/');

// --- getPageFromPath: URL -> route ---
eq("getPageFromPath('/')", getPageFromPath('/'), { page: 'home', id: null });
eq("getPageFromPath('')", getPageFromPath(''), { page: 'home', id: null });
eq("getPageFromPath('/dashboard')", getPageFromPath('/dashboard'), { page: 'dashboard', id: null });
eq("getPageFromPath('/cases')", getPageFromPath('/cases'), { page: 'cases', id: null });
eq("getPageFromPath('/ban-do')", getPageFromPath('/ban-do'), { page: 'ban-do', id: null });
eq("getPageFromPath('/officer-reports')", getPageFromPath('/officer-reports'), { page: 'officer-reports', id: null });
eq("deep link getPageFromPath('/cases/99')", getPageFromPath('/cases/99'), { page: 'case', id: '99' });
eq("deep link getPageFromPath('/cases/HS-2026-01')", getPageFromPath('/cases/HS-2026-01'), { page: 'case', id: 'HS-2026-01' });
eq("invalid getPageFromPath('/nope') -> unknown (NotFound)", getPageFromPath('/nope'), { page: 'unknown', id: null });
eq("invalid getPageFromPath('/admin/wrong')", getPageFromPath('/admin/wrong'), { page: 'unknown', id: null });

// Round-trip: getPath(getPageFromPath(x).page, id) should reproduce the path for known routes
for (const p of Object.keys(pathCases)) {
  const rt = getPath(getPageFromPath(pathCases[p]).page);
  eq(`round-trip ${p}`, rt, pathCases[p]);
}
const caseRT = getPath(getPageFromPath('/cases/7').page, getPageFromPath('/cases/7').id);
eq('round-trip case', caseRT, '/cases/7');

console.log(failures === 0 ? '\nALL ROUTING-HELPER ASSERTIONS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

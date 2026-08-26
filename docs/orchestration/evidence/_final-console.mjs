// final console report — clean, classified (regenerate with URL detail of failing requests)
import { writeFileSync, readFileSync } from 'node:fs';
const EV = new URL('./', import.meta.url).pathname;
const data = JSON.parse(readFileSync(`${EV}console-report.json`, 'utf8'));
const lines = [];
lines.push('AUD-RUNTIME console/network report');
lines.push('Generated: ' + new Date().toISOString());
lines.push('');
lines.push('== Browser console errors/warnings (đã lọc noise [vite]/React DevTools) ==');
const errs = data.realErrors || [];
const byType = {};
for (const e of errs) { (byType[e.type] = byType[e.type] || []).push(e); }
lines.push(`Tổng: ${errs.length} mục`);
lines.push('');
for (const [t, list] of Object.entries(byType)) {
  lines.push(`-- ${t} (${list.length}) --`);
  const uniq = {};
  for (const e of list) { const k = e.text.slice(0, 120); (uniq[k] = uniq[k] || []).push(e.url); }
  for (const [text, urls] of Object.entries(uniq)) {
    lines.push(`  ${text}`);
    const uq = [...new Set(urls)];
    for (const u of uq.slice(0, 3)) lines.push(`    tại: ${u}${uq.length > 3 ? ` (+${uq.length - 3} URL khác)` : ''}`);
  }
}
lines.push('');
lines.push('== Phân loại ==');
const count = (re) => errs.filter(e => re.test(e.text)).length;
lines.push(`401 Unauthorized (auth probe khi chưa đăng nhập / refresh token): ${count(/401/)}`);
lines.push(`404 Not Found (resource phụ — favicon/asset hoặc API probe): ${count(/404/)}`);
lines.push(`400 Bad Request (từ bước test chuyển trạng thái SAI — kỳ vọng): ${count(/400/)}`);
lines.push(`"[object Object]"/"undefined" parse warning (DEF map click): ${count(/\[object Object\]|"undefined"/)}`);
lines.push('');
lines.push('== Failed network requests (non-API >=400 hoặc aborted) ==');
const fr = data.failedRequests || [];
if (!fr.length) lines.push('(none)');
for (const f of fr) lines.push(JSON.stringify(f));
writeFileSync(`${EV}console-report.txt`, lines.join('\n'));
console.log(lines.join('\n'));

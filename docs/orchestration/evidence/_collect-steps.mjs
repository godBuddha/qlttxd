// collect all step results into one file
import { writeFileSync } from 'node:fs';
const EV = new URL('./', import.meta.url).pathname;
const files = ['_rt-steps.json', '_rt-steps-7-8.json', '_rt-steps-6-8.json'];
const all = [];
for (const f of files) {
  try { all.push(...JSON.parse((await import('node:fs')).readFileSync(EV + f, 'utf8'))); } catch (e) { console.log('skip', f, e.message); }
}
// keep latest per step prefix (steps 6,7,8 re-run in later files)
writeFileSync(`${EV}_rt-steps-all.json`, JSON.stringify(all, null, 2));
for (const r of all) console.log(`[${r.status}] ${r.step} — ${r.note}`);

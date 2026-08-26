// health check helper
const base = process.env.BASE || 'http://localhost:4100';
const path = process.argv[2] || '/health';
fetch(base + path).then(async r => {
  console.log('status:', r.status);
  console.log((await r.text()).slice(0, 500));
}).catch(e => console.log('ERR', e.message));

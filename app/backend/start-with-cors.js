process.env.PGHOST = '/tmp';
process.env.PGPORT = '5432';
process.env.PGDATABASE = 'qlttxd';
process.env.PGUSER = 'postgres';
process.env.JWT_SECRET = 'qlttxd-secret-key-2026-min32chars';
process.env.UPLOAD_DIR = '/workspace/ssd/qlttxd/uploads';
if (!process.env.CORS_ORIGIN) process.env.CORS_ORIGIN = 'http://localhost:5173';
console.log('CORS_ORIGIN =', process.env.CORS_ORIGIN);

const { buildApp, createPool } = require('./server');
const pool = createPool();
const app = buildApp({ pool });

// CORS workaround: inject at front of stack
const allowedOrigins = process.env.CORS_ORIGIN.split(',').map(x => x.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Request-Id');
  }
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  next();
});

app.listen(3000, '0.0.0.0', () => console.log('QLTTXD API with CORS at http://0.0.0.0:3000'));

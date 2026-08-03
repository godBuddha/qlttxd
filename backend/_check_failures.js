const { Pool } = require('pg');
const pool = new Pool({ host: '/tmp', port: 5432, database: 'qlttxd', user: 'postgres' });
(async () => {
  const c = await pool.connect();
  
  // Check seed_contains_known_point
  const r1 = await c.query("SELECT ma, ST_AsText(boundary) as wkt FROM phuong_xa WHERE ma = '00101'");
  console.log('Ward 00101:', r1.rows[0]?.wkt?.substring(0, 300));
  
  const r2 = await c.query("SELECT ST_Contains((SELECT boundary FROM phuong_xa WHERE ma='00101'), ST_SetSRID(ST_MakePoint(105.8200, 21.0330), 4326)) as contains");
  console.log('Contains point:', r2.rows[0]?.contains);
  
  // Check demo users
  const r3 = await c.query('SELECT count(*) as cnt FROM users');
  console.log('User count:', r3.rows[0]?.cnt);
  
  const r4 = await c.query('SELECT id, username, created_at FROM users ORDER BY id LIMIT 5');
  console.log('Users:', JSON.stringify(r4.rows));
  
  c.release();
  await pool.end();
})();

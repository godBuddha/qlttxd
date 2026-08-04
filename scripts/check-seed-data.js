const { Pool } = require('pg');
const pool = new Pool({ host: '/tmp', port: 5432, database: 'qlttxd', user: 'postgres' });
(async () => {
  const c = await pool.connect();
  try {
    const users = await c.query('SELECT count(*) as cnt FROM users');
    console.log('Users count:', users.rows[0].cnt);
    
    const point = await c.query("SELECT ST_Contains(px.boundary, ST_SetSRID(ST_MakePoint(105.8200, 21.0330), 4326)) as contains FROM phuong_xa px LIMIT 5");
    console.log('Point containment samples:', JSON.stringify(point.rows));
    
    const bounds = await c.query('SELECT id, ma, ten, ST_IsValid(boundary) as valid, GeometryType(boundary) as gtype, ST_SRID(boundary) as srid FROM phuong_xa LIMIT 5');
    console.log('Phuong xa boundaries:', JSON.stringify(bounds.rows, null, 2));
    
    const dist = await c.query('SELECT id, ma, ten, ST_IsValid(boundary) as valid, GeometryType(boundary) as gtype, ST_SRID(boundary) as srid FROM quan_huyen LIMIT 3');
    console.log('Quan huyen boundaries:', JSON.stringify(dist.rows, null, 2));
  } finally { c.release(); await pool.end(); }
})();
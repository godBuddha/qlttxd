const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = new Pool({ host: '/tmp', port: 5432, database: 'qlttxd', user: 'postgres' });

  // Run schema.sql
  const schema = fs.readFileSync(path.join('/workspace/ssd/qlttxd', 'sql/schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Schema applied');

  // Run seed.sql
  const seed = fs.readFileSync(path.join('/workspace/ssd/qlttxd', 'sql/seed.sql'), 'utf8');
  await pool.query(seed);
  console.log('Seed applied');

  // Verify
  const roles = await pool.query('SELECT count(*) FROM roles');
  const perms = await pool.query('SELECT count(*) FROM permissions');
  const users = await pool.query('SELECT count(*) FROM users');
  console.log(
    `Roles: ${roles.rows[0].count}, Permissions: ${perms.rows[0].count}, Users: ${users.rows[0].count}`
  );

  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

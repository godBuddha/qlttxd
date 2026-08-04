const API = 'http://localhost:3000';

// Login as admin
const loginResp = await fetch(`${API}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' })
});
const { token } = await loginResp.json();
console.log('Admin token obtained');

const users = [
  { username: 'canbo01', password: 'Qlttxd@2026', full_name: 'Nguyễn Văn Cán Bộ', email: 'canbo01@qlttxd.local', phone: '0901000002', roles: ['handler'] },
  { username: 'xacthuc01', password: 'Qlttxd@2026', full_name: 'Trần Thị Xác Thực', email: 'xacthuc01@qlttxd.local', phone: '0901000003', roles: ['verifier'] },
  { username: 'lanhdao01', password: 'Qlttxd@2026', full_name: 'Lê Văn Lãnh Đạo', email: 'lanhdao01@qlttxd.local', phone: '0901000004', roles: ['leader'] },
  { username: 'congdan01', password: 'Qlttxd@2026', full_name: 'Phạm Thị Công Dân', email: 'congdan01@qlttxd.local', phone: '0901000005', roles: ['citizen'] },
];

for (const u of users) {
  const resp = await fetch(`${API}/api/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(u)
  });
  const data = await resp.json();
  if (data.error) {
    console.log(`⚠️ ${u.username}: ${data.error}`);
  } else {
    console.log(`✅ ${u.username}: created (${data.roles?.join(',')})`);
  }
}

// Verify logins work
console.log('\n--- Verifying logins ---');
for (const u of users) {
  const resp = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u.username, password: u.password })
  });
  const data = await resp.json();
  console.log(`${u.username}: ${data.token ? '✅ OK' : '❌ ' + data.error}`);
}

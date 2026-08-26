// login test: admin
fetch('http://localhost:4100/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' }),
}).then(async r => {
  const j = await r.json();
  console.log(r.status, j.user ? 'LOGIN OK roles=' + JSON.stringify(j.user.roles) : JSON.stringify(j));
});

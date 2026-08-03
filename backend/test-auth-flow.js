const testAuth = async () => {
  try {
    // Test login
    console.log('Testing login...');
    const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Qlttxd@2026' })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login status:', loginResponse.status);
    
    if (!loginResponse.ok) {
      console.log('Login failed:', loginData.error);
      return;
    }
    
    console.log('Login successful, got token:', loginData.token ? 'Yes' : 'No');
    
    // Test protected endpoint with token
    console.log('\nTesting protected endpoint...');
    const protectedResponse = await fetch('http://localhost:3001/api/v1/thong-ke/tong-quan', {
      headers: { 'Authorization': 'Bearer ' + loginData.token }
    });
    
    const protectedData = await protectedResponse.json();
    console.log('Protected endpoint status:', protectedResponse.status);
    console.log('Protected endpoint data:', JSON.stringify(protectedData).substring(0, 100));
    
    // Test without token
    console.log('\nTesting without token...');
    const noTokenResponse = await fetch('http://localhost:3001/api/v1/thong-ke/tong-quan');
    const noTokenData = await noTokenResponse.json();
    console.log('No token status:', noTokenResponse.status);
    console.log('No token error:', noTokenData.error);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
};

testAuth();

import http from 'http';

const testAuth = () => {
  // First, login to get a token
  const loginOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const loginReq = http.request(loginOptions, (loginRes) => {
    let data = '';
    
    loginRes.on('data', (chunk) => {
      data += chunk;
    });
    
    loginRes.on('end', () => {
      console.log('Login status:', loginRes.statusCode);
      const loginData = JSON.parse(data);
      
      if (loginRes.statusCode !== 200) {
        console.log('Login failed:', loginData.error);
        return;
      }
      
      console.log('Login successful, got token:', loginData.token ? 'Yes' : 'No');
      
      // Now test protected endpoint with token
      const protectedOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/v1/thong-ke/tong-quan',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + loginData.token
        }
      };
      
      const protectedReq = http.request(protectedOptions, (protectedRes) => {
        let protectedData = '';
        
        protectedRes.on('data', (chunk) => {
          protectedData += chunk;
        });
        
        protectedRes.on('end', () => {
          console.log('\nProtected endpoint status:', protectedRes.statusCode);
          console.log('Protected endpoint data:', protectedData.substring(0, 100));
          
          // Test without token
          const noTokenOptions = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/v1/thong-ke/tong-quan',
            method: 'GET'
          };
          
          const noTokenReq = http.request(noTokenOptions, (noTokenRes) => {
            let noTokenData = '';
            
            noTokenRes.on('data', (chunk) => {
              noTokenData += chunk;
            });
            
            noTokenRes.on('end', () => {
              console.log('\nNo token status:', noTokenRes.statusCode);
              console.log('No token error:', noTokenData);
            });
          });
          
          noTokenReq.on('error', (error) => {
            console.error('No token request error:', error.message);
          });
          
          noTokenReq.end();
        });
      });
      
      protectedReq.on('error', (error) => {
        console.error('Protected request error:', error.message);
      });
      
      protectedReq.end();
    });
  });
  
  loginReq.on('error', (error) => {
    console.error('Login request error:', error.message);
  });
  
  // Send login request
  loginReq.write(JSON.stringify({
    username: 'admin',
    password: 'Qlttxd@2026'
  }));
  
  loginReq.end();
};

testAuth();

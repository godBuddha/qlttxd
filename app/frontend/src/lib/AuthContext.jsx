import { createContext, useContext, useState, useCallback } from 'react';
import { request } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('qlttxd_user'));
    } catch {
      return null;
    }
  });

  const login = useCallback((userData) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await request('/api/v1/auth/logout', { 
        method: 'POST',
        credentials: 'include', // Include cookies to clear refresh token
      });
    } catch {
      /* local logout is still safe */
    }
    localStorage.removeItem('qlttxd_token');
    localStorage.removeItem('qlttxd_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    localStorage.setItem('qlttxd_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

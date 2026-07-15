"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { getMe, login as apiLogin, logout as apiLogout } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const u = await getMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const result = await apiLogin(username, password);
    await checkAuth();
    return result;
  }

  async function logout() {
    await apiLogout();
    setUser(null);
  }

  const isAdmin = user?.role === 'admin';
  const isInspector = user?.role === 'inspector';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isInspector, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

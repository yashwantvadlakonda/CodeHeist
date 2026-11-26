import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { adminApi, getAdminToken, setAdminToken } from '../lib/api';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const verifySession = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setAdmin(null);
      setLoading(false);
      return null;
    }
    try {
      // Verify both /api/auth/me AND an actual admin endpoint so stale/player tokens are rejected immediately
      const [meData] = await Promise.all([
        adminApi('/api/auth/me'),
        adminApi('/api/admin/overview'),
      ]);
      if (!meData.user?.roles?.includes('admin')) {
        throw new Error('Administrator role required');
      }
      setAdmin(meData.user);
      return meData.user;
    } catch {
      setAdminToken(null);
      setAdmin(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const login = async (email, password) => {
    const data = await adminApi('/api/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAdminToken(data.token);
    setAdmin(data.user);
    return data.user;
  };

  const logout = () => {
    setAdminToken(null);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, verifySession }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

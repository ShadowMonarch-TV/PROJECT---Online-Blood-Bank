import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest, clearToken, getToken, publicRequest } from '../api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [bloodGroups, setBloodGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await apiRequest('/api/auth/me');
      setUser(data.user);
      return data.user;
    } catch (error) {
      clearToken();
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const meta = await publicRequest('/api/meta/blood-groups');
        if (active) setBloodGroups(meta.bloodGroups || []);
      } catch {
        if (active) setBloodGroups([]);
      }

      const token = getToken();
      if (token) {
        try {
          await refreshUser();
        } catch {
          // handled in refreshUser
        }
      }

      if (active) setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, setUser, bloodGroups, setBloodGroups, loading, refreshUser, logout }),
    [user, bloodGroups, loading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider.');
  }
  return context;
}


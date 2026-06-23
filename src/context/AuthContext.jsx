'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  return { response, data };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialized, setInitialized] = useState(false);

  const refreshSession = useCallback(async () => {
    const { response, data } = await requestJson('/api/access/session');
    if (!response.ok || data?.ok === false) {
      setUser(null);
      return null;
    }
    setUser(data.user || null);
    return data.user || null;
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { response, data } = await requestJson('/api/access/session');
        if (!active) return;
        if (!response.ok || data?.ok === false) {
          setUser(null);
        } else {
          setUser(data.user || null);
        }
      } catch (error) {
        if (active) {
          console.error(error);
          setUser(null);
        }
      } finally {
        if (active) {
          setInitialized(true);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password, role) => {
    try {
      const { response, data } = await requestJson('/api/access/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, role })
      });

      if (!response.ok || data?.ok === false) {
        return { ok: false, reason: data?.reason || '登录失败' };
      }

      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      console.error(error);
      return { ok: false, reason: '登录失败，请稍后重试' };
    }
  }, []);

  const register = useCallback(async (username, password, role, name) => {
    try {
      const { response, data } = await requestJson('/api/access/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, role, name })
      });

      if (!response.ok || data?.ok === false) {
        return { ok: false, reason: data?.reason || '注册失败' };
      }

      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (error) {
      console.error(error);
      return { ok: false, reason: '注册失败，请稍后重试' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/access/logout', {
        method: 'POST',
        cache: 'no-store'
      });
    } catch (error) {
      console.error(error);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      initialized,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refreshSession
    }),
    [initialized, login, logout, refreshSession, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 <AuthProvider> 内使用');
  }
  return ctx;
}

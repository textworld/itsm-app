import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import initialUsers from '../mock/initialUsers.json';
import { loadCurrentUser, saveCurrentUser } from '../utils/storage.js';

const AuthContext = createContext(null);

/**
 * AuthProvider
 * - 提供当前登录用户
 * - login(username, password, role): 校验成功后写入 localStorage
 * - logout(): 清除用户
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadCurrentUser());

  useEffect(() => {
    saveCurrentUser(user);
  }, [user]);

  const login = (username, password, role) => {
    const hit = initialUsers.find(
      (u) => u.username === username && u.password === password && u.role === role
    );
    if (!hit) {
      return { ok: false, reason: '账号、密码或角色不匹配' };
    }
    const snapshot = {
      id: hit.id,
      username: hit.username,
      name: hit.name,
      role: hit.role,
      department: hit.department
    };
    setUser(snapshot);
    return { ok: true, user: snapshot };
  };

  const logout = () => {
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout
    }),
    [user]
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

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { TicketProvider } from './context/TicketContext.jsx';
import AppRouter from './router/index.jsx';

/**
 * 应用根组件
 * - BrowserRouter basename 与 vite.config.js base 保持一致
 * - AuthProvider 提供登录用户
 * - TicketProvider 提供工单数据 + localStorage 同步
 */
export default function App() {
  return (
    <BrowserRouter basename="/itsm-app-proto-2">
      <AuthProvider>
        <TicketProvider>
          <AppRouter />
        </TicketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

'use client';

import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import 'dayjs/locale/zh-cn';
import { AuthProvider } from '../../context/AuthContext.jsx';
import { TicketProvider } from '../../context/TicketContext.jsx';

export default function AppProviders({ children }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6
        }
      }}
    >
      <AntdApp>
        <AuthProvider>
          <TicketProvider>{children}</TicketProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

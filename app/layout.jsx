import './globals.css';
import AppProviders from '../src/components/providers/AppProviders.jsx';

export const metadata = {
  title: 'ITSM 工单系统',
  description: '基于 Next.js 与 SQLite 的 ITSM 工单系统'
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

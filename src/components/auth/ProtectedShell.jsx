'use client';

import { useEffect } from 'react';
import { Spin } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import AppLayout from '../Layout/AppLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedShell({ children }) {
  const { initialized, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (initialized && !isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname || '/tickets')}`);
    }
  }, [initialized, isAuthenticated, pathname, router]);

  if (!initialized || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

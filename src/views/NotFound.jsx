'use client';

import React from 'react';
import { Result, Button } from 'antd';
import { useRouter } from 'next/navigation';

export default function NotFoundPage() {
  const router = useRouter();
  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在"
      extra={
        <Button type="primary" onClick={() => router.replace('/tickets')}>
          返回工单列表
        </Button>
      }
    />
  );
}

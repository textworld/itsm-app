'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Space,
  Spin,
  Table,
  Typography
} from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  buildScheduleGroupRow,
  filterScheduleGroups
} from './scheduleConfigViewModel.js';

const API_URL = '/api/config/admin/schedules';

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

export default function AdminScheduleConfigPage() {
  const [groups, setGroups] = useState([]);
  const [systems, setSystems] = useState([]);
  const [users, setUsers] = useState([]);
  const [systemKeyword, setSystemKeyword] = useState('');
  const [userKeyword, setUserKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);

  const loadConfig = async () => {
    setLoading(true);
    setErrors([]);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载排班配置失败');
      }
      setGroups(data.config?.groups || []);
      setSystems(data.systems || []);
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
      setErrors([{ message: error.message || '加载排班配置失败' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const filteredGroups = useMemo(
    () => filterScheduleGroups(groups, { systemKeyword, userKeyword }, { systems, users }),
    [groups, systemKeyword, systems, userKeyword, users]
  );

  const dataSource = useMemo(
    () => filteredGroups.map((group) => buildScheduleGroupRow(group, { systems, users })),
    [filteredGroups, systems, users]
  );

  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
      width: '20%'
    },
    {
      title: '系统范围',
      dataIndex: 'systemSummary',
      key: 'systemSummary',
      width: '30%'
    },
    {
      title: '相应人员',
      dataIndex: 'userSummary',
      key: 'userSummary'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Link href={`/schedules/${row.id}`}>
          <Button size="small" icon={<EditOutlined />}>编辑</Button>
        </Link>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>排班配置</Typography.Title>
            <Typography.Text type="secondary">
              使用列表查看不同排班规则，并按系统或人员快速定位。
            </Typography.Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadConfig} loading={loading}>
              刷新
            </Button>
            <Link href="/schedules/new">
              <Button type="primary" icon={<PlusOutlined />}>
                新增排班规则
              </Button>
            </Link>
          </Space>
        </div>
      </Card>

      {errors.length > 0 && (
        <Alert
          type="error"
          showIcon
          message="加载排班配置失败"
          description={(
            <ul className="admin-config-error-list">
              {errors.map((error, index) => (
                <li key={`${error.message}_${index}`}>{error.message}</li>
              ))}
            </ul>
          )}
        />
      )}

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="系统搜索"
              value={systemKeyword}
              onChange={(event) => setSystemKeyword(event.target.value)}
              style={{ width: 240 }}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="人员搜索"
              value={userKeyword}
              onChange={(event) => setUserKeyword(event.target.value)}
              style={{ width: 240 }}
            />
          </Space>

          <Spin spinning={loading}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={dataSource}
              pagination={false}
              locale={{
                emptyText: (
                  <Empty description="暂无排班规则">
                    <Link href="/schedules/new">
                      <Button type="primary" icon={<PlusOutlined />}>新增排班规则</Button>
                    </Link>
                  </Empty>
                )
              }}
            />
          </Spin>
        </Space>
      </Card>
    </Space>
  );
}

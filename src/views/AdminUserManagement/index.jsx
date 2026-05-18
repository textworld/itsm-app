'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Radio,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { PlusOutlined, ReloadOutlined, UserAddOutlined } from '@ant-design/icons';
import { ROLE_LABELS, ROLE_OPTIONS } from '../../constants/roles.js';

const API_URL = '/api/admin/users';

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

export default function AdminUserManagementPage() {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载账号失败');
      }
      setUsers(data.users || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || '加载账号失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreateModal = () => {
    form.setFieldsValue({ role: 'REQUESTER', username: '', name: '', password: '' });
    setModalOpen(true);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'POST',
        body: JSON.stringify(values)
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '创建账号失败');
      }
      setModalOpen(false);
      message.success('账号已创建');
      await loadUsers();
    } catch (createError) {
      console.error(createError);
      setError(createError.message || '创建账号失败');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((item) =>
      [item.username, item.name].some((value) =>
        String(value || '').toLowerCase().includes(keyword)
      )
    );
  }, [searchText, users]);

  const handleAvailabilityChange = async (record, checked) => {
    setUpdatingUserId(record.id);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PATCH',
        body: JSON.stringify({
          userId: record.id,
          availabilityStatus: checked ? 'ONLINE' : 'OFFLINE'
        })
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '更新账号状态失败');
      }
      setUsers((prev) =>
        prev.map((item) => (item.id === data.user.id ? { ...item, ...data.user } : item))
      );
      message.success(checked ? '账号已上线' : '账号已下线');
    } catch (updateError) {
      console.error(updateError);
      setError(updateError.message || '更新账号状态失败');
    } finally {
      setUpdatingUserId('');
    }
  };

  const columns = [
    {
      title: '账号',
      dataIndex: 'username',
      width: 220
    },
    {
      title: '显示名称',
      dataIndex: 'name'
    },
    {
      title: '人员类型',
      dataIndex: 'role',
      width: 180,
      render: (role) => <Tag color={role === 'ADMIN' ? 'red' : 'blue'}>{ROLE_LABELS[role] || role}</Tag>
    },
    {
      title: '部门',
      dataIndex: 'department',
      render: (value) => value || '-'
    },
    {
      title: '状态',
      dataIndex: 'availabilityStatus',
      width: 120,
      render: (value) => (
        <Tag color={value === 'OFFLINE' ? 'default' : 'success'}>
          {value === 'OFFLINE' ? '下线' : '在线'}
        </Tag>
      )
    },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Switch
          checked={record.availabilityStatus !== 'OFFLINE'}
          checkedChildren="上线"
          unCheckedChildren="下线"
          loading={updatingUserId === record.id}
          onChange={(checked) => handleAvailabilityChange(record, checked)}
        />
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      {error && <Alert type="error" showIcon message={error} />}
      <Card
        title="账号管理"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadUsers} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增账号
            </Button>
          </Space>
        )}
      >
        <Typography.Paragraph type="secondary">
          管理员可创建全部人员类型账号；公开注册入口不允许创建管理员账号。
        </Typography.Paragraph>
        <Space className="admin-config-toolbar" style={{ marginBottom: 16 }}>
          <Input.Search
            allowClear
            placeholder="按账号或姓名筛选"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onSearch={setSearchText}
            style={{ width: 280 }}
          />
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredUsers}
          columns={columns}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个账号`
          }}
          size="middle"
        />
      </Card>
      <Modal
        title="新增账号"
        open={modalOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={saving}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ role: 'REQUESTER' }}>
          <Form.Item name="role" label="人员类型" rules={[{ required: true, message: '请选择人员类型' }]}>
            <Radio.Group options={ROLE_OPTIONS} optionType="button" buttonStyle="solid" />
          </Form.Item>
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserAddOutlined />} placeholder="请输入账号" allowClear />
          </Form.Item>
          <Form.Item name="name" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="请输入显示名称" allowClear />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少 6 位' }
            ]}
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

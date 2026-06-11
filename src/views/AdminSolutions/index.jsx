'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

const API_URL = '/api/admin/solutions';

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

export default function AdminSolutionsPage() {
  const { message } = AntdApp.useApp();
  const [solutions, setSolutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSolution, setEditingSolution] = useState(null);
  const [form] = Form.useForm();

  const loadSolutions = async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载方案库失败');
      }
      setSolutions(data.solutions || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载方案库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSolutions();
  }, []);

  const openCreateModal = () => {
    setEditingSolution(null);
    form.setFieldsValue({
      code: '',
      title: '',
      description: '',
      detail: '',
      enabled: true
    });
    setModalOpen(true);
  };

  const openEditModal = (solution) => {
    setEditingSolution(solution);
    form.setFieldsValue({
      code: solution.code,
      title: solution.title,
      description: solution.description,
      detail: solution.detailText || solution.description,
      enabled: solution.enabled !== false
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const input = {
      code: values.code,
      title: values.title,
      description: values.description,
      detail: values.detail,
      enabled: values.enabled !== false,
      ticketTypes: ['DATA_FIX'],
      referencePermission: 'COMPANY'
    };
    const url = editingSolution ? `${API_URL}/${editingSolution.id}` : API_URL;
    const method = editingSolution ? 'PUT' : 'POST';
    setSaving(true);
    try {
      const { response, data } = await requestJson(url, {
        method,
        body: JSON.stringify(input)
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '保存方案失败');
      }
      message.success('方案已保存');
      setModalOpen(false);
      await loadSolutions();
    } catch (error) {
      console.error(error);
      message.error(error.message || '保存方案失败');
    } finally {
      setSaving(false);
    }
  };

  const removeSolution = async (solution) => {
    setSaving(true);
    try {
      const { response, data } = await requestJson(`${API_URL}/${solution.id}`, { method: 'DELETE' });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '删除方案失败');
      }
      message.success('方案已删除');
      await loadSolutions();
    } catch (error) {
      console.error(error);
      message.error(error.message || '删除方案失败');
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (solution, enabled) => {
    const { response, data } = await requestJson(`${API_URL}/${solution.id}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
    if (!response.ok || data?.ok === false) {
      message.error(data?.reason || '更新启用状态失败');
      return;
    }
    message.success(enabled ? '方案已启用' : '方案已停用');
    await loadSolutions();
  };

  const columns = useMemo(
    () => [
      {
        title: '方案编码',
        dataIndex: 'code',
        width: 160,
        render: (value) => <Typography.Text code>{value || '-'}</Typography.Text>
      },
      {
        title: '方案标题',
        dataIndex: 'title',
        width: 220,
        render: (value) => <Typography.Text strong>{value || '-'}</Typography.Text>
      },
      {
        title: '方案描述',
        dataIndex: 'description',
        render: (value) => (
          <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
            {value || '-'}
          </Typography.Paragraph>
        )
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 130,
        render: (enabled, record) => (
          <Space>
            <Tag color={enabled === false ? 'default' : 'green'}>
              {enabled === false ? '停用' : '启用'}
            </Tag>
            <Switch
              size="small"
              checked={enabled !== false}
              checkedChildren="启用"
              unCheckedChildren="停用"
              onChange={(checked) => toggleEnabled(record, checked)}
            />
          </Space>
        )
      },
      {
        title: '版本',
        dataIndex: 'versionNo',
        width: 80,
        render: (value) => `v${value || 1}`
      },
      {
        title: '引用次数',
        dataIndex: ['stats', 'referenceCount'],
        width: 100,
        render: (value) => value || 0
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_value, record) => (
          <Space>
            <Button size="small" onClick={() => openEditModal(record)}>
              编辑
            </Button>
            <Popconfirm
              title="删除方案"
              description="删除后当前列表不再展示，历史版本和引用记录仍保留。"
              okText="删除"
              cancelText="取消"
              onConfirm={() => removeSolution(record)}
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [solutions]
  );

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>标准解决方案库</Typography.Title>
            <Typography.Text type="secondary">
              替换原数据修正方案配置，统一维护可引用的标准处理方案。
            </Typography.Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSolutions} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增方案
            </Button>
          </Space>
        </div>
      </Card>

      <Spin spinning={loading || saving}>
        <Card title="方案列表">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={solutions}
            locale={{ emptyText: <Empty description="暂无方案" /> }}
          />
        </Card>
      </Spin>

      <Modal
        title={editingSolution ? '编辑方案' : '新增方案'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="方案编码"
            rules={[{ required: true, message: '请输入方案编码' }]}
          >
            <Input maxLength={40} showCount allowClear disabled={Boolean(editingSolution)} />
          </Form.Item>
          <Form.Item
            name="title"
            label="方案标题"
            rules={[{ required: true, message: '请输入方案标题' }]}
          >
            <Input maxLength={80} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="description"
            label="方案描述"
            rules={[{ required: true, message: '请输入方案描述' }]}
          >
            <Input.TextArea rows={4} maxLength={1000} showCount allowClear />
          </Form.Item>
          <Form.Item
            name="detail"
            label="详细说明"
            rules={[{ required: true, message: '请输入详细说明' }]}
          >
            <Input.TextArea rows={6} maxLength={4000} showCount allowClear />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

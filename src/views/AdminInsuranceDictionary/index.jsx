'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { formatDateTime } from '../../utils/format.js';

const API_URL = '/api/config/admin/dictionaries/insurance-types';

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

export default function AdminInsuranceDictionaryPage() {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [togglingId, setTogglingId] = useState('');

  const loadItems = async () => {
    setLoading(true);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载险种词典失败');
      }
      setItems(data.items || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || '加载险种词典失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    form.setFieldsValue({ code: '', name: '', enabled: true });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    form.setFieldsValue({
      code: item.code,
      name: item.name,
      enabled: item.enabled
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setError('');
    try {
      const url = editingItem ? `${API_URL}/${editingItem.id}` : API_URL;
      const { response, data } = await requestJson(url, {
        method: editingItem ? 'PATCH' : 'POST',
        body: JSON.stringify(values)
      });

      if (!response.ok || data?.ok === false) {
        throw new Error(formatValidationMessage(data, editingItem ? '更新险种失败' : '新增险种失败'));
      }

      setModalOpen(false);
      message.success(editingItem ? '险种已更新' : '险种已新增');
      await loadItems();
    } catch (submitError) {
      console.error(submitError);
      setError(submitError.message || '保存险种失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (item, enabled) => {
    setTogglingId(item.id);
    setError('');
    try {
      const { response, data } = await requestJson(`${API_URL}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled })
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '更新险种状态失败');
      }
      setItems((prev) => prev.map((prevItem) => (prevItem.id === item.id ? data.item : prevItem)));
      message.success(enabled ? '险种已启用' : '险种已停用');
    } catch (toggleError) {
      console.error(toggleError);
      setError(toggleError.message || '更新险种状态失败');
    } finally {
      setTogglingId('');
    }
  };

  const columns = [
    {
      title: '险种编码',
      dataIndex: 'code',
      width: 180,
      render: (value) => <Tag color="blue">{value}</Tag>
    },
    {
      title: '险种名称',
      dataIndex: 'name'
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      width: 130,
      render: (enabled, item) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          loading={togglingId === item.id}
          onChange={(nextEnabled) => handleToggleEnabled(item, nextEnabled)}
        />
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 190,
      render: (value) => formatDateTime(value)
    },
    {
      title: '操作',
      width: 110,
      render: (_, item) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(item)}>
          编辑
        </Button>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      {error && <Alert type="error" showIcon message={error} />}
      <Card
        title="险种词典"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增险种
            </Button>
          </Space>
        )}
      >
        <Typography.Paragraph type="secondary">
          排班配置只能选择已启用的险种；停用不会删除已有历史配置。
        </Typography.Paragraph>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={false}
          size="middle"
        />
      </Card>
      <Modal
        title={editingItem ? '编辑险种' : '新增险种'}
        open={modalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ enabled: true }}>
          <Form.Item name="code" label="险种编码" rules={[{ required: true, message: '请输入险种编码' }]}>
            <Input allowClear placeholder="例如 MEDICAL" />
          </Form.Item>
          <Form.Item name="name" label="险种名称" rules={[{ required: true, message: '请输入险种名称' }]}>
            <Input allowClear placeholder="例如 医疗险" />
          </Form.Item>
          <Form.Item name="enabled" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function formatValidationMessage(data, fallback) {
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.map((item) => item.message).join('；');
  }
  return data?.reason || fallback;
}

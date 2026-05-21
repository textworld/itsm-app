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
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { SYSTEM_CATEGORY_LABELS, SYSTEM_CATEGORY_OPTIONS } from '../../constants/systems.js';

const API_URL = '/api/admin/systems';

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

export default function AdminSystemsPage() {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [error, setError] = useState('');

  const loadSystems = async () => {
    setLoading(true);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载系统配置失败');
      }
      setSystems(data.config?.systems || []);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message || '加载系统配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystems();
  }, []);

  const saveSystems = async (nextSystems) => {
    setSaving(true);
    setError('');
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ systems: nextSystems })
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(formatValidationMessage(data, '保存系统配置失败'));
      }
      setSystems(data.config?.systems || []);
      message.success('系统配置已保存');
      return true;
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || '保存系统配置失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setEditingSystem(null);
    form.setFieldsValue({ code: '', name: '', category: 'OLD', visibleInSubmit: true });
    setModalOpen(true);
  };

  const openEditModal = (system) => {
    setEditingSystem(system);
    form.setFieldsValue({
      code: system.code,
      name: system.name,
      category: system.category,
      visibleInSubmit: system.visibleInSubmit !== false
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const nextSystem = {
      id: editingSystem?.id || `sys_${Date.now().toString(36)}`,
      code: values.code,
      name: values.name,
      category: values.category,
      visibleInSubmit: values.visibleInSubmit !== false
    };
    const nextSystems = editingSystem
      ? systems.map((system) => (system.id === editingSystem.id ? nextSystem : system))
      : [nextSystem, ...systems];
    const ok = await saveSystems(nextSystems);
    if (ok) setModalOpen(false);
  };

  const removeSystem = async (system) => {
    await saveSystems(systems.filter((item) => item.id !== system.id));
  };

  const columns = [
    {
      title: '系统编码',
      dataIndex: 'code',
      width: 180,
      render: (value) => <Tag color="blue">{value}</Tag>
    },
    {
      title: '系统名称',
      dataIndex: 'name'
    },
    {
      title: '新老系统标签',
      dataIndex: 'category',
      width: 140,
      render: (value) => SYSTEM_CATEGORY_LABELS[value] || value
    },
    {
      title: '是否显示在前台',
      dataIndex: 'visibleInSubmit',
      width: 160,
      render: (value) => (value === false ? '否' : '是')
    },
    {
      title: '操作',
      width: 170,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Popconfirm
            title="删除系统"
            description="确认删除该系统？历史工单中的系统名称不会被修改。"
            okText="删除"
            cancelText="取消"
            onConfirm={() => removeSystem(record)}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      {error && <Alert type="error" showIcon message={error} />}
      <Card
        title="系统配置"
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSystems} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              新增系统
            </Button>
          </Space>
        )}
      >
        <Typography.Paragraph type="secondary">
          维护工单中可选择的系统。关闭“是否显示在前台”后，提交工单、排班、转交、子任务和信息补充等选择框均不再展示该系统，历史工单名称保持不变。
        </Typography.Paragraph>
        <Table
          rowKey="id"
          loading={loading || saving}
          dataSource={systems}
          columns={columns}
          pagination={false}
        />
      </Card>

      <Modal
        title={editingSystem ? '编辑系统' : '新增系统'}
        open={modalOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ category: 'OLD', visibleInSubmit: true }}>
          <Form.Item name="code" label="系统编码" rules={[{ required: true, message: '请输入系统编码' }]}>
            <Input allowClear placeholder="例如 ERP_CORE" />
          </Form.Item>
          <Form.Item name="name" label="系统名称" rules={[{ required: true, message: '请输入系统名称' }]}>
            <Input allowClear placeholder="例如 ERP 核心系统" />
          </Form.Item>
          <Form.Item name="category" label="新老系统标签" rules={[{ required: true, message: '请选择新老系统标签' }]}>
            <Select options={SYSTEM_CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="visibleInSubmit" label="是否显示在前台" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
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

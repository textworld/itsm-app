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
  Table,
  Typography
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

const API_URL = '/api/config/admin/data-fix-schemes';

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

export default function AdminDataFixSchemesPage() {
  const { message } = AntdApp.useApp();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState(null);
  const [form] = Form.useForm();

  const loadSchemes = async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载数据修正方案失败');
      }
      setSchemes(data.config?.schemes || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载数据修正方案失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchemes();
  }, []);

  const saveSchemes = async (nextSchemes) => {
    setSaving(true);
    try {
      const { response, data } = await requestJson(API_URL, {
        method: 'PUT',
        body: JSON.stringify({ schemes: nextSchemes })
      });
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '保存数据修正方案失败');
      }
      setSchemes(data.config?.schemes || []);
      message.success('数据修正方案已保存');
      return true;
    } catch (error) {
      console.error(error);
      message.error(error.message || '保存数据修正方案失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setEditingScheme(null);
    form.setFieldsValue({ title: '', description: '' });
    setModalOpen(true);
  };

  const openEditModal = (scheme) => {
    setEditingScheme(scheme);
    form.setFieldsValue({
      title: scheme.title,
      description: scheme.description
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const nextScheme = {
      id: editingScheme?.id || `scheme_${Date.now().toString(36)}`,
      title: values.title,
      description: values.description
    };
    const nextSchemes = editingScheme
      ? schemes.map((scheme) => (scheme.id === editingScheme.id ? nextScheme : scheme))
      : [nextScheme, ...schemes];
    const ok = await saveSchemes(nextSchemes);
    if (ok) setModalOpen(false);
  };

  const removeScheme = async (scheme) => {
    await saveSchemes(schemes.filter((item) => item.id !== scheme.id));
  };

  const columns = useMemo(
    () => [
      {
        title: '方案标题',
        dataIndex: 'title',
        width: 260,
        render: (value) => <Typography.Text strong>{value || '-'}</Typography.Text>
      },
      {
        title: '方案描述',
        dataIndex: 'description',
        render: (value) => (
          <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
            {value || '-'}
          </Typography.Paragraph>
        )
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
              description="确认删除该数据修正方案？"
              okText="删除"
              cancelText="取消"
              onConfirm={() => removeScheme(record)}
            >
              <Button size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      }
    ],
    [schemes]
  );

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>数据修正方案</Typography.Title>
            <Typography.Text type="secondary">
              维护提单人在生产系统数据修正工单中可选择的标准方案。
            </Typography.Text>
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadSchemes} loading={loading}>
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
            dataSource={schemes}
            locale={{ emptyText: <Empty description="暂无数据修正方案" /> }}
          />
        </Card>
      </Spin>

      <Modal
        title={editingScheme ? '编辑数据修正方案' : '新增数据修正方案'}
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
            <Input.TextArea rows={6} maxLength={1000} showCount allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

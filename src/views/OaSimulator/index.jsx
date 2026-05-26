'use client';

import React, { useEffect, useState } from 'react';
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { STATUS_LABELS } from '../../constants/ticketStatus.js';
import { TOOL_TYPE_LABELS } from '../../constants/toolTypes.js';
import { formatDateTime } from '../../utils/format.js';

const API_URL = '/api/approval/applications';

const ACTION_OPTIONS = [
  { label: 'ITSM 通过并生成正式工单', value: 'GENERATE_TICKET' },
  { label: 'ITSM 直接办结', value: 'DIRECT_CLOSE' },
  { label: 'OA 拒绝退回草稿', value: 'REJECT' },
  { label: 'OA 重新打开', value: 'REOPEN' },
  { label: '重新审批后继续处理', value: 'REAPPROVE_GENERATE' },
  { label: '重新审批后无需处理', value: 'REAPPROVE_CLOSE' }
];

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

export default function OaSimulatorPage() {
  const { message } = AntdApp.useApp();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionOpen, setActionOpen] = useState(false);
  const [activeApplication, setActiveApplication] = useState(null);
  const [posting, setPosting] = useState(false);
  const [form] = Form.useForm();

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { response, data } = await requestJson(API_URL);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || '加载 OA 申请单失败');
      }
      setApplications(data.applications || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载 OA 申请单失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const openActionModal = (application, action = 'GENERATE_TICKET') => {
    setActiveApplication(application);
    form.setFieldsValue({
      action,
      opinion: '',
      operatorName: '',
      attachments: []
    });
    setActionOpen(true);
  };

  const postOaAction = async () => {
    if (!activeApplication) return;
    const values = await form.validateFields();
    setPosting(true);
    try {
      const { response, data } = await requestJson(
        `${API_URL}/${activeApplication.oaId}/actions`,
        {
          method: 'POST',
          body: JSON.stringify({
            action: values.action,
            opinion: values.opinion || '',
            attachments: [],
            operatorName: values.operatorName || '',
            handledAt: new Date().toISOString()
          })
        }
      );
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || 'OA 操作失败');
      }
      message.success('OA 操作已提交');
      setActionOpen(false);
      await loadApplications();
    } catch (error) {
      console.error(error);
      message.error(error.message || 'OA 操作失败');
    } finally {
      setPosting(false);
    }
  };

  const columns = [
    {
      title: 'OA 编号',
      dataIndex: 'oaId',
      width: 160,
      render: (value) => <Typography.Text copyable>{value}</Typography.Text>
    },
    {
      title: '工单',
      dataIndex: 'title',
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value || '-'}</Typography.Text>
          <Typography.Text type="secondary">{record.ticketId}</Typography.Text>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'toolType',
      width: 180,
      render: (value) => TOOL_TYPE_LABELS[value] || value || '-'
    },
    {
      title: '状态',
      dataIndex: 'ticketStatus',
      width: 120,
      render: (value) => <Tag color="blue">{STATUS_LABELS[value] || value || '-'}</Tag>
    },
    {
      title: 'OA 状态',
      dataIndex: 'oaStatus',
      width: 150,
      render: (value) => <Tag>{value || '-'}</Tag>
    },
    {
      title: '标记',
      key: 'flags',
      width: 180,
      render: (_value, record) => (
        <Space wrap>
          {record.oaLocked && <Tag color="orange">锁定</Tag>}
          {record.formalTicketCreated && <Tag color="green">正式工单</Tag>}
        </Space>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 180,
      render: (value) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 360,
      render: (_value, record) => (
        <Space wrap>
          <Button size="small" type="primary" onClick={() => openActionModal(record, 'GENERATE_TICKET')}>
            生成工单
          </Button>
          <Button size="small" onClick={() => openActionModal(record, 'DIRECT_CLOSE')}>
            直接办结
          </Button>
          <Button size="small" danger onClick={() => openActionModal(record, 'REJECT')}>
            拒绝退回
          </Button>
          <Button size="small" onClick={() => openActionModal(record, 'REOPEN')}>
            重新打开
          </Button>
          <Button size="small" onClick={() => openActionModal(record, 'REAPPROVE_GENERATE')}>
            继续处理
          </Button>
          <Button size="small" onClick={() => openActionModal(record, 'REAPPROVE_CLOSE')}>
            无需处理
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Space direction="vertical" size="middle" className="admin-config-page">
      <Card>
        <div className="admin-config-toolbar">
          <Space direction="vertical" size={2}>
            <Typography.Title level={5} style={{ margin: 0 }}>OA 模拟审批台</Typography.Title>
            <Typography.Text type="secondary">
              管理员在这里模拟 OA 审批、办结和重新打开动作，所有状态变化通过工单状态机执行。
            </Typography.Text>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadApplications} loading={loading}>
            刷新
          </Button>
        </div>
      </Card>

      <Alert
        type="info"
        showIcon
        message="模拟 OA 闭环"
        description="本页不连接真实 OA，仅用于在系统内完成审批类工单的状态流转演示。"
      />

      <Spin spinning={loading}>
        <Card title="OA 申请单列表">
          <Table
            rowKey="oaId"
            columns={columns}
            dataSource={applications}
            scroll={{ x: 1200 }}
            locale={{ emptyText: <Empty description="暂无 OA 申请单" /> }}
          />
        </Card>
      </Spin>

      <Modal
        title={`处理 OA 申请单 ${activeApplication?.oaId || ''}`}
        open={actionOpen}
        onOk={postOaAction}
        onCancel={() => setActionOpen(false)}
        confirmLoading={posting}
        okText="提交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="action"
            label="动作"
            rules={[{ required: true, message: '请选择 OA 动作' }]}
          >
            <Select options={ACTION_OPTIONS} />
          </Form.Item>
          <Form.Item name="operatorName" label="操作人">
            <Input placeholder="留空则使用当前管理员" />
          </Form.Item>
          <Form.Item name="opinion" label="审批意见">
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

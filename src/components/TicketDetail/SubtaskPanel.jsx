import React, { useState } from 'react';
import { App as AntdApp, Button, Card, Checkbox, Empty, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLES } from '../../constants/roles.js';
import {
  SYSTEM_CATEGORY,
  SYSTEM_CATEGORY_OPTIONS,
  SYSTEM_LABELS,
  getSystemOptionsByCategory
} from '../../constants/systems.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { TICKET_ACTIONS, canPerformTicketAction } from '../../permissions/ticketPermissionMatrix.js';
import { listAssignableSubtaskAssignees } from '../../utils/subtaskRouting.js';

const SUBTASK_STATUS_LABELS = {
  PENDING: '待受理',
  PROCESSING: '处理中',
  COMPLETED: '已完成'
};

export default function SubtaskPanel({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [form] = Form.useForm();
  const [completeForm] = Form.useForm();

  if (![ROLES.L1, ROLES.L2].includes(user?.role)) {
    return (
      <Card>
        <Empty description="子任务仅技术支持可见" />
      </Card>
    );
  }

  const subtasks = ticket.subtasks || [];
  const canCreateSubtask = canPerformTicketAction(ticket, user, TICKET_ACTIONS.CREATE_SUBTASK);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const assignee = listAssignableSubtaskAssignees().find((item) => item.id === values.assigneeId);
    const result = await dispatchEvent(ticket.id, EVENTS.CREATE_SUBTASK, {
      subtask: {
        systemCategory: values.systemCategory,
        systemCode: values.systemName,
        systemName: SYSTEM_LABELS[values.systemName] || values.systemName,
        description: values.description.trim(),
        assigneeId: assignee?.id || null,
        assigneeName: assignee?.name || null,
        assigneeRole: assignee?.role || null
      },
      subtaskTicket: true
    });
    if (!result.ok) {
      message.error(result.reason || '创建子任务失败');
      return;
    }
    form.resetFields();
    setCreateOpen(false);
    message.success(assignee ? '子任务工单已创建并指定处理人' : '子任务工单已创建，等待技术支持认领');
  };

  const handleStart = async (subtask) => {
    const result = await dispatchEvent(ticket.id, EVENTS.START_SUBTASK, {
      subtaskId: subtask.id
    });
    if (!result.ok) {
      message.error(result.reason || '开始处理失败');
      return;
    }
    message.success('子任务已进入处理中');
  };

  const handleComplete = async () => {
    const values = await completeForm.validateFields();
    const result = await dispatchEvent(ticket.id, EVENTS.COMPLETE_SUBTASK, {
      subtaskId: completeTarget.id,
      noMainTicketActionRequired: values.noMainTicketActionRequired === true
    });
    if (!result.ok) {
      message.error(result.reason || '完成子任务失败');
      return;
    }
    completeForm.resetFields();
    setCompleteTarget(null);
    message.success('子任务已完成');
  };

  const columns = [
    {
      title: '系统',
      dataIndex: 'systemName',
      width: 180
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '处理人',
      dataIndex: 'assigneeName',
      width: 180
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => <Tag color={status === 'COMPLETED' ? 'success' : status === 'PROCESSING' ? 'processing' : 'warning'}>{SUBTASK_STATUS_LABELS[status] || status}</Tag>
    },
    {
      title: '操作',
      width: 170,
      render: (_, subtask) => (
        <Space>
          {subtask.status === 'PENDING' && <Button size="small" onClick={() => handleStart(subtask)}>开始处理</Button>}
          {subtask.status !== 'COMPLETED' && <Button size="small" type="primary" onClick={() => setCompleteTarget(subtask)}>完成</Button>}
        </Space>
      )
    }
  ];

  return (
    <Card
      title="子任务"
      extra={
        canCreateSubtask && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建子任务
          </Button>
        )
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Typography.Text type="secondary">
          子任务可按新老系统拆分，创建后按系统默认处理人自动派工。所有子任务完成后，一线才能发起办结。
        </Typography.Text>
        <Table rowKey="id" columns={columns} dataSource={subtasks} pagination={false} locale={{ emptyText: '暂无子任务' }} />
      </Space>

      <Modal
        title="创建子任务"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ systemCategory: SYSTEM_CATEGORY.OLD }}>
          <Form.Item name="systemCategory" label="新老系统标签" rules={[{ required: true, message: '请选择新老系统标签' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={SYSTEM_CATEGORY_OPTIONS}
              onChange={() => form.setFieldValue('systemName', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCategory !== current.systemCategory}>
            {({ getFieldValue }) => (
              <Form.Item name="systemName" label="系统名称" rules={[{ required: true, message: '请选择系统名称' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  onChange={() => form.setFieldValue('assigneeId', undefined)}
                  options={getSystemOptionsByCategory(getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemName !== current.systemName}>
            {({ getFieldValue }) => (
              <Form.Item name="assigneeId" label="指定处理人">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="可为空，留空后由对应系统技术支持认领"
                  options={listAssignableSubtaskAssignees().map((item) => ({
                    label: `${item.name} · ${item.role === ROLES.L2 ? '二线' : '一线'}`,
                    value: item.id
                  }))}
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true, message: '请填写子任务描述' }]}>
            <Input.TextArea rows={4} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="完成子任务"
        open={Boolean(completeTarget)}
        onOk={handleComplete}
        onCancel={() => setCompleteTarget(null)}
        okText="完成"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={completeForm} layout="vertical" initialValues={{ noMainTicketActionRequired: false }}>
          <Form.Item name="noMainTicketActionRequired" valuePropName="checked">
            <Checkbox>本工单无需处理</Checkbox>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

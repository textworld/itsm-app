import React, { useState } from 'react';
import { App as AntdApp, Button, Card, Form, Modal, Select, Space, Typography } from 'antd';
import { CheckCircleOutlined, SwapOutlined, UserAddOutlined } from '@ant-design/icons';
import { useTickets } from '../../context/TicketContext.jsx';
import { SUBTASK_STATUS, SUBTASK_STATUS_LABELS } from '../../constants/subtaskStatus.js';
import {
  SYSTEM_CATEGORY,
  SYSTEM_CATEGORY_OPTIONS,
  getSystemOptionsByCategory,
  resolveSelectedSystem
} from '../../constants/systems.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { listSubtaskAssignees } from '../../utils/subtaskRouting.js';
import { useSupportAssignees } from '../../hooks/useSupportAssignees.js';
import { useSystems } from '../../hooks/useSystems.js';

export default function SubtaskActions({ ticket }) {
  const { dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm] = Form.useForm();
  const isCompleted = ticket.subtaskStatus === SUBTASK_STATUS.COMPLETED;
  const supportAssignees = useSupportAssignees();
  const { systems, loading: systemsLoading } = useSystems();

  const handleDispatch = async (event, payload = {}, successText = '操作成功') => {
    const result = await dispatchEvent(ticket.id, event, payload);
    if (!result.ok) {
      message.error(result.reason || '操作失败');
      return;
    }
    message.success(successText);
  };

  const handleOpenTransfer = () => {
    transferForm.setFieldsValue({
      systemCategory: ticket.systemCategory || SYSTEM_CATEGORY.OLD,
      systemCode: ticket.systemCode,
      assigneeId: undefined
    });
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    const values = await transferForm.validateFields();
    const selectedSystem = resolveSelectedSystem(systems, values.systemCode);
    const assignee = getOnlineSubtaskAssignees(values.systemCode, supportAssignees)
      .find((item) => item.id === values.assigneeId);
    await handleDispatch(
      EVENTS.TRANSFER_SUBTASK,
      {
        systemCategory: selectedSystem?.category || values.systemCategory,
        systemCode: selectedSystem?.code || values.systemCode,
        systemName: selectedSystem?.name || values.systemCode,
        systemDisplayName: selectedSystem?.name || values.systemCode,
        assigneeId: assignee?.id || null,
        assigneeName: assignee?.name || null,
        assigneeRole: assignee?.role || null
      },
      '子任务已转派'
    );
    setTransferOpen(false);
  };

  return (
    <Card title="子任务操作区">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Typography.Text type="secondary">
          当前子任务状态：{SUBTASK_STATUS_LABELS[ticket.subtaskStatus] || ticket.subtaskStatus}
        </Typography.Text>
        <Space wrap>
          {ticket.subtaskStatus === SUBTASK_STATUS.PENDING && !ticket.assigneeL1Id && !ticket.assigneeL2Id && (
            <Button icon={<UserAddOutlined />} onClick={() => handleDispatch(EVENTS.CLAIM_SUBTASK, {}, '子任务已认领')}>
              认领
            </Button>
          )}
          {!isCompleted && (
            <>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleDispatch(EVENTS.COMPLETE_SUBTASK, {}, '子任务已完成')}
              >
                已完成
              </Button>
              <Button onClick={() => handleDispatch(EVENTS.NO_ACTION_SUBTASK, {}, '子任务已标记为无需处理')}>
                无需处理
              </Button>
              <Button icon={<SwapOutlined />} onClick={handleOpenTransfer}>
                转派
              </Button>
            </>
          )}
        </Space>
      </Space>
      <Modal
        title="转派子任务"
        open={transferOpen}
        onOk={handleTransfer}
        onCancel={() => setTransferOpen(false)}
        okText="确认转派"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={transferForm} layout="vertical">
          <Form.Item name="systemCategory" label="新老系统标签" rules={[{ required: true, message: '请选择新老系统标签' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={SYSTEM_CATEGORY_OPTIONS}
              onChange={() => transferForm.setFieldValue('systemCode', undefined)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCategory !== current.systemCategory}>
            {({ getFieldValue }) => (
              <Form.Item name="systemCode" label="系统名称" rules={[{ required: true, message: '请选择系统名称' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  onChange={() => transferForm.setFieldValue('assigneeId', undefined)}
                  loading={systemsLoading}
                  options={getSystemOptionsByCategory(systems, getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
                />
              </Form.Item>
            )}
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCode !== current.systemCode}>
            {({ getFieldValue }) => (
              <Form.Item name="assigneeId" label="处理人" rules={[{ required: true, message: '请选择处理人' }]}>
                <Select
                  options={getOnlineSubtaskAssignees(getFieldValue('systemCode'), supportAssignees).map((item) => ({
                    label: item.name,
                    value: item.id
                  }))}
                />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

function getOnlineSubtaskAssignees(systemCode, supportAssignees) {
  const defaultRole = listSubtaskAssignees(systemCode)[0]?.role;
  if (!defaultRole) return [];
  return supportAssignees.filter((item) => item.role === defaultRole);
}

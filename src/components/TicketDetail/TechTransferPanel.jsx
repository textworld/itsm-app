import React, { useState } from 'react';
import { App as AntdApp, Button, Form, Modal, Radio, Select } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { ROLES } from '../../constants/roles.js';
import { SYSTEM_CATEGORY_OPTIONS, getSystemOptionsByCategory } from '../../constants/systems.js';
import { useSupportAssignees } from '../../hooks/useSupportAssignees.js';

export default function TechTransferPanel({
  ticket,
  role,
  buttonText = '转给其他技术支持',
  modalTitle = '转给其他技术支持'
}) {
  const { user } = useAuth();
  const { dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const onlineAssignees = useSupportAssignees(role);
  const assignees = onlineAssignees.filter((assignee) => assignee.id !== user?.id);
  const requiresTargetSystem = role === ROLES.L1;

  const handleOpen = () => {
    form.setFieldsValue({
      communicated: false,
      assigneeId: undefined,
      targetSystemCategory: undefined,
      targetSystemCode: undefined
    });
    setOpen(true);
  };

  const handleTransfer = async () => {
    const values = await form.validateFields();
    const assignee = values.communicated
      ? assignees.find((item) => item.id === values.assigneeId)
      : null;
    const targetSystem = !values.communicated && requiresTargetSystem
      ? getSystemOptionsByCategory(values.targetSystemCategory).find((item) => item.value === values.targetSystemCode)
      : null;

    const result = await dispatchEvent(ticket.id, EVENTS.TRANSFER_TECH, {
      targetRole: role,
      assigneeId: values.communicated ? assignee?.id || null : null,
      assigneeName: values.communicated ? assignee?.name || null : null,
      communicated: values.communicated === true,
      autoAssign: values.communicated !== true,
      ...(targetSystem
        ? {
            targetSystemCategory: values.targetSystemCategory,
            targetSystemCode: values.targetSystemCode,
            targetSystemName: targetSystem?.label
          }
        : {}),
      __timelineRemark: values.communicated
        ? `技术支持已提前沟通并转交给 ${assignee?.name || '指定处理人'}`
        : `技术支持选择系统自动派工${targetSystem ? `，目标系统：${targetSystem.label}` : ''}`
    });

    if (!result.ok) {
      message.error(result.reason || '转交失败');
      return;
    }
    setOpen(false);
    message.success('已完成同角色转交');
  };

  return (
    <>
      <Button icon={<SwapOutlined />} onClick={handleOpen}>
        {buttonText}
      </Button>
      <Modal
        title={modalTitle}
        open={open}
        onOk={handleTransfer}
        onCancel={() => setOpen(false)}
        okText="确认转交"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ communicated: false }}>
          <Form.Item name="communicated" label="是否提前沟通" rules={[{ required: true, message: '请选择是否提前沟通' }]}>
            <Radio.Group
              options={[
                { label: '是，指定处理人', value: true },
                { label: '否，系统自动派工', value: false }
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.communicated !== current.communicated}>
            {({ getFieldValue }) =>
              getFieldValue('communicated') ? (
                <Form.Item name="assigneeId" label="处理人" rules={[{ required: true, message: '请选择处理人' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={assignees.map((item) => ({ label: item.name, value: item.id }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.communicated !== current.communicated ||
              previous.targetSystemCategory !== current.targetSystemCategory
            }
          >
            {({ getFieldValue }) => {
              if (getFieldValue('communicated') || !requiresTargetSystem) {
                return null;
              }

              const targetSystemCategory = getFieldValue('targetSystemCategory');
              const targetSystemOptions = targetSystemCategory
                ? getSystemOptionsByCategory(targetSystemCategory).filter((option) => option.value !== ticket.systemCode)
                : [];

              return (
                <>
                  <Form.Item
                    name="targetSystemCategory"
                    label="新老系统标签"
                    rules={[{ required: true, message: '请选择新老系统标签' }]}
                  >
                    <Select
                      options={SYSTEM_CATEGORY_OPTIONS}
                      onChange={() => form.setFieldValue('targetSystemCode', undefined)}
                    />
                  </Form.Item>
                  <Form.Item
                    name="targetSystemCode"
                    label="系统名称"
                    rules={[{ required: true, message: '请选择其他系统' }]}
                  >
                    <Select
                      showSearch
                      optionFilterProp="label"
                      placeholder="请选择其他系统"
                      options={targetSystemOptions}
                    />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

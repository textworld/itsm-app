import React, { useState } from 'react';
import { App as AntdApp, Button, Form, Modal, Radio, Select } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { listSameRoleAssignees, routeTechTransferAssignee } from '../../utils/techTransferRouting.js';

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
  const assignees = listSameRoleAssignees(role).filter((assignee) => assignee.id !== user?.id);

  const handleOpen = () => {
    form.setFieldsValue({
      communicated: false,
      assigneeId: undefined
    });
    setOpen(true);
  };

  const handleTransfer = async () => {
    const values = await form.validateFields();
    const assignee = values.communicated
      ? assignees.find((item) => item.id === values.assigneeId)
      : routeTechTransferAssignee(role, user?.id);

    const result = await dispatchEvent(ticket.id, EVENTS.TRANSFER_TECH, {
      targetRole: role,
      assigneeId: assignee?.id || null,
      assigneeName: assignee?.name || null,
      communicated: values.communicated === true,
      __timelineRemark: values.communicated
        ? `技术支持已提前沟通并转交给 ${assignee?.name || '指定处理人'}`
        : `技术支持按系统默认派工转交给 ${assignee?.name || '默认处理人'}`
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
        </Form>
      </Modal>
    </>
  );
}

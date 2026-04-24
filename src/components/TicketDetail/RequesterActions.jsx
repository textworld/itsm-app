import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Modal,
  Input,
  Form,
  Typography,
  Alert,
  App as AntdApp
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useTickets } from '../../context/TicketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { STATUS, getRequesterStatus } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import SatisfactionModal from './SatisfactionModal.jsx';
import { shortId } from '../../utils/idGenerator.js';

/**
 * 提单人操作区
 * - 仅在 VERIFYING 状态下显示"验证解决"（是/否）
 *   - 是：弹出满意度评价 → 提交后流转为 CLOSED
 *   - 否：Modal 填写驳回原因 → 流转回 PROCESSING，并追加系统留言
 * - CLOSED 且已评价时，展示评价摘要
 */
export default function RequesterActions({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [satOpen, setSatOpen] = useState(false);
  const [rejectForm] = Form.useForm();

  if (!user) return null;

  const requesterStatus = getRequesterStatus(ticket);

  if (requesterStatus === STATUS.CLOSED) {
    return (
      <Card title="提单人操作区">
        <Alert
          type="success"
          showIcon
          message="工单已办结"
          description={
            ticket.satisfaction
              ? `您给出的满意度评价：★${ticket.satisfaction.rating}/5 ${ticket.satisfaction.comment ? '· ' + ticket.satisfaction.comment : ''}`
              : '本工单已办结。'
          }
        />
      </Card>
    );
  }

  if (requesterStatus === STATUS.INFO_SUPPLEMENT) {
    const handleCompleteInfoSupplement = () => {
      const result = dispatchEvent(
        ticket.id,
        EVENTS.COMPLETE_INFO_SUPPLEMENT,
        {
          __timelineRemark: '提单人已补充信息'
        },
        user
      );
      if (!result.ok) {
        message.error(result.reason || '提交失败');
        return;
      }
      addMessage(ticket.id, {
        id: shortId('m'),
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        content: '【系统】提单人已补充信息，工单回到处理中。',
        attachments: [],
        createdAt: new Date().toISOString()
      });
      message.success('已补充，工单回到处理中');
    };

    return (
      <Card title="提单人操作区">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="请补充工单信息"
            description="一线技术支持已将工单退回补充信息。请在留言区或后续补充入口中完善信息后继续流转。"
          />
          <Button type="primary" onClick={handleCompleteInfoSupplement}>
            已补充
          </Button>
        </Space>
      </Card>
    );
  }

  if (requesterStatus !== STATUS.CONFIRMING) {
    return (
      <Card title="提单人操作区">
        <Typography.Text type="secondary">
          当前工单不在「待验证」状态，暂无可操作项。请等待处理进展。
        </Typography.Text>
      </Card>
    );
  }

  const handleVerifyYes = () => setSatOpen(true);

  const handleSatSubmit = async (satisfaction) => {
    const result = dispatchEvent(
      ticket.id,
      EVENTS.VERIFY_YES,
      { satisfaction, __timelineRemark: `满意度 ${satisfaction.rating} 星` },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '操作失败');
      return;
    }
    addMessage(ticket.id, {
      id: shortId('m'),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: `【系统】提单人验证通过，工单办结。满意度 ★${satisfaction.rating}/5${satisfaction.comment ? '，评价：' + satisfaction.comment : ''}`,
      attachments: [],
      createdAt: new Date().toISOString()
    });
    setSatOpen(false);
    message.success('工单已办结，感谢您的评价！');
  };

  const handleRejectOpen = () => setRejectOpen(true);

  const handleRejectSubmit = async () => {
    const values = await rejectForm.validateFields();
    const result = dispatchEvent(
      ticket.id,
      EVENTS.VERIFY_NO,
      {
        rejectionReason: values.reason.trim(),
        __timelineRemark: `驳回原因：${values.reason.trim()}`
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '操作失败');
      return;
    }
    addMessage(ticket.id, {
      id: shortId('m'),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: `【系统】提单人验证未通过，驳回原因：${values.reason.trim()}`,
      attachments: [],
      createdAt: new Date().toISOString()
    });
    rejectForm.resetFields();
    setRejectOpen(false);
    message.success('已驳回工单，将流转回一线处理中');
  };

  return (
    <Card title="提单人操作区">
      <Alert
        type="info"
        showIcon
        message="请验证一线给出的解决方案是否解决您的问题"
        description="确认解决后请提交满意度评价；否则请驳回并填写原因，工单将回到一线继续处理。"
        style={{ marginBottom: 16 }}
      />
      <Space wrap>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={handleVerifyYes}
        >
          验证解决 (是)
        </Button>
        <Button
          danger
          icon={<CloseCircleOutlined />}
          onClick={handleRejectOpen}
        >
          验证未解决 (否)
        </Button>
      </Space>

      <SatisfactionModal
        open={satOpen}
        onOk={handleSatSubmit}
        onCancel={() => setSatOpen(false)}
      />

      <Modal
        title="填写驳回原因"
        open={rejectOpen}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectOpen(false)}
        okText="确认驳回"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="驳回原因"
            rules={[
              { required: true, message: '请填写驳回原因' },
              { min: 5, message: '原因至少 5 个字符' }
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={300}
              showCount
              placeholder="说明未解决的现象，便于一线继续处理..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

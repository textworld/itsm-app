import React, { useEffect, useState } from 'react';
import {
  Card,
  Space,
  Button,
  Popconfirm,
  Alert,
  Typography,
  App as AntdApp
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import {
  PROCESSING_SUB_STATUS,
  STATUS,
  getProcessingSubStatus
} from '../../constants/ticketStatus.js';
import { ROLES } from '../../constants/roles.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { shortId } from '../../utils/idGenerator.js';
import {
  richTextHasContent,
  richTextToPlainText,
  richTextValueToDoc,
  richTextValueToHtml
} from '../../utils/richText.js';
import RichTextEditor from '../common/RichTextEditor.jsx';
import TechTransferPanel from './TechTransferPanel.jsx';

/**
 * 二线运维操作区
 * - PROCESSING + 二线排查 : 填写缺陷排查结论 → 一线复核
 * - 其他状态     : 只读提示
 */
export default function L2Actions({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [conclusionDoc, setConclusionDoc] = useState(richTextValueToDoc(ticket.l2Conclusion));

  useEffect(() => {
    setConclusionDoc(richTextValueToDoc(ticket.l2Conclusion));
  }, [ticket.id, ticket.l2Conclusion]);

  const processingSubStatus = getProcessingSubStatus(ticket);
  const canL2Review = ticket.status === STATUS.PROCESSING && processingSubStatus === PROCESSING_SUB_STATUS.L2_INVESTIGATION;

  if (!canL2Review) {
    return (
      <Card title="二线操作区">
        <Typography.Text type="secondary">
          当前工单不在「处理中 / 二线排查」子状态，暂无可操作项。
        </Typography.Text>
      </Card>
    );
  }

  const handleSubmit = async () => {
    if (!richTextHasContent(conclusionDoc)) {
      message.warning('请填写排查结论');
      return;
    }
    const conclusionHtml = richTextValueToHtml(conclusionDoc);
    const conclusionText = richTextToPlainText(conclusionDoc);
    const result = await dispatchEvent(
      ticket.id,
      EVENTS.L1_REVIEW,
      {
        l2Conclusion: conclusionHtml,
        assigneeL2Id: user.id,
        assigneeL2Name: user.name,
        __timelineRemark: '二线完成排查，提交一线复核'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '提交失败');
      return;
    }
    await addMessage(ticket.id, {
      id: shortId('m'),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content: `【系统】二线运维给出排查结论：${conclusionText}`,
      attachments: [],
      createdAt: new Date().toISOString()
    });
    message.success('结论已提交，工单回到一线排查');
  };

  return (
    <Card title="二线操作区 · 二线排查">
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="warning"
          showIcon
          message="请针对一线打标的缺陷进行排查，并填写排查结论"
          description="提交后工单仍为处理中，并回到「一线排查」子状态。"
        />
        <RichTextEditor
          value={conclusionDoc}
          onChange={setConclusionDoc}
          placeholder="请详细填写排查过程、根因分析、临时规避/修复建议..."
        />
        <Popconfirm
          title="确认提交给一线复核？"
          description="提交后会记录排查结论，并把工单切回一线排查。"
          okText="确认提交"
          cancelText="取消"
          onConfirm={handleSubmit}
          disabled={!richTextHasContent(conclusionDoc)}
        >
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!richTextHasContent(conclusionDoc)}
          >
            一线复核
          </Button>
        </Popconfirm>
        <TechTransferPanel
          ticket={ticket}
          role={ROLES.L2}
          buttonText="转给其他二线运维"
          modalTitle="转给其他二线运维"
        />
      </Space>
    </Card>
  );
}

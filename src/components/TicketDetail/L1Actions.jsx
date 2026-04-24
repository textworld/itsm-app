import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Typography,
  Input,
  Alert,
  Divider,
  Tag,
  App as AntdApp
} from 'antd';
import {
  CheckOutlined,
  RollbackOutlined,
  FlagOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
  SendOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import {
  PROCESSING_SUB_STATUS,
  PROCESSING_SUB_STATUS_LABELS,
  STATUS,
  getProcessingSubStatus
} from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import DefectTagModal from './DefectTagModal.jsx';
import LinkDefectPanel from './LinkDefectPanel.jsx';
import { generateSummary } from '../../utils/summaryGenerator.js';
import { shortId } from '../../utils/idGenerator.js';

/**
 * 一线技术支持操作区
 * 按工单状态分支：
 * - PENDING       : 「受理」按钮 (ACCEPT → PROCESSING)
 * - PROCESSING    : 「打标为缺陷」+「关联缺陷」，两者齐全 → 「二线支持」(状态仍为 PROCESSING)
 * - PROCESSING    : 一线排查 / 二线排查 子状态切换；一线可发起办结
 */
export default function L1Actions({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent, updateTicket, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [tagOpen, setTagOpen] = useState(false);
  const [editSummary, setEditSummary] = useState(ticket.summary || '');

  // 工单切换时同步 summary 输入框
  React.useEffect(() => {
    setEditSummary(ticket.summary || '');
  }, [ticket.id, ticket.summary]);

  const pushSystemMessage = (content) => {
    addMessage(ticket.id, {
      id: shortId('m'),
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      content,
      attachments: [],
      createdAt: new Date().toISOString()
    });
  };

  // ---------- 受理 ----------
  const handleAccept = () => {
    const result = dispatchEvent(
      ticket.id,
      EVENTS.ACCEPT,
      {
        assigneeL1Id: user.id,
        assigneeL1Name: user.name,
        __timelineRemark: '一线受理'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '受理失败');
      return;
    }
    pushSystemMessage(`【系统】一线技术支持 ${user.name} 已受理本工单。`);
    message.success('已受理，进入处理中');
  };

  const handleReturnForInfo = () => {
    const result = dispatchEvent(
      ticket.id,
      EVENTS.RETURN_FOR_INFO,
      {
        __timelineRemark: '一线退回提单人补充信息'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '退回失败');
      return;
    }
    pushSystemMessage('【系统】一线技术支持已退回工单，请提单人补充信息后再继续处理。');
    message.success('已退回提单人，工单进入信息补充');
  };

  // ---------- 打标为缺陷 ----------
  const handleTagOk = (values) => {
    updateTicket(ticket.id, (t) => ({
      ...t,
      defectTag: {
        type: values.type,
        description: values.description,
        taggedAt: new Date().toISOString(),
        taggedBy: user.name
      },
      updatedAt: new Date().toISOString()
    }));
    setTagOpen(false);
    message.success('已标记为缺陷，请继续关联项目缺陷');
  };

  // ---------- 关联/取消关联缺陷 ----------
  const handleLinkChange = (linked) => {
    updateTicket(ticket.id, (t) => ({
      ...t,
      linkedDefect: linked,
      updatedAt: new Date().toISOString()
    }));
  };

  // ---------- 流转给二线 ----------
  const handleFlowToL2 = () => {
    const result = dispatchEvent(
      ticket.id,
      EVENTS.REQUEST_L2_SUPPORT,
      {
        assigneeL2Id: null,
        assigneeL2Name: null,
        l2SupportRequested: true,
        __timelineRemark: `已关联缺陷 ${ticket.linkedDefect?.defectId || ''}`
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '流转失败：需要先完成打标 + 关联缺陷');
      return;
    }
    pushSystemMessage(
      `【系统】已将工单标记为【${ticket.defectTag?.type}】缺陷并关联到 ${ticket.linkedDefect?.defectId}，请求二线运维支持。`
    );
    message.success('已请求二线支持，工单仍为处理中');
  };

  // ---------- 生成 / 修改 / 同步 / 提交复核 ----------
  const handleGenSummary = () => {
    const text = generateSummary(ticket);
    setEditSummary(text);
    updateTicket(ticket.id, { summary: text, summarySyncedToCorpus: false });
    message.success('工单总结已自动生成，您可以进一步修改');
  };

  const handleSaveSummary = () => {
    updateTicket(ticket.id, {
      summary: editSummary,
      summarySyncedToCorpus: false,
      updatedAt: new Date().toISOString()
    });
    message.success('总结已保存（尚未同步语料库）');
  };

  const handleSyncCorpus = () => {
    if (!editSummary.trim()) {
      message.warning('请先生成或填写工单总结');
      return;
    }
    updateTicket(ticket.id, {
      summary: editSummary,
      summarySyncedToCorpus: true,
      updatedAt: new Date().toISOString()
    });
    message.success('已同步至大模型语料库');
  };

  const handleSubmitReview = () => {
    const result = dispatchEvent(
      ticket.id,
      EVENTS.INITIATE_CLOSURE,
      {
        summary: editSummary,
        summarySyncedToCorpus: Boolean(editSummary.trim()),
        __timelineRemark: '一线发起办结，总结已同步语料库'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '提交复核失败');
      return;
    }
    pushSystemMessage('【系统】一线已发起办结，请提单人确认。');
    message.success('已发起办结，工单进入待确认');
  };

  // ---------- 渲染 ----------
  const { status } = ticket;

  if (status === STATUS.PENDING) {
    return (
      <Card title="一线操作区 · 待受理">
        <Alert
          type="warning"
          showIcon
          message="该工单尚未受理"
          description="受理后将由您作为一线处理人继续跟进。"
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" icon={<CheckOutlined />} onClick={handleAccept}>
          受理工单
        </Button>
      </Card>
    );
  }

  if (status === STATUS.PROCESSING) {
    const readyToFlow = Boolean(ticket.defectTag) && Boolean(ticket.linkedDefect);
    const processingSubStatus = getProcessingSubStatus(ticket);
    const isL2Investigation = processingSubStatus === PROCESSING_SUB_STATUS.L2_INVESTIGATION;
    return (
      <Card title="一线操作区 · 处理中">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            type="info"
            showIcon
            message="本工单处理中"
            description={`当前子状态：${PROCESSING_SUB_STATUS_LABELS[processingSubStatus] || '-'}。如判定为缺陷，请【打标为缺陷】并【关联缺陷】，随后点击二线支持，工单状态仍保持处理中。`}
          />

          <Space wrap>
            <Button
              icon={<FlagOutlined />}
              onClick={() => setTagOpen(true)}
              type={ticket.defectTag ? 'default' : 'primary'}
            >
              {ticket.defectTag ? '修改缺陷打标' : '打标为缺陷'}
            </Button>
            {ticket.defectTag && (
              <Tag color="volcano">
                已打标：{ticket.defectTag.type}
              </Tag>
            )}
          </Space>

          <LinkDefectPanel
            ticket={ticket}
            onChange={handleLinkChange}
          />

          <Divider />
          <Button icon={<RollbackOutlined />} onClick={handleReturnForInfo}>
            退回提单人-信息补充
          </Button>

          <Divider />
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>发起办结</Typography.Text>
            <Typography.Text type="secondary">
              若本次问题已处理完毕，可生成/维护工单总结后发起办结，工单将进入提单人待确认。
            </Typography.Text>
            <Button onClick={handleSubmitReview} disabled={!editSummary.trim()}>
              发起办结
            </Button>
          </Space>

          <Divider />
          <Button
            type="primary"
            icon={<SendOutlined />}
            disabled={!readyToFlow || isL2Investigation}
            onClick={handleFlowToL2}
          >
            二线支持
          </Button>
          {isL2Investigation && (
            <Typography.Text type="secondary">
              当前子状态为「二线排查」，请等待二线运维触发「一线复核」。
            </Typography.Text>
          )}
          {!readyToFlow && (
            <Typography.Text type="secondary">
              需先完成【打标为缺陷】+【关联缺陷】才能流转至二线。
            </Typography.Text>
          )}
        </Space>

        <DefectTagModal
          open={tagOpen}
          initialValue={ticket.defectTag}
          onOk={handleTagOk}
          onCancel={() => setTagOpen(false)}
        />
      </Card>
    );
  }

  if (status === STATUS.INFO_SUPPLEMENT) {
    return (
      <Card title="一线操作区 · 信息补充">
        <Alert
          type="info"
          showIcon
          message="已退回提单人补充信息"
          description="请等待提单人补充信息。补充完成后的再次流转规则可按后续业务需要继续补充。"
        />
      </Card>
    );
  }

  if (status === STATUS.CONFIRMING) {
    return (
      <Card title="一线操作区 · 待确认">
        <Alert
          type="info"
          showIcon
          message="工单已提交提单人确认"
          description="请等待提单人确认。若被驳回，工单将回到您这里的「处理中 / 一线排查」继续跟进。"
        />
      </Card>
    );
  }

  if (status === STATUS.CLOSED) {
    return (
      <Card title="一线操作区 · 已办结">
        <Alert
          type="success"
          showIcon
          message="工单已办结"
          description="如需复盘，可在上方查看完整流转轨迹与满意度评价。"
        />
      </Card>
    );
  }

  return null;
}

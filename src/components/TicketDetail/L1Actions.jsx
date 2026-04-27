import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Popconfirm,
  Typography,
  Alert,
  Divider,
  Tag,
  App as AntdApp
} from 'antd';
import {
  CheckOutlined,
  RollbackOutlined,
  FlagOutlined,
  SendOutlined
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
  const { dispatchEvent, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [tagOpen, setTagOpen] = useState(false);
  const [editSummary, setEditSummary] = useState(ticket.summary || '');

  // 工单切换时同步 summary 输入框
  React.useEffect(() => {
    setEditSummary(ticket.summary || '');
  }, [ticket.id, ticket.summary]);

  const pushSystemMessage = async (content) => {
    await addMessage(ticket.id, {
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
  const handleAccept = async () => {
    const result = await dispatchEvent(
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
    await pushSystemMessage(`【系统】一线技术支持 ${user.name} 已受理本工单。`);
    message.success('已受理，进入处理中');
  };

  const handleReturnForInfo = async () => {
    const result = await dispatchEvent(
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
    await pushSystemMessage('【系统】一线技术支持已退回工单，请提单人补充信息后再继续处理。');
    message.success('已退回提单人，工单进入信息补充');
  };

  // ---------- 打标为缺陷 ----------
  const handleTagOk = async (values) => {
    try {
      const result = await dispatchEvent(ticket.id, EVENTS.TAG_DEFECT, {
        defectTag: {
          type: values.type,
          description: values.description,
          taggedAt: new Date().toISOString(),
          taggedBy: user.name
        }
      });
      if (!result.ok) {
        throw new Error(result.reason || '缺陷打标失败');
      }
      setTagOpen(false);
      message.success('已保存缺陷打标');
    } catch (error) {
      console.error(error);
      message.error(error.message || '缺陷打标失败');
    }
  };

  // ---------- 关联/取消关联缺陷 ----------
  const handleLinkChange = async (linked) => {
    try {
      const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_LINKED_DEFECT, {
        linkedDefect: linked
      });
      if (!result.ok) {
        throw new Error(result.reason || '更新关联缺陷失败');
      }
    } catch (error) {
      console.error(error);
      message.error(error.message || '更新关联缺陷失败');
    }
  };

  // ---------- 流转给二线 ----------
  const handleFlowToL2 = async () => {
    const result = await dispatchEvent(
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
    await pushSystemMessage(
      `【系统】已将工单标记为【${ticket.defectTag?.type}】缺陷并关联到 ${ticket.linkedDefect?.defectId}，请求二线运维支持。`
    );
    message.success('已请求二线支持，工单仍为处理中');
  };

  // ---------- 生成 / 修改 / 同步 / 提交复核 ----------
  const handleGenSummary = async () => {
    const text = generateSummary(ticket);
    setEditSummary(text);
    try {
      const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_SUMMARY, {
        summary: text,
        summarySyncedToCorpus: false
      });
      if (!result.ok) {
        throw new Error(result.reason || '生成工单总结失败');
      }
      message.success('工单总结已自动生成，您可以进一步修改');
    } catch (error) {
      console.error(error);
      message.error(error.message || '生成工单总结失败');
    }
  };

  const handleSaveSummary = async () => {
    try {
      const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_SUMMARY, {
        summary: editSummary,
        summarySyncedToCorpus: false
      });
      if (!result.ok) {
        throw new Error(result.reason || '保存总结失败');
      }
      message.success('总结已保存（尚未同步语料库）');
    } catch (error) {
      console.error(error);
      message.error(error.message || '保存总结失败');
    }
  };

  const handleSyncCorpus = async () => {
    if (!editSummary.trim()) {
      message.warning('请先生成或填写工单总结');
      return;
    }
    try {
      const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_SUMMARY, {
        summary: editSummary,
        summarySyncedToCorpus: true
      });
      if (!result.ok) {
        throw new Error(result.reason || '同步语料库失败');
      }
      message.success('已同步至大模型语料库');
    } catch (error) {
      console.error(error);
      message.error(error.message || '同步语料库失败');
    }
  };

  const handleSubmitReview = async () => {
    const result = await dispatchEvent(
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
    await pushSystemMessage('【系统】一线已发起办结，请提单人确认。');
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
        <Popconfirm
          title="确认受理该工单？"
          description="受理后您将成为一线处理人，工单会进入处理中。"
          okText="确认受理"
          cancelText="取消"
          onConfirm={handleAccept}
        >
          <Button type="primary" icon={<CheckOutlined />}>
            受理工单
          </Button>
        </Popconfirm>
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

          <Divider />
          <Popconfirm
            title="确认退回提单人补充信息？"
            description="退回后工单会进入信息补充状态，等待提单人修改后再继续处理。"
            okText="确认退回"
            cancelText="取消"
            onConfirm={handleReturnForInfo}
          >
            <Button icon={<RollbackOutlined />}>
              退回提单人-信息补充
            </Button>
          </Popconfirm>

          <Divider />
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Typography.Text strong>发起办结</Typography.Text>
            <Typography.Text type="secondary">
              若本次问题已处理完毕，可生成/维护工单总结后发起办结，工单将进入提单人待确认。
            </Typography.Text>
            <Popconfirm
              title="确认发起办结？"
              description="发起后工单会进入提单人待确认，请确认总结内容已准备好。"
              okText="确认发起"
              cancelText="取消"
              onConfirm={handleSubmitReview}
              disabled={!editSummary.trim()}
            >
              <Button disabled={!editSummary.trim()}>
                发起办结
              </Button>
            </Popconfirm>
          </Space>
	
          <Divider />
          <Popconfirm
            title="确认发起二线支持？"
            description="发起后工单会保留处理中状态，并切换到二线排查。"
            okText="确认发起"
            cancelText="取消"
            onConfirm={handleFlowToL2}
            disabled={!readyToFlow || isL2Investigation}
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!readyToFlow || isL2Investigation}
            >
              二线支持
            </Button>
          </Popconfirm>
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
          ticket={ticket}
          initialValue={ticket.defectTag}
          onLinkChange={handleLinkChange}
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

import React, { useRef, useState } from 'react';
import {
  Card,
  Space,
  Button,
  Popconfirm,
  Modal,
  Form,
  Typography,
  Alert,
  App as AntdApp
} from 'antd';
import {
  CheckOutlined,
  RollbackOutlined,
  SendOutlined,
  StopOutlined
} from '@ant-design/icons';
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
  createEmptyRichTextDoc,
  richTextHasContent,
  richTextPlainTextToDoc,
  richTextToPlainText,
  richTextValueToDoc,
  richTextValueToHtml
} from '../../utils/richText.js';
import {
  clearClosureSummaryDraft,
  readClosureSummaryDraft,
  writeCompletedClosureSummaryDraft
} from '../../utils/closureSummaryDraft.js';
import RichTextEditor from '../common/RichTextEditor.jsx';
import TechTransferPanel from './TechTransferPanel.jsx';

const TYPEWRITER_DELAY_MS = 18;

/**
 * 一线技术支持操作区
 * 按工单状态分支：
 * - PENDING       : 「受理」按钮 (ACCEPT -> PROCESSING)
 * - PROCESSING    : PMS 缺陷/故障入口、退回补充、二线支持、发起办结
 */
export default function L1Actions({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [closureOpen, setClosureOpen] = useState(false);
  const [editSummary, setEditSummary] = useState(ticket.summary || '');
  const [closureSummaryDoc, setClosureSummaryDoc] = useState(createEmptyRichTextDoc());
  const [closureSummaryError, setClosureSummaryError] = useState('');
  const [closureGenerating, setClosureGenerating] = useState(false);
  const [closureForm] = Form.useForm();
  const generationAbortRef = useRef(null);
  const generationIdRef = useRef(0);
  const generatedSummaryTextRef = useRef('');

  React.useEffect(() => {
    setEditSummary(ticket.summary || '');
  }, [ticket.id, ticket.summary]);

  React.useEffect(() => {
    return () => {
      abortClosureSummaryGeneration(false);
    };
  }, []);

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

  const openPmsCreate = (type) => {
    const params = new URLSearchParams({
      type,
      ticketId: ticket.id,
      title: ticket.title || ''
    });
    window.open(`/pms/create?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleFlowToL2 = async () => {
    const result = await dispatchEvent(
      ticket.id,
      EVENTS.REQUEST_L2_SUPPORT,
      {
        assigneeL2Id: null,
        assigneeL2Name: null,
        l2SupportRequested: true,
        __timelineRemark: '一线直接转交二线支持'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '流转失败');
      return;
    }
    await pushSystemMessage('【系统】一线已将工单转交二线支持。');
    message.success('已请求二线支持，工单仍为处理中');
  };

  const openClosureModal = () => {
    abortClosureSummaryGeneration();
    setClosureSummaryError('');
    setClosureGenerating(false);

    const cachedSummary = readClosureSummaryDraft(window.localStorage, ticket.id, user?.id);
    if (cachedSummary) {
      setClosureSummaryDoc(richTextPlainTextToDoc(cachedSummary.text));
      closureForm.setFieldsValue({ summary: cachedSummary.text });
      setClosureOpen(true);
      return;
    }

    const initialSummary = ticket.summary || editSummary || '';
    setClosureSummaryDoc(initialSummary ? richTextValueToDoc(initialSummary) : createEmptyRichTextDoc());
    closureForm.setFieldsValue({ summary: initialSummary });
    setClosureOpen(true);
    startClosureSummaryGeneration();
  };

  const closeClosureModal = () => {
    abortClosureSummaryGeneration();
    setClosureOpen(false);
  };

  const handleStopClosureSummaryGeneration = () => {
    abortClosureSummaryGeneration();
  };

  const abortClosureSummaryGeneration = (updateState = true) => {
    generationIdRef.current += 1;
    if (generationAbortRef.current) {
      generationAbortRef.current.abort();
      generationAbortRef.current = null;
    }
    if (updateState) {
      setClosureGenerating(false);
    }
  };

  const startClosureSummaryGeneration = async () => {
    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    generatedSummaryTextRef.current = '';

    const controller = new AbortController();
    generationAbortRef.current = controller;
    setClosureGenerating(true);

    try {
      const response = await fetch('/api/ai/ticket-closure-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const data = await tryReadJson(response);
        throw new Error(data?.reason || '大模型总结生成失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await typeSummaryText(decoder.decode(value, { stream: true }), generationId, controller.signal);
      }
      await typeSummaryText(decoder.decode(), generationId, controller.signal);

      if (generationIdRef.current === generationId && !controller.signal.aborted) {
        writeCompletedClosureSummaryDraft(
          window.localStorage,
          ticket.id,
          user?.id,
          generatedSummaryTextRef.current
        );
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error(error);
        setClosureSummaryError(error.message || '大模型总结生成失败，请手动填写');
      }
    } finally {
      if (generationIdRef.current === generationId) {
        setClosureGenerating(false);
        generationAbortRef.current = null;
      }
    }
  };

  const typeSummaryText = async (text, generationId, signal) => {
    for (const character of text) {
      if (signal.aborted || generationIdRef.current !== generationId) {
        throw new DOMException('Aborted', 'AbortError');
      }

      generatedSummaryTextRef.current += character;
      const nextDoc = richTextPlainTextToDoc(generatedSummaryTextRef.current);
      setClosureSummaryDoc(nextDoc);
      closureForm.setFieldsValue({ summary: generatedSummaryTextRef.current });
      await delay(TYPEWRITER_DELAY_MS);
    }
  };

  const handleSubmitReview = async () => {
    const summaryPlainText = richTextToPlainText(closureSummaryDoc);
    if (!richTextHasContent(closureSummaryDoc)) {
      setClosureSummaryError('请填写工单处理总结');
      return;
    }
    if (summaryPlainText.length < 5) {
      setClosureSummaryError('总结至少 5 个字符');
      return;
    }

    const summaryHtml = richTextValueToHtml(closureSummaryDoc);
    const result = await dispatchEvent(
      ticket.id,
      EVENTS.INITIATE_CLOSURE,
      {
        summary: summaryHtml,
        summarySyncedToCorpus: Boolean(summaryPlainText.trim()),
        __timelineRemark: '一线发起办结，总结已同步语料库'
      },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '提交复核失败');
      return;
    }
    await pushSystemMessage('【系统】一线已发起办结，请提单人确认。');
    clearClosureSummaryDraft(window.localStorage, ticket.id, user?.id);
    abortClosureSummaryGeneration();
    setClosureOpen(false);
    message.success('已发起办结，工单进入待确认');
  };

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
    const processingSubStatus = getProcessingSubStatus(ticket);
    const isL2Investigation = processingSubStatus === PROCESSING_SUB_STATUS.L2_INVESTIGATION;
    return (
      <Card title="一线操作区 · 处理中">
        <Space wrap>
          <Button
            type="primary"
            onClick={() => openPmsCreate('defect')}
          >
            关联缺陷
          </Button>
          <Button onClick={() => openPmsCreate('incident')}>
            故障应急
          </Button>

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

          <Button onClick={openClosureModal}>
            发起办结
          </Button>

          <Popconfirm
            title="确认发起二线支持？"
            description="发起后工单会保留处理中状态，并切换到二线排查。"
            okText="确认发起"
            cancelText="取消"
            onConfirm={handleFlowToL2}
            disabled={isL2Investigation}
          >
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={isL2Investigation}
            >
              二线支持
            </Button>
          </Popconfirm>
          {isL2Investigation && (
            <Typography.Text type="secondary">
              当前子状态为「二线排查」，请等待二线运维触发「一线复核」。
            </Typography.Text>
          )}
          <TechTransferPanel ticket={ticket} role={ROLES.L1} />
        </Space>
        <Modal
          title={
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <span>发起办结</span>
              {closureGenerating && (
                <Button size="small" icon={<StopOutlined />} onClick={handleStopClosureSummaryGeneration}>
                  停止生成
                </Button>
              )}
            </Space>
          }
          open={closureOpen}
          onOk={handleSubmitReview}
          onCancel={closeClosureModal}
          okText="确认发起"
          cancelText="取消"
          destroyOnClose
          confirmLoading={closureGenerating}
          okButtonProps={{ disabled: closureGenerating }}
        >
          <Form form={closureForm} layout="vertical">
            {closureGenerating && (
              <Alert
                type="info"
                showIcon
                message="大模型正在生成工单总结"
                description="生成内容会以打字机效果逐步填入，完成后会暂存在当前浏览器。"
                style={{ marginBottom: 12 }}
              />
            )}
            {closureSummaryError && (
              <Alert
                type="warning"
                showIcon
                message={closureSummaryError}
                style={{ marginBottom: 12 }}
              />
            )}
            <Form.Item name="summary" label="工单处理总结">
              <RichTextEditor
                value={closureSummaryDoc}
                onChange={(nextDoc) => {
                  setClosureSummaryDoc(nextDoc);
                  setClosureSummaryError('');
                }}
                disabled={closureGenerating}
                placeholder="正在生成或手动填写工单处理总结，支持富文本和图片..."
              />
            </Form.Item>
          </Form>
        </Modal>
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

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function tryReadJson(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

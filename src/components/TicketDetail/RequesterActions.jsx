import React, { useState } from 'react';
import {
  Card,
  Space,
  Button,
  Popconfirm,
  Modal,
  Input,
  Form,
  Select,
  Typography,
  Alert,
  App as AntdApp
} from 'antd';
import {
  EditOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useTickets } from '../../context/TicketContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { STATUS, getRequesterStatus } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import SatisfactionModal from './SatisfactionModal.jsx';
import { shortId } from '../../utils/idGenerator.js';
import RichTextEditor from '../common/RichTextEditor.jsx';
import AiTicketAssistantDrawer from '../TicketSubmit/AiTicketAssistantDrawer.jsx';
import { buildDescriptionUpdate } from '../../utils/descriptionHistory.js';
import { richTextHasContent, richTextValueToDoc } from '../../utils/richText.js';
import {
  SYSTEM_CATEGORY,
  SYSTEM_CATEGORY_OPTIONS,
  getSystemCategoryByCode,
  getSystemOptionsByCategory
} from '../../constants/systems.js';

/**
 * 提单人操作区
 * - 仅在 VERIFYING 状态下显示"验证解决"（是/否）
 *   - 是：弹出满意度评价 → 提交后流转为 CLOSED
 *   - 否：Modal 填写驳回原因 → 流转回 PROCESSING，并追加系统留言
 * - CLOSED 且已评价时，展示评价摘要
 */
export default function RequesterActions({ ticket }) {
  const router = useRouter();
  const { user } = useAuth();
  const { dispatchEvent, addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [satOpen, setSatOpen] = useState(false);
  const [requesterCloseOpen, setRequesterCloseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [editingDescriptionDoc, setEditingDescriptionDoc] = useState(
    ticket.descriptionDoc || richTextValueToDoc(ticket.descriptionHtml)
  );
  const [savingDescription, setSavingDescription] = useState(false);
  const [rejectForm] = Form.useForm();
  const [withdrawForm] = Form.useForm();
  const [infoSupplementForm] = Form.useForm();

  React.useEffect(() => {
    setEditingDescriptionDoc(ticket.descriptionDoc || richTextValueToDoc(ticket.descriptionHtml));
  }, [ticket.descriptionDoc, ticket.descriptionHtml, ticket.id]);

  if (!user) return null;

  const requesterStatus = getRequesterStatus(ticket);

  if (requesterStatus === STATUS.DRAFT) {
    const handleStartDraftAiSubmit = () => {
      setAiDrawerOpen(true);
    };

    const handleDraftAiResolved = async ({ messages, answer }) => {
      setAiActionLoading(true);
      try {
        const result = await dispatchEvent(
          ticket.id,
          EVENTS.AI_RESOLVE,
          {
            aiResolution: {
              answer,
              messages
            },
            __timelineRemark: '提单人确认大模型已解决草稿工单问题'
          },
          user
        );
        if (!result.ok) {
          throw new Error(result.reason || '大模型办结失败');
        }

        setAiDrawerOpen(false);
        message.success(`问题已由大模型解决，工单已办结：${result.ticket.id}`);
        router.replace(`/tickets/${result.ticket.id}`);
      } catch (error) {
        console.error(error);
        message.error(error.message || '大模型办结失败');
      } finally {
        setAiActionLoading(false);
      }
    };

    const handleDraftManualProcess = async () => {
      setAiActionLoading(true);
      try {
        const result = await dispatchEvent(
          ticket.id,
          EVENTS.SUBMIT,
          {
            __timelineRemark: '提单人选择人工处理，草稿工单进入待受理'
          },
          user
        );
        if (!result.ok) {
          throw new Error(result.reason || '转人工失败');
        }

        const targetTicketId = result.ticket?.id || ticket.id;
        await addMessage(targetTicketId, {
          id: shortId('m'),
          authorId: user.id,
          authorName: user.name,
          authorRole: user.role,
          content: '【系统】提单人已完成大模型尝试解答并选择人工处理，当前状态为待受理。',
          attachments: [],
          createdAt: new Date().toISOString()
        });
        setAiDrawerOpen(false);
        message.success(`工单已转人工处理，工单编号：${targetTicketId}`);
        router.replace(`/tickets/${targetTicketId}`);
      } catch (error) {
        console.error(error);
        message.error(error.message || '转人工失败');
      } finally {
        setAiActionLoading(false);
      }
    };

    return (
      <>
        <Card title="草稿箱操作">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="草稿箱工单"
              description="该工单仍在草稿箱中，继续提交后会先由大模型尝试解答，也可转人工进入待受理。"
            />
            <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleStartDraftAiSubmit}>
              提交工单
            </Button>
          </Space>
        </Card>
        <AiTicketAssistantDrawer
          open={aiDrawerOpen}
          ticket={ticket}
          onResolved={handleDraftAiResolved}
          onManual={handleDraftManualProcess}
          onClose={() => setAiDrawerOpen(false)}
          confirming={aiActionLoading}
        />
      </>
    );
  }

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
    const handleOpenDescriptionEdit = () => {
      setEditingDescriptionDoc(ticket.descriptionDoc || richTextValueToDoc(ticket.descriptionHtml));
      infoSupplementForm.setFieldsValue({
        systemCategory: ticket.systemCategory || getSystemCategoryByCode(ticket.systemCode || ticket.systemName),
        systemName: ticket.systemCode || ticket.systemName || undefined
      });
      setEditOpen(true);
    };

    const handleSaveDescription = async () => {
      const values = await infoSupplementForm.validateFields();
      if (!richTextHasContent(editingDescriptionDoc)) {
        message.warning('问题描述不能为空');
        return;
      }

      const update = buildDescriptionUpdate(ticket, {
        descriptionDoc: editingDescriptionDoc,
        user,
        reason: '信息补充阶段修改工单描述'
      });

      if (!update) {
        message.info('描述内容没有变化');
        setEditOpen(false);
        return;
      }

      setSavingDescription(true);
      try {
        const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_INFO_SUPPLEMENT, {
          descriptionDoc: editingDescriptionDoc,
          systemCategory: values.systemCategory,
          systemName: values.systemName
        });
        if (!result.ok) {
          throw new Error(result.reason || '更新工单描述失败');
        }
        setEditOpen(false);
        message.success('工单描述已更新，并写入历史版本');
      } catch (error) {
        console.error(error);
        message.error(error.message || '更新工单描述失败');
      } finally {
        setSavingDescription(false);
      }
    };

    const handleCompleteInfoSupplement = async () => {
      const result = await dispatchEvent(
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
      await addMessage(ticket.id, {
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
            description="一线技术支持已将工单退回补充信息。您现在可以直接修改工单描述，系统会自动保存历史版本，随后再提交补充。"
          />
          <Space wrap>
            <Button icon={<EditOutlined />} onClick={handleOpenDescriptionEdit}>
              修改工单描述
            </Button>
            <Popconfirm
              title="确认已补充信息？"
              description="提交后工单会回到处理中，请确认描述和附件已经补充完整。"
              okText="确认提交"
              cancelText="取消"
              onConfirm={handleCompleteInfoSupplement}
            >
              <Button type="primary">
                已补充
              </Button>
            </Popconfirm>
          </Space>
        </Space>

        <Modal
          title="修改工单描述"
          open={editOpen}
          onOk={handleSaveDescription}
          onCancel={() => setEditOpen(false)}
          okText="保存描述"
          cancelText="取消"
          width={880}
          confirmLoading={savingDescription}
          destroyOnClose
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="版本记录说明"
              description="每次保存都会新增一条描述历史记录，后续可在工单详情中查看历史及差异。"
            />
            <RichTextEditor
              value={editingDescriptionDoc}
              onChange={setEditingDescriptionDoc}
              disabled={savingDescription}
              placeholder="请补充或修改问题描述..."
            />
            <Form
              form={infoSupplementForm}
              layout="vertical"
              initialValues={{ systemCategory: SYSTEM_CATEGORY.OLD }}
            >
              <Form.Item
                label="新老系统标签"
                name="systemCategory"
                rules={[{ required: true, message: '请选择新老系统标签' }]}
              >
                <Select
                  options={SYSTEM_CATEGORY_OPTIONS}
                  onChange={() => infoSupplementForm.setFieldValue('systemName', undefined)}
                />
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCategory !== current.systemCategory}>
                {({ getFieldValue }) => (
                  <Form.Item
                    label="系统名称"
                    name="systemName"
                    rules={[{ required: true, message: '请选择系统名称' }]}
                  >
                    <Select
                      placeholder="请选择..."
                      showSearch
                      optionFilterProp="label"
                      options={getSystemOptionsByCategory(getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </Form>
          </Space>
        </Modal>
      </Card>
    );
  }

  if (requesterStatus === STATUS.PENDING) {
    const handleWithdrawSubmit = async () => {
      const values = await withdrawForm.validateFields();
      const reason = values.reason?.trim() || '';
      const result = await dispatchEvent(
        ticket.id,
        EVENTS.WITHDRAW,
        {
          withdrawalReason: reason,
          __timelineRemark: reason ? `提单人撤回：${reason}` : '提单人撤回至草稿箱'
        },
        user
      );
      if (!result.ok) {
        message.error(result.reason || '撤回失败');
        return;
      }
      await addMessage(ticket.id, {
        id: shortId('m'),
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        content: `【系统】提单人已撤回工单，工单已进入草稿箱。${reason ? `撤回说明：${reason}` : ''}`,
        attachments: [],
        createdAt: new Date().toISOString()
      });
      withdrawForm.resetFields();
      setWithdrawOpen(false);
      message.success('工单已撤回，可在草稿箱中找到');
    };

    return (
      <Card title="提单人操作区">
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="工单尚未受理"
            description="在一线受理前，您可以撤回该工单。撤回后工单会进入草稿箱。"
          />
          <Button danger icon={<InboxOutlined />} onClick={() => setWithdrawOpen(true)}>
            撤回到草稿箱
          </Button>
        </Space>

        <Modal
          title="撤回工单"
          open={withdrawOpen}
          onOk={handleWithdrawSubmit}
          onCancel={() => setWithdrawOpen(false)}
          okText="确认撤回"
          cancelText="取消"
          destroyOnClose
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="撤回提醒"
              description="撤回之后，该工单不会继续进入受理流程，您可以稍后在草稿箱中找到它。"
            />
            <Form form={withdrawForm} layout="vertical">
              <Form.Item
                name="reason"
                label="撤回说明"
                extra="选填，便于后续回看为什么撤回。"
              >
                <Input.TextArea
                  rows={4}
                  maxLength={300}
                  showCount
                  placeholder="例如：信息填错了，稍后补充后再提交"
                />
              </Form.Item>
            </Form>
          </Space>
        </Modal>
      </Card>
    );
  }

  if (requesterStatus === STATUS.PROCESSING) {
    const handleRequesterCloseSubmit = async (satisfaction) => {
      const result = await dispatchEvent(
        ticket.id,
        EVENTS.REQUESTER_CLOSE,
        {
          satisfaction,
          closeReason: '提单人主动关单',
          __timelineRemark: `提单人主动关单，满意度 ${satisfaction.rating} 星`
        },
        user
      );
      if (!result.ok) {
        message.error(result.reason || '主动关单失败');
        return;
      }
      await addMessage(ticket.id, {
        id: shortId('m'),
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        content: `【系统】提单人主动关单，工单办结。满意度 ★${satisfaction.rating}/5${satisfaction.comment ? '，评价：' + satisfaction.comment : ''}`,
        attachments: [],
        createdAt: new Date().toISOString()
      });
      setRequesterCloseOpen(false);
      message.success('工单已主动关单');
    };

    return (
      <Card title="提单人操作区">
        <Alert
          type="info"
          showIcon
          message="工单已受理并处理中"
          description="如果问题已经解决，您可以主动关单并提交满意度评价。"
          style={{ marginBottom: 16 }}
        />
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          onClick={() => setRequesterCloseOpen(true)}
        >
          主动关单
        </Button>
        <SatisfactionModal
          open={requesterCloseOpen}
          onOk={handleRequesterCloseSubmit}
          onCancel={() => setRequesterCloseOpen(false)}
        />
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
    const result = await dispatchEvent(
      ticket.id,
      EVENTS.VERIFY_YES,
      { satisfaction, __timelineRemark: `满意度 ${satisfaction.rating} 星` },
      user
    );
    if (!result.ok) {
      message.error(result.reason || '操作失败');
      return;
    }
    await addMessage(ticket.id, {
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
    const result = await dispatchEvent(
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
    await addMessage(ticket.id, {
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

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Typography,
  App as AntdApp,
  Row,
  Col,
  Radio
} from 'antd';
import { SaveOutlined, RollbackOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { TOOL_TYPES, TOOL_TYPE_OPTIONS } from '../../constants/toolTypes.js';
import { PRIORITIES, PRIORITY_OPTIONS, PRIORITY_LABELS } from '../../constants/priorities.js';
import {
  SYSTEM_CATEGORY,
  SYSTEM_CATEGORY_OPTIONS,
  SYSTEM_LABELS,
  getSystemOptionsByCategory
} from '../../constants/systems.js';
import { ROLES } from '../../constants/roles.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { buildAttachments, mapAttachmentsToUploadFileList } from '../../utils/fileUtils.js';
import { buildDraftTicketFormValues } from '../../utils/draftTicketEditing.js';
import { buildMockTicketDescriptionDoc, buildMockTicketFormValues } from '../../utils/ticketSubmitMock.js';
import { createEmptyRichTextDoc, richTextHasContent, richTextToPlainText } from '../../utils/richText.js';
import FileUploader from '../../components/common/FileUploader.jsx';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';
import AiTicketAssistantDrawer from '../../components/TicketSubmit/AiTicketAssistantDrawer.jsx';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function TicketSubmitPage() {
  return <TicketSubmitForm />;
}

export function TicketSubmitForm({ draftTicket = null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { addTicket, dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiTicket, setAiTicket] = useState(null);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [mockGenerating, setMockGenerating] = useState(false);
  const isDraftEdit = Boolean(draftTicket);

  useEffect(() => {
    if (!draftTicket) return;
    form.setFieldsValue(buildDraftTicketFormValues(draftTicket));
    setFileList(mapAttachmentsToUploadFileList(draftTicket.attachments || []));
  }, [draftTicket, form]);

  if (!user || user.role !== ROLES.REQUESTER) {
    return (
      <Card>
        <Typography.Text type="danger">仅提单人可提交工单。</Typography.Text>
      </Card>
    );
  }

  const validatePhone = (_, value) => {
    if (!value) return Promise.resolve();
    if (PHONE_PATTERN.test(value)) return Promise.resolve();
    return Promise.reject(new Error('请输入有效的 11 位手机号码'));
  };

  const validateRichText = (_, value) => {
    if (richTextHasContent(value)) return Promise.resolve();
    return Promise.reject(new Error('请输入问题描述'));
  };

  const handleFillMockTicket = async () => {
    const mockValues = buildMockTicketFormValues();
    form.setFieldsValue(mockValues);
    setFileList([]);
    setMockGenerating(true);

    try {
      const response = await fetch('/api/ai/mock-ticket-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: mockValues })
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.reason || '模拟工单描述生成失败');
      }

      if (payload.description) {
        form.setFieldsValue({
          descriptionDoc: buildMockTicketDescriptionDoc(payload.description)
        });
      }
      message.success('已生成模拟工单数据');
    } catch (error) {
      console.error(error);
      const warningReason = error.message || '大模型描述生成失败';
      message.warning(`已生成本地模拟工单，${warningReason}`);
    } finally {
      setMockGenerating(false);
    }
  };

  const handleFinish = async (values) => {
    setSubmitting(true);
    try {
      const attachments = await buildAttachments(fileList, user);
      if (isDraftEdit) {
        const updateResult = await dispatchEvent(draftTicket.id, EVENTS.UPDATE_DRAFT, {
          values,
          attachments
        });
        if (!updateResult.ok) {
          throw new Error(updateResult.reason || '草稿工单更新失败');
        }

        setAiTicket(updateResult.ticket);
        setAiDrawerOpen(true);
        message.success('工单已保存为草稿，正在尝试大模型解答');
        return;
      }

      const ticket = buildTicketPayload(values, attachments, user, new Date().toISOString());
      const createdTicket = await addTicket(ticket, EVENTS.CREATE_DRAFT);
      setAiTicket(createdTicket);
      setAiDrawerOpen(true);
      message.success('工单已保存为草稿，正在尝试大模型解答');
    } catch (error) {
      console.error(error);
      message.error(error.message || '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAiResolved = async ({ messages, answer }) => {
    if (!aiTicket) return;

    setAiActionLoading(true);
    try {
      const result = await dispatchEvent(aiTicket.id, EVENTS.AI_RESOLVE, {
        aiResolution: {
          answer,
          messages
        },
        __timelineRemark: '提单人确认大模型已解决问题'
      });
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

  const handleManualProcess = async () => {
    if (!aiTicket) return;

    setAiActionLoading(true);
    try {
      const result = await dispatchEvent(aiTicket.id, EVENTS.SUBMIT, {
        __timelineRemark: '提单人选择人工处理，工单进入待受理'
      });
      if (!result.ok) {
        throw new Error(result.reason || '转人工失败');
      }

      setAiDrawerOpen(false);
      message.success(`工单已转人工处理，工单编号：${result.ticket.id}`);
      router.replace(`/tickets/${result.ticket.id}`);
    } catch (error) {
      console.error(error);
      message.error(error.message || '转人工失败');
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    setDraftSaving(true);
    try {
      const values = form.getFieldsValue(true);
      const attachments = await buildAttachments(fileList, user);
      if (isDraftEdit) {
        const result = await dispatchEvent(draftTicket.id, EVENTS.UPDATE_DRAFT, {
          values,
          attachments
        });
        if (!result.ok) {
          throw new Error(result.reason || '草稿工单更新失败');
        }

        message.success('草稿工单已更新');
        return;
      }

      const ticket = buildTicketPayload(values, attachments, user, new Date().toISOString());

      await addTicket(ticket, EVENTS.CREATE_DRAFT);
      message.success('草稿已暂存');
      router.replace('/tickets?tab=DRAFT');
    } catch (error) {
      console.error(error);
      message.error(error.message || '暂存草稿失败，请稍后重试');
    } finally {
      setDraftSaving(false);
    }
  };

  return (
    <div className="ticket-submit-reference-page">
      <div className="ticket-submit-header">
        <Typography.Title level={4} className="ticket-submit-title">
          {isDraftEdit ? '编辑草稿工单' : '提交工单'}
        </Typography.Title>
        {!isDraftEdit && (
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={handleFillMockTicket}
            loading={mockGenerating}
            disabled={submitting || draftSaving}
          >
            一键生成模拟工单
          </Button>
        )}
      </div>
      <Form
        form={form}
        className="reference-ticket-form"
        layout="horizontal"
        labelAlign="right"
        colon={false}
        labelCol={{ flex: '112px' }}
        wrapperCol={{ flex: '1 1 auto' }}
        onFinish={handleFinish}
        initialValues={{
          ...(isDraftEdit
            ? buildDraftTicketFormValues(draftTicket)
            : {
                toolType: TOOL_TYPES.DATA_EXTRACT,
                priority: PRIORITIES.P4,
                systemCategory: SYSTEM_CATEGORY.OLD,
                reportForOthers: false
              })
        }}
      >
        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="工单类型"
                name="toolType"
                rules={[{ required: true, message: '请选择工单类型' }]}
              >
                <Select className="reference-medium-control" options={TOOL_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label="标题"
                name="title"
                rules={[
                  { required: true, message: '请输入标题' },
                  { max: 80, message: '标题不超过 80 个字符' }
                ]}
              >
                <Input className="reference-title-control" allowClear />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label="优先级"
                required
              >
                <div className="reference-priority-inline">
                  <Form.Item
                    name="priority"
                    rules={[{ required: true, message: '请选择优先级' }]}
                    noStyle
                  >
                    <Select className="reference-short-control" options={PRIORITY_OPTIONS} />
                  </Form.Item>
                  <Typography.Text type="secondary" className="priority-sla-hint">
                    工单处理时效 P1: 30分钟，P2：2小时，P3：6小时，P4：8小时
                  </Typography.Text>
                </div>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="新老系统标签"
                name="systemCategory"
                rules={[{ required: true, message: '请选择新老系统标签' }]}
              >
                <Select
                  className="reference-medium-control"
                  options={SYSTEM_CATEGORY_OPTIONS}
                  onChange={() => form.setFieldValue('systemName', undefined)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCategory !== current.systemCategory}>
                {({ getFieldValue }) => (
                  <Form.Item
                    label="系统名称"
                    name="systemName"
                    rules={[{ required: true, message: '请选择系统名称' }]}
                  >
                    <Select
                      className="reference-medium-control"
                      placeholder="请选择..."
                      showSearch
                      optionFilterProp="label"
                      options={getSystemOptionsByCategory(getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="手机号码"
                name="reporterPhone"
                rules={[
                  { required: true, message: '请输入手机号码' },
                  { validator: validatePhone }
                ]}
              >
                <Input className="reference-medium-control" allowClear />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="邮箱"
                name="reporterEmail"
                rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input className="reference-medium-control" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="是否替他人上报"
                name="reportForOthers"
                rules={[{ required: true, message: '请选择是否替他人上报' }]}
              >
                <Radio.Group>
                  <Radio value={false}>否</Radio>
                  <Radio value={true}>是</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.reportForOthers !== current.reportForOthers}>
          {({ getFieldValue }) =>
            getFieldValue('reportForOthers') ? (
              <div className="reference-form-line reference-conditional-line">
                <Row gutter={24}>
                  <Col span={12} offset={12}>
                    <Form.Item
                      label="上报人姓名"
                      name="reportedUserName"
                      rules={[{ required: true, message: '请输入上报人姓名' }]}
                    >
                      <Input className="reference-medium-control" allowClear />
                    </Form.Item>
                  </Col>
                  <Col span={12} offset={12}>
                    <Form.Item
                      label="上报人手机"
                      name="reportedUserPhone"
                      rules={[
                        { required: true, message: '请输入上报人手机号码' },
                        { validator: validatePhone }
                      ]}
                    >
                      <Input className="reference-medium-control" allowClear />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ) : null
          }
        </Form.Item>

        <div className="reference-form-line reference-form-line-tall">
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item
                label="描述"
                name="descriptionDoc"
                rules={[{ validator: validateRichText }]}
              >
                <RichTextEditor disabled={submitting || draftSaving} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line reference-attachment-line">
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item label="附件">
                <FileUploader
                  fileList={fileList}
                  onChange={setFileList}
                  disabled={submitting || draftSaving}
                  variant="dragger"
                  maxCount={10}
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-actions">
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={submitting}
              disabled={draftSaving}
            >
              提交工单
            </Button>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={draftSaving}
              disabled={submitting}
            >
              {isDraftEdit ? '保存草稿' : '暂存草稿'}
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => router.push('/tickets')}
              disabled={submitting || draftSaving}
            >
              返回列表
            </Button>
          </Space>
        </div>
      </Form>
      <AiTicketAssistantDrawer
        open={aiDrawerOpen}
        ticket={aiTicket}
        confirming={aiActionLoading}
        onResolved={handleAiResolved}
        onManual={handleManualProcess}
        onClose={() => setAiDrawerOpen(false)}
      />
    </div>
  );
}

function buildTicketPayload(values = {}, attachments, user, now) {
  const reportForOthers = values.reportForOthers === true;
  const systemName = SYSTEM_LABELS[values.systemName] || values.systemName || '';
  const priority = values.priority || PRIORITIES.P4;
  const priorityLabel = PRIORITY_LABELS[priority] || priority;
  const descriptionDoc = values.descriptionDoc || createEmptyRichTextDoc();

  return {
    title: String(values.title || '').trim(),
    toolType: values.toolType || TOOL_TYPES.DATA_EXTRACT,
    priority,
    priorityLabel,
    systemCategory: values.systemCategory || SYSTEM_CATEGORY.OLD,
    systemCode: values.systemName || '',
    systemName,
    reporterPhone: String(values.reporterPhone || '').trim(),
    reporterEmail: String(values.reporterEmail || '').trim(),
    reportForOthers,
    reportedUserName: reportForOthers ? String(values.reportedUserName || '').trim() : '',
    reportedUserPhone: reportForOthers ? String(values.reportedUserPhone || '').trim() : '',
    description: richTextToPlainText(descriptionDoc),
    descriptionDoc,
    attachments,
    createdAt: now,
    requesterId: user.id,
    requesterName: user.name
  };
}

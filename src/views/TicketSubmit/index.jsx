'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Modal,
  Space,
  Typography,
  App as AntdApp,
  Row,
  Col,
  Radio,
  Table,
  Empty
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
  getSystemOptionsByCategory,
  resolveSelectedSystem
} from '../../constants/systems.js';
import { ROLES } from '../../constants/roles.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import {
  EXCEL_ATTACHMENT_TYPES,
  buildAttachments,
  isExcelAttachment,
  mapAttachmentsToUploadFileList
} from '../../utils/fileUtils.js';
import { buildDraftTicketFormValues } from '../../utils/draftTicketEditing.js';
import { buildMockTicketDescriptionDoc, buildMockTicketFormValues } from '../../utils/ticketSubmitMock.js';
import { createEmptyRichTextDoc, richTextHasContent, richTextToPlainText } from '../../utils/richText.js';
import FileUploader from '../../components/common/FileUploader.jsx';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';
import AiTicketAssistantDrawer from '../../components/TicketSubmit/AiTicketAssistantDrawer.jsx';
import { useSystems } from '../../hooks/useSystems.js';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const PERMISSION_APPLICATION_ATTACHMENT_CATEGORY = 'PERMISSION_APPLICATION';

export default function TicketSubmitPage() {
  return <TicketSubmitForm />;
}

export function TicketSubmitForm({ draftTicket = null }) {
  const router = useRouter();
  const { user } = useAuth();
  const { addTicket, dispatchEvent } = useTickets();
  const { message, modal } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [permissionFileList, setPermissionFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiTicket, setAiTicket] = useState(null);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [mockGenerating, setMockGenerating] = useState(false);
  const [dataFixSchemes, setDataFixSchemes] = useState([]);
  const [dataFixSchemesLoading, setDataFixSchemesLoading] = useState(false);
  const [classificationOptions, setClassificationOptions] = useState([]);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [dataFixSchemeModalOpen, setDataFixSchemeModalOpen] = useState(false);
  const [selectedDataFixSchemeId, setSelectedDataFixSchemeId] = useState('');
  const [dataFixSchemeTitleKeyword, setDataFixSchemeTitleKeyword] = useState('');
  const [invalidFieldKeys, setInvalidFieldKeys] = useState(new Set());
  const { systems, loading: systemsLoading } = useSystems();
  const isDraftEdit = Boolean(draftTicket);

  useEffect(() => {
    if (!draftTicket) return;
    form.setFieldsValue(buildDraftTicketFormValues(draftTicket));
    const { generalAttachments, permissionAttachments } = splitPermissionApplicationAttachments(draftTicket.attachments || []);
    setFileList(mapAttachmentsToUploadFileList(generalAttachments));
    setPermissionFileList(mapAttachmentsToUploadFileList(permissionAttachments));
  }, [draftTicket, form]);

  const selectedSystemCode = Form.useWatch('systemName', form);
  const selectedSystem = resolveSelectedSystem(systems, selectedSystemCode);
  const selectedClassificationConfig = selectedSystem?.ticketClassification || null;

  useEffect(() => {
    if (!selectedClassificationConfig?.dictionaryType) {
      setClassificationOptions([]);
      if (!selectedSystemCode || (!systemsLoading && systems.length > 0)) {
        form.setFieldsValue({
          ticketClassificationOptionId: undefined,
          ticketClassificationDictionaryType: undefined
        });
      }
      return;
    }

    let active = true;
    setClassificationLoading(true);
    form.setFieldValue('ticketClassificationDictionaryType', selectedClassificationConfig.dictionaryType);

    (async () => {
      try {
        const response = await fetch(`/api/dictionaries/options?type=${encodeURIComponent(selectedClassificationConfig.dictionaryType)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!active) return;
        if (!response.ok || payload?.ok === false) {
          setClassificationOptions([]);
          return;
        }
        setClassificationOptions(payload.options || []);
      } catch (error) {
        console.error(error);
        if (active) setClassificationOptions([]);
      } finally {
        if (active) setClassificationLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [form, selectedClassificationConfig?.dictionaryType, selectedSystemCode, systems.length, systemsLoading]);

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

  const getFieldErrorClass = (namePath) =>
    invalidFieldKeys.has(normalizeFieldNamePath(namePath)) ? 'field-error-emphasis' : undefined;

  const handleFieldsChange = (_, allFields) => {
    const nextInvalidFieldKeys = new Set(
      allFields
        .filter((field) => field.errors?.length)
        .map((field) => normalizeFieldNamePath(field.name))
    );
    setInvalidFieldKeys(nextInvalidFieldKeys);
  };

  const handleFinishFailed = ({ errorFields = [] }) => {
    const nextInvalidFieldKeys = new Set(
      errorFields.map((field) => normalizeFieldNamePath(field.name))
    );
    setInvalidFieldKeys(nextInvalidFieldKeys);

    const firstError = errorFields[0];
    if (firstError?.name) {
      form.scrollToField(firstError.name, { block: 'center' });
    }

    const errorMessages = errorFields
      .flatMap((field) => field.errors || [])
      .filter(Boolean);

    modal.warning({
      title: '提交工单校验未通过',
      content: (
        <Space direction="vertical" size={4}>
          <Typography.Text>请先修正表单中的错误项，再提交工单。</Typography.Text>
          {errorMessages.slice(0, 5).map((errorMessage) => (
            <Typography.Text key={errorMessage} type="danger">
              {errorMessage}
            </Typography.Text>
          ))}
        </Space>
      ),
      okText: '知道了'
    });
  };

  const handleFillMockTicket = async () => {
    const mockValues = buildMockTicketFormValues();
    form.setFieldsValue(mockValues);
    setFileList([]);
    setPermissionFileList([]);
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
    setInvalidFieldKeys(new Set());
    if (isStructuredDataExtractTicket(values)) {
      setInvalidFieldKeys(new Set(['isStructuredDataExtract']));
      form.scrollToField('isStructuredDataExtract', { block: 'center' });
      modal.warning({
        title: '结构化数据提取请去提数平台',
        content: '该类需求不通过 ITSM 工单提交，请前往提数平台发起结构化数据提取。',
        okText: '知道了'
      });
      return;
    }

    if (isPermissionTicket(values) && !permissionFileList.length) {
      setInvalidFieldKeys(new Set(['permissionApplicationFile']));
      form.scrollToField('permissionApplicationFile', { block: 'center' });
      modal.warning({
        title: '请上传 Excel 格式的权限申请文件',
        content: '权限申请类工单需要上传 .xls 或 .xlsx 格式的权限申请文件后再提交。',
        okText: '知道了'
      });
      return;
    }

    setSubmitting(true);
    try {
      const attachments = await buildAttachments(fileList, user);
      const permissionAttachments = await buildPermissionApplicationAttachments(permissionFileList, user, values);
      const allAttachments = [
        ...attachments,
        ...permissionAttachments
      ];
      const ticket = buildTicketPayload(values, allAttachments, user, new Date().toISOString(), systems);
      if (isDraftEdit) {
        const updateResult = await dispatchEvent(draftTicket.id, EVENTS.UPDATE_DRAFT, {
          values,
          attachments: allAttachments
        });
        if (!updateResult.ok) {
          throw new Error(updateResult.reason || '草稿工单更新失败');
        }

        if (shouldUseAiFlow(ticket)) {
          setAiTicket(updateResult.ticket);
          setAiDrawerOpen(true);
          message.success('工单已保存为草稿，正在尝试大模型解答');
          return;
        }

        const event = resolveOaSubmitEvent(ticket);
        const submitResult = await dispatchEvent(draftTicket.id, event, ticket);
        if (!submitResult.ok) {
          throw new Error(submitResult.reason || '提交 OA 审批失败');
        }
        message.success('工单已提交 OA 流程');
        router.replace(`/tickets/${submitResult.ticket.id}`);
        return;
      }

      if (!shouldUseAiFlow(ticket)) {
        const event = resolveOaSubmitEvent(ticket);
        const createdTicket = await addTicket(ticket, event);
        message.success('工单已提交 OA 流程');
        router.replace(`/tickets/${createdTicket.id}`);
        return;
      }

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
      const permissionAttachments = await buildPermissionApplicationAttachments(permissionFileList, user, values);
      const allAttachments = [
        ...attachments,
        ...permissionAttachments
      ];
      if (isDraftEdit) {
        const result = await dispatchEvent(draftTicket.id, EVENTS.UPDATE_DRAFT, {
          values,
          attachments: allAttachments
        });
        if (!result.ok) {
          throw new Error(result.reason || '草稿工单更新失败');
        }

        message.success('草稿工单已更新');
        return;
      }

      const ticket = buildTicketPayload(values, allAttachments, user, new Date().toISOString(), systems);

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

  const loadDataFixSchemes = async () => {
    setDataFixSchemesLoading(true);
    try {
      const response = await fetch('/api/data-fix-schemes', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.reason || '加载数据修正方案失败');
      }
      setDataFixSchemes(payload.schemes || []);
    } catch (error) {
      console.error(error);
      message.error(error.message || '加载数据修正方案失败');
    } finally {
      setDataFixSchemesLoading(false);
    }
  };

  const openDataFixSchemeModal = async () => {
    const currentSolution = form.getFieldValue('dataFixSolution') || {};
    setSelectedDataFixSchemeId(currentSolution.selectedSchemeId || '');
    setDataFixSchemeTitleKeyword('');
    setDataFixSchemeModalOpen(true);
    await loadDataFixSchemes();
  };

  const handleConvertDataFixToConsult = () => {
    form.setFieldsValue({
      toolType: TOOL_TYPES.CONSULT,
      dataFixSolution: {}
    });
    setSelectedDataFixSchemeId('');
    setDataFixSchemeTitleKeyword('');
    message.info('已切换为应用系统常规咨询');
  };

  const handleConfirmDataFixScheme = () => {
    const scheme = dataFixSchemes.find((item) => item.id === selectedDataFixSchemeId);
    if (!scheme) {
      message.warning('请选择数据修正方案');
      return;
    }

    const currentSolution = form.getFieldValue('dataFixSolution') || {};
    form.setFieldsValue({
      dataFixSolution: {
        ...currentSolution,
        selectedSchemeId: scheme.id,
        selectedSchemeTitle: scheme.title,
        selectedSchemeDescription: scheme.description,
        requesterSolution: scheme.description
      }
    });
    setDataFixSchemeModalOpen(false);
  };

  const handlePermissionFileChange = (nextFileList) => {
    setPermissionFileList(nextFileList);
    setInvalidFieldKeys((previous) => {
      const next = new Set(previous);
      next.delete('permissionApplicationFile');
      return next;
    });
  };

  const filteredDataFixSchemes = dataFixSchemes.filter((scheme) =>
    String(scheme.title || '').toLowerCase().includes(dataFixSchemeTitleKeyword.trim().toLowerCase())
  );

  const dataFixSchemeColumns = [
    {
      title: '选择',
      dataIndex: 'id',
      width: 72,
      render: (value) => (
        <Radio
          checked={selectedDataFixSchemeId === value}
          onChange={() => setSelectedDataFixSchemeId(value)}
        />
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 220,
      render: (value) => <Typography.Text strong>{value || '-'}</Typography.Text>
    },
    {
      title: '描述',
      dataIndex: 'description',
      render: (value) => (
        <Typography.Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
          {value || '-'}
        </Typography.Paragraph>
      )
    }
  ];

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
        onFinishFailed={handleFinishFailed}
        onFieldsChange={handleFieldsChange}
        initialValues={{
          ...(isDraftEdit
            ? buildDraftTicketFormValues(draftTicket)
            : {
                toolType: TOOL_TYPES.DATA_EXTRACT,
                priority: PRIORITIES.P4,
                systemCategory: SYSTEM_CATEGORY.OLD,
                reportForOthers: false,
                isStructuredDataExtract: false
              })
        }}
      >
        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="工单类型"
                name="toolType"
                className={getFieldErrorClass('toolType')}
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
                className={getFieldErrorClass('title')}
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
                className={getFieldErrorClass('priority')}
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
                className={getFieldErrorClass('systemCategory')}
                rules={[{ required: true, message: '请选择新老系统标签' }]}
              >
                <Select
                  className="reference-medium-control"
                  showSearch
                  optionFilterProp="label"
                  options={SYSTEM_CATEGORY_OPTIONS}
                  onChange={() => form.setFieldsValue({
                    systemName: undefined,
                    ticketClassificationOptionId: undefined,
                    ticketClassificationDictionaryType: undefined
                  })}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item noStyle shouldUpdate={(previous, current) => previous.systemCategory !== current.systemCategory}>
                {({ getFieldValue }) => (
                  <Form.Item
                    label="系统名称"
                    name="systemName"
                    className={getFieldErrorClass('systemName')}
                    rules={[{ required: true, message: '请选择系统名称' }]}
                  >
                    <Select
                      className="reference-medium-control"
                      placeholder="请选择..."
                      showSearch
                      optionFilterProp="label"
                      loading={systemsLoading}
                      options={getSystemOptionsByCategory(systems, getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
                      onChange={() => form.setFieldValue('ticketClassificationOptionId', undefined)}
                    />
                  </Form.Item>
                )}
              </Form.Item>
            </Col>
          </Row>
        </div>

        {selectedClassificationConfig && (
          <div className="reference-form-line">
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item
                  label={selectedClassificationConfig.fieldLabel}
                  name="ticketClassificationOptionId"
                >
                  <Select
                    className="reference-medium-control"
                    allowClear
                    placeholder="请选择..."
                    showSearch
                    optionFilterProp="label"
                    loading={classificationLoading}
                    options={classificationOptions}
                  />
                </Form.Item>
                <Form.Item hidden name="ticketClassificationDictionaryType">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          </div>
        )}

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="手机号码"
                name="reporterPhone"
                className={getFieldErrorClass('reporterPhone')}
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
                className={getFieldErrorClass('reporterEmail')}
                rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input className="reference-medium-control" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="是否替他人上报"
                name="reportForOthers"
                className={getFieldErrorClass('reportForOthers')}
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

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.toolType !== current.toolType || previous.isStructuredDataExtract !== current.isStructuredDataExtract}>
          {({ getFieldValue }) =>
            getFieldValue('toolType') === TOOL_TYPES.DATA_EXTRACT ? (
              <div className="reference-form-line">
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      label="是否结构化"
                      name="isStructuredDataExtract"
                      className={getFieldErrorClass('isStructuredDataExtract')}
                      rules={[{ required: true, message: '请选择是否结构化' }]}
                    >
                      <Radio.Group>
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                    {getFieldValue('isStructuredDataExtract') === true && (
                      <Typography.Text type="danger" style={{ marginLeft: 112 }}>
                        结构化数据提取请去提数平台
                      </Typography.Text>
                    )}
                  </Col>
                </Row>
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.toolType !== current.toolType}>
          {({ getFieldValue }) =>
            getFieldValue('toolType') === TOOL_TYPES.PERMISSION ? (
              <div className="reference-form-line reference-attachment-line">
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      label="权限申请文件"
                      required
                      name="permissionApplicationFile"
                      className={getFieldErrorClass('permissionApplicationFile')}
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Typography.Link href="/api/templates/permission-request" download="权限申请模板.xls">
                          下载权限申请模板
                        </Typography.Link>
                        <FileUploader
                          fileList={permissionFileList}
                          onChange={handlePermissionFileChange}
                          disabled={submitting || draftSaving}
                          maxCount={1}
                          multiple={false}
                          buttonText="上传权限申请文件"
                          acceptedTypes={EXCEL_ATTACHMENT_TYPES}
                          validator={isExcelAttachment}
                          invalidTypeMessage="请上传 Excel 格式的权限申请文件"
                        />
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.toolType !== current.toolType || previous.dataFixSolution !== current.dataFixSolution}>
          {({ getFieldValue }) =>
            getFieldValue('toolType') === TOOL_TYPES.DATA_FIX ? (
              <div className="reference-form-line">
                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item label="数据修正方案">
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Space wrap>
                          <Button onClick={openDataFixSchemeModal} disabled={submitting || draftSaving}>
                            选择数据修正方案
                          </Button>
                          <Button onClick={handleConvertDataFixToConsult} disabled={submitting || draftSaving}>
                            没有方案，转人工咨询
                          </Button>
                        </Space>
                        {getFieldValue(['dataFixSolution', 'selectedSchemeTitle']) && (
                          <Card size="small" title={getFieldValue(['dataFixSolution', 'selectedSchemeTitle'])}>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {getFieldValue(['dataFixSolution', 'selectedSchemeDescription']) || '-'}
                            </Typography.Paragraph>
                          </Card>
                        )}
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            ) : null
          }
        </Form.Item>

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.reportForOthers !== current.reportForOthers}>
          {({ getFieldValue }) =>
            getFieldValue('reportForOthers') ? (
              <div className="reference-form-line reference-conditional-line">
                <Row gutter={24}>
                  <Col span={12} offset={12}>
                    <Form.Item
                      label="上报人姓名"
                      name="reportedUserName"
                      className={getFieldErrorClass('reportedUserName')}
                      rules={[{ required: true, message: '请输入上报人姓名' }]}
                    >
                      <Input className="reference-medium-control" allowClear />
                    </Form.Item>
                  </Col>
                  <Col span={12} offset={12}>
                    <Form.Item
                      label="上报人手机"
                      name="reportedUserPhone"
                      className={getFieldErrorClass('reportedUserPhone')}
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

        <Form.Item noStyle shouldUpdate={(previous, current) => previous.toolType !== current.toolType}>
          {({ getFieldValue }) =>
            getFieldValue('toolType') === TOOL_TYPES.DATA_FIX ? (
              <div className="reference-form-line">
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="关联工单号"
                      name={['dataFixSolution', 'relatedTicketId']}
                      className={getFieldErrorClass(['dataFixSolution', 'relatedTicketId'])}
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
                className={getFieldErrorClass('descriptionDoc')}
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
      <Modal
        title="选择数据修正方案"
        open={dataFixSchemeModalOpen}
        onOk={handleConfirmDataFixScheme}
        onCancel={() => setDataFixSchemeModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={820}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按标题搜索"
            value={dataFixSchemeTitleKeyword}
            onChange={(event) => setDataFixSchemeTitleKeyword(event.target.value)}
          />
          <Table
            rowKey="id"
            columns={dataFixSchemeColumns}
            dataSource={filteredDataFixSchemes}
            loading={dataFixSchemesLoading}
            pagination={{ pageSize: 5 }}
            locale={{ emptyText: <Empty description="暂无数据修正方案" /> }}
            onRow={(record) => ({
              onClick: () => setSelectedDataFixSchemeId(record.id)
            })}
          />
        </Space>
      </Modal>
    </div>
  );
}

function buildTicketPayload(values = {}, attachments, user, now, systems = []) {
  const reportForOthers = values.reportForOthers === true;
  const selectedSystem = resolveSelectedSystem(systems, values.systemName);
  const systemName = selectedSystem?.name || values.systemDisplayName || values.systemName || '';
  const priority = values.priority || PRIORITIES.P4;
  const priorityLabel = PRIORITY_LABELS[priority] || priority;
  const descriptionDoc = values.descriptionDoc || createEmptyRichTextDoc();

  return {
    title: String(values.title || '').trim(),
    toolType: values.toolType || TOOL_TYPES.DATA_EXTRACT,
    priority,
    priorityLabel,
    systemCategory: selectedSystem?.category || values.systemCategory || SYSTEM_CATEGORY.OLD,
    systemCode: selectedSystem?.code || values.systemName || '',
    systemName,
    systemDisplayName: systemName,
    ticketClassification: values.ticketClassificationOptionId
      ? {
          optionId: values.ticketClassificationOptionId,
          dictionaryType: selectedSystem?.ticketClassification?.dictionaryType || values.ticketClassificationDictionaryType
        }
      : undefined,
    reporterPhone: String(values.reporterPhone || '').trim(),
    reporterEmail: String(values.reporterEmail || '').trim(),
    reportForOthers,
    reportedUserName: reportForOthers ? String(values.reportedUserName || '').trim() : '',
    reportedUserPhone: reportForOthers ? String(values.reportedUserPhone || '').trim() : '',
    description: richTextToPlainText(descriptionDoc),
    descriptionDoc,
    dataFixSolution: buildDataFixSolution(values),
    attachments,
    createdAt: now,
    requesterId: user.id,
    requesterName: user.name
  };
}

function buildDataFixSolution(values = {}) {
  const solution = values.dataFixSolution || {};
  return {
    requesterSolution: String(solution.requesterSolution || solution.selectedSchemeDescription || values.requesterSolution || '').trim(),
    relatedTicketId: String(solution.relatedTicketId || values.relatedTicketId || '').trim(),
    selectedSchemeId: String(solution.selectedSchemeId || '').trim(),
    selectedSchemeTitle: String(solution.selectedSchemeTitle || '').trim(),
    selectedSchemeDescription: String(solution.selectedSchemeDescription || '').trim()
  };
}

function splitPermissionApplicationAttachments(attachments = []) {
  return attachments.reduce(
    (result, attachment) => {
      if (attachment?.category === PERMISSION_APPLICATION_ATTACHMENT_CATEGORY) {
        result.permissionAttachments.push(attachment);
      } else {
        result.generalAttachments.push(attachment);
      }
      return result;
    },
    { generalAttachments: [], permissionAttachments: [] }
  );
}

async function buildPermissionApplicationAttachments(permissionFileList, user, values = {}) {
  if (!isPermissionTicket(values)) return [];
  const attachments = await buildAttachments(permissionFileList, user);

  return attachments.map((attachment) => ({
    ...attachment,
    category: PERMISSION_APPLICATION_ATTACHMENT_CATEGORY
  }));
}

function isPermissionTicket(values = {}) {
  return values.toolType === TOOL_TYPES.PERMISSION;
}

function isStructuredDataExtractTicket(values = {}) {
  return values.toolType === TOOL_TYPES.DATA_EXTRACT && values.isStructuredDataExtract === true;
}

function shouldUseAiFlow(ticket = {}) {
  return ticket.toolType === TOOL_TYPES.CONSULT;
}

function normalizeFieldNamePath(namePath) {
  return Array.isArray(namePath) ? namePath.join('.') : String(namePath || '');
}

function resolveOaSubmitEvent(ticket = {}) {
  if (ticket.toolType === TOOL_TYPES.DATA_FIX) {
    return EVENTS.SUBMIT_DATA_FIX_SCHEME_REVIEW;
  }
  return EVENTS.SUBMIT_TO_OA;
}

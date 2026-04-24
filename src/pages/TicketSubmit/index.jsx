import React, { useState } from 'react';
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
import { SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { TOOL_TYPES, TOOL_TYPE_OPTIONS } from '../../constants/toolTypes.js';
import { PRIORITIES, PRIORITY_OPTIONS, PRIORITY_LABELS } from '../../constants/priorities.js';
import { SYSTEM_OPTIONS, SYSTEM_LABELS } from '../../constants/systems.js';
import { STATUS, getDualStatusesForWorkflowStatus } from '../../constants/ticketStatus.js';
import { ROLES } from '../../constants/roles.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { generateTicketId } from '../../utils/idGenerator.js';
import { buildAttachments } from '../../utils/fileUtils.js';
import { calculateTicketExpiresAt } from '../../utils/sla.js';
import FileUploader from '../../components/common/FileUploader.jsx';
import RichTextEditor from '../../components/common/RichTextEditor.jsx';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

function richTextHasContent(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  return Boolean(wrapper.textContent.trim() || wrapper.querySelector('img'));
}

function richTextToPlainText(html) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html || '';
  return wrapper.textContent.trim();
}

export default function TicketSubmitPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tickets, addTicket } = useTickets();
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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

  const handleFinish = async (values) => {
    setSubmitting(true);
    try {
      const attachments = await buildAttachments(fileList, user);
      const now = new Date().toISOString();
      const id = generateTicketId(tickets);
      const reportForOthers = values.reportForOthers === true;
      const systemName = SYSTEM_LABELS[values.systemName] || values.systemName;
      const priorityLabel = PRIORITY_LABELS[values.priority] || values.priority;
      const descriptionHtml = values.descriptionHtml || '';
      const expiresAt = calculateTicketExpiresAt(now, values.priority);
      const initialStatuses = getDualStatusesForWorkflowStatus(STATUS.PENDING);

      const ticket = {
        id,
        title: values.title.trim(),
        toolType: values.toolType,
        priority: values.priority,
        priorityLabel,
        systemCode: values.systemName,
        systemName,
        expiresAt,
        reporterPhone: values.reporterPhone.trim(),
        reporterEmail: values.reporterEmail?.trim() || '',
        reportForOthers,
        reportedUserName: reportForOthers ? values.reportedUserName.trim() : '',
        reportedUserPhone: reportForOthers ? values.reportedUserPhone.trim() : '',
        description: richTextToPlainText(descriptionHtml),
        descriptionHtml,
        attachments,
        status: STATUS.PENDING,
        requesterStatus: initialStatuses.requesterStatus,
        supportStatus: initialStatuses.supportStatus,
        createdAt: now,
        updatedAt: now,
        requesterId: user.id,
        requesterName: user.name,
        assigneeL1Id: null,
        assigneeL1Name: null,
        assigneeL2Id: null,
        assigneeL2Name: null,
        messages: [],
        defectTag: null,
        linkedDefect: null,
        l2Conclusion: '',
        summary: '',
        summarySyncedToCorpus: false,
        rejectionReason: '',
        satisfaction: null,
        timeline: [
          {
            action: EVENTS.SUBMIT,
            actionLabel: '提交工单',
            fromStatus: null,
            toStatus: STATUS.PENDING,
            operator: user.name,
            operatorId: user.id,
            role: user.role,
            at: now,
            remark: '新建工单'
          }
        ]
      };

      addTicket(ticket);
      message.success(`工单已提交，工单编号：${id}`);
      navigate(`/tickets/${id}`, { replace: true });
    } catch (error) {
      console.error(error);
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ticket-submit-reference-page">
      <Typography.Title level={4} className="ticket-submit-title">
        提交工单
      </Typography.Title>
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
          toolType: TOOL_TYPES.DATA_EXTRACT,
          priority: PRIORITIES.P4,
          reportForOthers: false
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
            <Col span={12}>
              <Form.Item
                label="优先级"
                name="priority"
                rules={[{ required: true, message: '请选择优先级' }]}
              >
                <Space align="center" size={12}>
                  <Select className="reference-short-control" options={PRIORITY_OPTIONS} />
                  <Typography.Text type="secondary" className="priority-sla-hint">
                    SLA时效 P1: 30分钟，P2：2小时，P3：6小时，P4：8小时
                  </Typography.Text>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </div>

        <div className="reference-form-line">
          <Row gutter={24}>
            <Col span={12}>
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
                  options={SYSTEM_OPTIONS}
                />
              </Form.Item>
            </Col>
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
                name="descriptionHtml"
                rules={[{ validator: validateRichText }]}
              >
                <RichTextEditor disabled={submitting} />
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
                  disabled={submitting}
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
            >
              提交工单
            </Button>
            <Button
              icon={<RollbackOutlined />}
              onClick={() => navigate('/tickets')}
              disabled={submitting}
            >
              返回列表
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
}

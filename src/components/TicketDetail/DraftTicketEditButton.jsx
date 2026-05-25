import React, { useState } from 'react';
import {
  App as AntdApp,
  Button,
  Form,
  Input,
  Modal,
  Radio,
  Select,
  Space
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { STATUS, getRequesterStatus } from '../../constants/ticketStatus.js';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { TOOL_TYPE_OPTIONS } from '../../constants/toolTypes.js';
import { PRIORITY_OPTIONS } from '../../constants/priorities.js';
import { SYSTEM_CATEGORY, getSystemOptionsByCategory, resolveSelectedSystem } from '../../constants/systems.js';
import RichTextEditor from '../common/RichTextEditor.jsx';
import FileUploader from '../common/FileUploader.jsx';
import { buildAttachments, mapAttachmentsToUploadFileList } from '../../utils/fileUtils.js';
import { buildDraftTicketFormValues } from '../../utils/draftTicketEditing.js';
import { richTextHasContent } from '../../utils/richText.js';
import { useSystems } from '../../hooks/useSystems.js';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function DraftTicketEditButton({ ticket }) {
  const { user } = useAuth();
  const { dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [open, setOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [classificationOptions, setClassificationOptions] = useState([]);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { systems, loading: systemsLoading } = useSystems();
  const selectedSystemCode = Form.useWatch('systemName', form);
  const selectedSystem = resolveSelectedSystem(systems, selectedSystemCode);
  const selectedClassificationConfig = selectedSystem?.ticketClassification || null;

  React.useEffect(() => {
    if (!open || !selectedClassificationConfig?.dictionaryType) {
      setClassificationOptions([]);
      if (open && (!selectedSystemCode || (!systemsLoading && systems.length > 0))) {
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
  }, [form, open, selectedClassificationConfig?.dictionaryType, selectedSystemCode, systems.length, systemsLoading]);

  if (!ticket || !user || ticket.oaLocked || getRequesterStatus(ticket) !== STATUS.DRAFT) {
    return null;
  }

  const validatePhone = (_, value) => {
    if (!value || PHONE_PATTERN.test(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('请输入有效的 11 位手机号码'));
  };

  const validateRichText = (_, value) => {
    if (richTextHasContent(value)) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('请输入问题描述'));
  };

  const handleOpen = () => {
    form.setFieldsValue(buildDraftTicketFormValues(ticket));
    setFileList(mapAttachmentsToUploadFileList(ticket.attachments || []));
    setOpen(true);
  };

  const handleSave = async () => {
    const values = form.getFieldsValue(true);
    setSaving(true);
    try {
      const attachments = await buildAttachments(fileList, user);
      const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_DRAFT, {
        values,
        attachments
      });
      if (!result.ok) {
        throw new Error(result.reason || '草稿工单更新失败');
      }
      setOpen(false);
      message.success('草稿工单已更新');
    } catch (error) {
      console.error(error);
      message.error(error.message || '草稿工单更新失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="small" icon={<EditOutlined />} onClick={handleOpen}>
        修改工单要素
      </Button>
      <Modal
        title="修改草稿工单"
        open={open}
        onOk={handleSave}
        onCancel={() => setOpen(false)}
        okText="保存草稿"
        cancelText="取消"
        width={960}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ reportForOthers: false }}
        >
          <Form.Item
            label="工单类型"
            name="toolType"
            rules={[{ required: true, message: '请选择工单类型' }]}
          >
            <Select options={TOOL_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            label="标题"
            name="title"
            rules={[
              { required: true, message: '请输入标题' },
              { max: 80, message: '标题不超过 80 个字符' }
            ]}
          >
            <Input allowClear />
          </Form.Item>

          <Form.Item
            label="优先级"
            name="priority"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select options={PRIORITY_OPTIONS} />
          </Form.Item>

          <Form.Item
            hidden
            name="systemCategory"
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="系统名称"
            name="systemName"
            rules={[{ required: true, message: '请选择系统名称' }]}
          >
            <Select
              placeholder="请选择..."
              showSearch
              optionFilterProp="label"
              loading={systemsLoading}
              options={getSystemOptionsByCategory(systems, form.getFieldValue('systemCategory') || SYSTEM_CATEGORY.OLD)}
              onChange={() => form.setFieldValue('ticketClassificationOptionId', undefined)}
            />
          </Form.Item>

          {selectedClassificationConfig && (
            <>
              <Form.Item label={selectedClassificationConfig.fieldLabel} name="ticketClassificationOptionId">
                <Select
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
            </>
          )}

          <Form.Item
            label="手机号码"
            name="reporterPhone"
            rules={[
              { required: true, message: '请输入手机号码' },
              { validator: validatePhone }
            ]}
          >
            <Input allowClear />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="reporterEmail"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input allowClear />
          </Form.Item>

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

          <Form.Item noStyle shouldUpdate={(previous, current) => previous.reportForOthers !== current.reportForOthers}>
            {({ getFieldValue }) =>
              getFieldValue('reportForOthers') ? (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Form.Item
                    label="上报人姓名"
                    name="reportedUserName"
                    rules={[{ required: true, message: '请输入上报人姓名' }]}
                  >
                    <Input allowClear />
                  </Form.Item>
                  <Form.Item
                    label="上报人手机"
                    name="reportedUserPhone"
                    rules={[
                      { required: true, message: '请输入上报人手机号码' },
                      { validator: validatePhone }
                    ]}
                  >
                    <Input allowClear />
                  </Form.Item>
                </Space>
              ) : null
            }
          </Form.Item>

          <Form.Item
            label="描述"
            name="descriptionDoc"
            rules={[{ validator: validateRichText }]}
          >
            <RichTextEditor disabled={saving} />
          </Form.Item>

          <Form.Item label="附件">
            <FileUploader
              fileList={fileList}
              onChange={setFileList}
              disabled={saving}
              variant="dragger"
              maxCount={10}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

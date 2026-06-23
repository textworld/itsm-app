import React, { useMemo, useState } from 'react';
import {
  Card,
  Space,
  Select,
  Button,
  Popconfirm,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  App as AntdApp
} from 'antd';
import { LinkOutlined, PlusOutlined, DisconnectOutlined } from '@ant-design/icons';
import { useTickets } from '../../context/TicketContext.jsx';

const PRIORITY_OPTIONS = [
  { label: 'P0 (致命)', value: 'P0' },
  { label: 'P1 (严重)', value: 'P1' },
  { label: 'P2 (一般)', value: 'P2' },
  { label: 'P3 (次要)', value: 'P3' }
];

/**
 * 关联缺陷面板
 * - 搜索项目缺陷池(defects) 关联
 * - "创建新缺陷"：写入 defects 并回选
 * - 已关联时展示当前缺陷摘要 + 取消关联按钮
 */
export default function LinkDefectPanel({
  ticket,
  onChange,
  disabled,
  variant = 'card'
}) {
  const { defects, addDefect } = useTickets();
  const { message } = AntdApp.useApp();
  const [selectedId, setSelectedId] = useState(ticket?.linkedDefect?.defectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  React.useEffect(() => {
    setSelectedId(ticket?.linkedDefect?.defectId || undefined);
  }, [ticket?.id, ticket?.linkedDefect?.defectId]);

  const defectOptions = useMemo(
    () =>
      defects.map((d) => ({
        label: `${d.defectId} | ${d.title} (${d.module} · ${d.priority})`,
        value: d.defectId,
        _raw: d
      })),
    [defects]
  );

  const handleLink = async () => {
    if (!selectedId) {
      message.warning('请先选择要关联的缺陷');
      return;
    }
    const hit = defects.find((d) => d.defectId === selectedId);
    if (!hit) return;
    try {
      await onChange({
        defectId: hit.defectId,
        title: hit.title,
        module: hit.module,
        priority: hit.priority,
        isNew: false
      });
      message.success(`已关联缺陷 ${hit.defectId}`);
    } catch (error) {
      console.error(error);
      message.error(error.message || '关联缺陷失败');
    }
  };

  const handleUnlink = async () => {
    try {
      await onChange(null);
      setSelectedId(undefined);
      message.success('已取消关联');
    } catch (error) {
      console.error(error);
      message.error(error.message || '取消关联失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const id = `BUG-${now.getFullYear()}-${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
      const defect = {
        defectId: id,
        title: values.title.trim(),
        module: values.module.trim(),
        priority: values.priority,
        status: '新建',
        createdAt: now.toISOString()
      };
      await addDefect(defect);
      await onChange({
        defectId: defect.defectId,
        title: defect.title,
        module: defect.module,
        priority: defect.priority,
        isNew: true
      });
      setSelectedId(defect.defectId);
      setCreateOpen(false);
      createForm.resetFields();
      message.success(`已创建并关联缺陷 ${defect.defectId}`);
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      console.error(error);
      message.error(error.message || '创建缺陷失败');
    }
  };

  const linked = ticket?.linkedDefect;
  const content = linked ? (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Space wrap>
        <Tag color="blue">{linked.defectId}</Tag>
        <Tag color="geekblue">{linked.module}</Tag>
        <Tag color="red">{linked.priority}</Tag>
        {linked.isNew && <Tag color="success">本次新建</Tag>}
      </Space>
      <Typography.Text>{linked.title}</Typography.Text>
      <Popconfirm
        title="确认取消关联该缺陷？"
        description="取消后需要重新选择或新建缺陷，才能继续流转二线支持。"
        okText="确认取消"
        cancelText="取消"
        onConfirm={handleUnlink}
        disabled={disabled}
      >
        <Button
          danger
          size="small"
          icon={<DisconnectOutlined />}
          disabled={disabled}
        >
          取消关联
        </Button>
      </Popconfirm>
    </Space>
  ) : (
    <Space style={{ width: '100%' }} wrap>
      <Select
        showSearch
        allowClear
        placeholder="输入缺陷ID/标题搜索"
        style={{ minWidth: 360 }}
        value={selectedId}
        onChange={setSelectedId}
        options={defectOptions}
        filterOption={(input, option) =>
          (option?.label || '').toLowerCase().includes(input.toLowerCase())
        }
        disabled={disabled}
      />
      <Popconfirm
        title="确认关联该缺陷？"
        description="关联后即可继续发起二线支持。"
        okText="确认关联"
        cancelText="取消"
        onConfirm={handleLink}
        disabled={disabled || !selectedId}
      >
        <Button type="primary" disabled={disabled || !selectedId}>
          关联
        </Button>
      </Popconfirm>
    </Space>
  );

  const createButton = (
    <Button
      type="link"
      icon={<PlusOutlined />}
      onClick={() => setCreateOpen(true)}
      disabled={disabled}
    >
      创建新缺陷
    </Button>
  );

  return (
    <>
      {variant === 'embedded' ? (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <LinkOutlined />
              <Typography.Text strong>关联项目缺陷</Typography.Text>
            </Space>
            {createButton}
          </Space>
          {content}
        </Space>
      ) : (
        <Card
          type="inner"
          title={
            <Space>
              <LinkOutlined />
              关联项目缺陷
            </Space>
          }
          extra={createButton}
        >
          {content}
        </Card>
      )}

      <Modal
        title="创建新缺陷"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建并关联"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="title"
            label="缺陷标题"
            rules={[{ required: true, message: '请输入缺陷标题' }]}
          >
            <Input placeholder="简要描述缺陷现象" />
          </Form.Item>
          <Form.Item
            name="module"
            label="所属模块"
            rules={[{ required: true, message: '请输入模块名' }]}
          >
            <Input placeholder="例如：报表中心 / 用户中心" />
          </Form.Item>
          <Form.Item
            name="priority"
            label="优先级"
            rules={[{ required: true, message: '请选择优先级' }]}
          >
            <Select options={PRIORITY_OPTIONS} placeholder="请选择优先级" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

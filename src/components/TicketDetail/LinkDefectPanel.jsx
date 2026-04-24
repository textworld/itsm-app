import React, { useMemo, useState } from 'react';
import {
  Card,
  Space,
  Select,
  Button,
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
export default function LinkDefectPanel({ ticket, onChange, disabled }) {
  const { defects, addDefect } = useTickets();
  const { message } = AntdApp.useApp();
  const [selectedId, setSelectedId] = useState(ticket?.linkedDefect?.defectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const defectOptions = useMemo(
    () =>
      defects.map((d) => ({
        label: `${d.defectId} | ${d.title} (${d.module} · ${d.priority})`,
        value: d.defectId,
        _raw: d
      })),
    [defects]
  );

  const handleLink = () => {
    if (!selectedId) {
      message.warning('请先选择要关联的缺陷');
      return;
    }
    const hit = defects.find((d) => d.defectId === selectedId);
    if (!hit) return;
    onChange({
      defectId: hit.defectId,
      title: hit.title,
      module: hit.module,
      priority: hit.priority,
      isNew: false
    });
    message.success(`已关联缺陷 ${hit.defectId}`);
  };

  const handleUnlink = () => {
    onChange(null);
    setSelectedId(undefined);
    message.success('已取消关联');
  };

  const handleCreate = async () => {
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
    addDefect(defect);
    onChange({
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
  };

  const linked = ticket?.linkedDefect;

  return (
    <Card
      type="inner"
      title={
        <Space>
          <LinkOutlined />
          关联项目缺陷
        </Space>
      }
      extra={
        <Button
          type="link"
          icon={<PlusOutlined />}
          onClick={() => setCreateOpen(true)}
          disabled={disabled}
        >
          创建新缺陷
        </Button>
      }
    >
      {linked ? (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="blue">{linked.defectId}</Tag>
            <Tag color="geekblue">{linked.module}</Tag>
            <Tag color="red">{linked.priority}</Tag>
            {linked.isNew && <Tag color="success">本次新建</Tag>}
          </Space>
          <Typography.Text>{linked.title}</Typography.Text>
          <Button
            danger
            size="small"
            icon={<DisconnectOutlined />}
            onClick={handleUnlink}
            disabled={disabled}
          >
            取消关联
          </Button>
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
          <Button type="primary" onClick={handleLink} disabled={disabled}>
            关联
          </Button>
        </Space>
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
    </Card>
  );
}

import React from 'react';
import { Modal, Form, Input, Select } from 'antd';

const DEFECT_TYPE_OPTIONS = [
  { label: '功能缺陷', value: '功能缺陷' },
  { label: '性能问题', value: '性能问题' },
  { label: '数据问题', value: '数据问题' },
  { label: '权限问题', value: '权限问题' },
  { label: '其他', value: '其他' }
];

/**
 * "打标为缺陷"弹窗
 * 必填：缺陷类型、缺陷描述
 */
export default function DefectTagModal({ open, initialValue, onOk, onCancel }) {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (open) {
      form.setFieldsValue(
        initialValue || {
          type: undefined,
          description: ''
        }
      );
    }
  }, [open, initialValue, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    onOk(values);
  };

  return (
    <Modal
      title="打标为缺陷"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="保存打标"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="type"
          label="缺陷类型"
          rules={[{ required: true, message: '请选择缺陷类型' }]}
        >
          <Select placeholder="请选择缺陷类型" options={DEFECT_TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="description"
          label="缺陷描述"
          rules={[
            { required: true, message: '请输入缺陷描述' },
            { min: 5, message: '至少 5 个字符' }
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={300}
            showCount
            placeholder="简要描述缺陷现象、触发条件与影响..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

import React, { useState } from 'react';
import { Modal, Rate, Input, Form } from 'antd';

/**
 * 满意度评价弹窗 (1-5 星 + 评价文本)
 * 验证"是"时弹出，提交后会将 satisfaction 写入工单。
 */
export default function SatisfactionModal({ open, onOk, onCancel }) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await onOk({
        rating: values.rating,
        comment: values.comment?.trim() || ''
      });
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="满意度评价"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      confirmLoading={submitting}
      okText="提交评价并办结工单"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ rating: 5 }}>
        <Form.Item
          name="rating"
          label="满意度"
          rules={[{ required: true, message: '请为本次服务打分' }]}
        >
          <Rate />
        </Form.Item>
        <Form.Item name="comment" label="评价文本">
          <Input.TextArea
            rows={4}
            maxLength={300}
            showCount
            placeholder="请简要说明您的评价..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

import React from 'react';
import { Tag } from 'antd';
import { STATUS_COLORS, STATUS_LABELS } from '../../constants/ticketStatus.js';

/** 工单状态彩色 Tag */
export default function StatusTag({ status }) {
  if (!status) return null;
  return (
    <Tag color={STATUS_COLORS[status] || 'default'}>
      {STATUS_LABELS[status] || status}
    </Tag>
  );
}

import React, { useMemo, useState } from 'react';
import { App as AntdApp, Select, Space, Typography } from 'antd';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { EVENTS } from '../../state-machine/ticketStateMachine.js';
import { getReusableCustomTags, getUserTicketTags } from '../../utils/customTicketTags.js';

export default function CustomTicketTags({ ticket }) {
  const { user } = useAuth();
  const { tickets, dispatchEvent } = useTickets();
  const { message } = AntdApp.useApp();
  const [saving, setSaving] = useState(false);

  const currentTags = useMemo(
    () => getUserTicketTags(ticket, user?.id),
    [ticket, user?.id]
  );
  const reusableTags = useMemo(
    () => getReusableCustomTags(tickets, user?.id),
    [tickets, user?.id]
  );

  if (!ticket || !user) return null;

  const handleChange = async (tags) => {
    setSaving(true);
    const result = await dispatchEvent(ticket.id, EVENTS.UPDATE_CUSTOM_TAGS, { tags });
    setSaving(false);
    if (!result.ok) {
      message.error(result.reason || '更新自定义标签失败');
      return;
    }
    message.success('自定义标签已更新');
  };

  return (
    <Space direction="vertical" size={4} className="ticket-custom-tags">
      <Typography.Text strong>自定义标签</Typography.Text>
      <Select
        mode="tags"
        allowClear
        placeholder="添加或选择标签"
        value={currentTags}
        options={reusableTags.map((tag) => ({ label: tag, value: tag }))}
        onChange={handleChange}
        loading={saving}
        style={{ minWidth: 260 }}
      />
    </Space>
  );
}

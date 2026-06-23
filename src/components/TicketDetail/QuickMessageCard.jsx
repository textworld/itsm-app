import React, { useRef, useState } from 'react';
import { Card, Button, Input, Space, App as AntdApp } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { isTicketMessageAllowed, submitMessageDraft } from './messageComposer.js';
import FileUploader from '../common/FileUploader.jsx';

export default function QuickMessageCard({ ticket, onViewAllMessages }) {
  const { user } = useAuth();
  const { addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [content, setContent] = useState('');
  const [fileList, setFileList] = useState([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const allowMessage = isTicketMessageAllowed(ticket);

  const handleSend = async () => {
    if (sendingRef.current) {
      return;
    }

    if (!allowMessage) {
      message.warning('草稿箱状态不允许留言');
      return;
    }

    const trimmedContent = content.trim();

    if (!ticket?.id) {
      message.error('工单信息缺失');
      return;
    }

    sendingRef.current = true;
    setSending(true);

    try {
      await submitMessageDraft({
        ticketId: ticket?.id,
        addMessage,
        content: trimmedContent,
        fileList,
        user
      });

      setContent('');
      setFileList([]);
      message.success('留言已发送');
    } catch (error) {
      console.error(error);
      if (error?.message === '当前用户信息缺失') {
        message.error('当前用户信息缺失');
      } else if (error?.message === '请输入留言内容或上传附件') {
        message.warning('请输入留言内容或上传附件');
      } else {
        message.error('留言发送失败');
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Card title="快速留言">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Input.TextArea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={allowMessage ? '请输入留言内容' : '草稿箱状态不允许留言'}
          autoSize={{ minRows: 4, maxRows: 8 }}
          disabled={sending || !allowMessage}
        />
        <Space wrap size={12} style={{ width: '100%' }}>
          <FileUploader
            fileList={fileList}
            onChange={setFileList}
            disabled={sending || !allowMessage}
            buttonText="留言附件"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={sending || !allowMessage}
          >
            发送留言
          </Button>
          <Button type="text" onClick={onViewAllMessages}>
            查看全部留言
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

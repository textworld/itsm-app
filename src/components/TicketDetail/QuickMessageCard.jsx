import React, { useRef, useState } from 'react';
import { Card, Button, Input, Space, App as AntdApp } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { submitMessageDraft } from './messageComposer.js';
import FileUploader from '../common/FileUploader.jsx';

export default function QuickMessageCard({ ticket, onViewAllMessages }) {
  const { user } = useAuth();
  const { addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [content, setContent] = useState('');
  const [fileList, setFileList] = useState([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  const handleSend = async () => {
    if (sendingRef.current) {
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
          placeholder="请输入留言内容"
          autoSize={{ minRows: 4, maxRows: 8 }}
          disabled={sending}
        />
        <Space wrap size={12} style={{ width: '100%' }}>
          <FileUploader
            fileList={fileList}
            onChange={setFileList}
            disabled={sending}
            buttonText="留言附件"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={sending}
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

import React, { useMemo, useRef, useState } from 'react';
import {
  Card,
  Avatar,
  Button,
  Space,
  Typography,
  Tag,
  App as AntdApp,
  Empty
} from 'antd';
import {
  SendOutlined,
  UserOutlined,
  MessageOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTickets } from '../../context/TicketContext.jsx';
import { ROLE_LABELS } from '../../constants/roles.js';
import { formatDateTime, byCreatedAtDesc } from '../../utils/format.js';
import { createEmptyRichTextDoc } from '../../utils/richText.js';
import {
  buildQuotePreview,
  getVisibleMessages,
  isTicketMessageAllowed,
  submitMessageDraft
} from './messageComposer.js';
import FileUploader from '../common/FileUploader.jsx';
import AttachmentList from '../common/AttachmentList.jsx';
import RichContentPreview from '../common/RichContentPreview.jsx';
import RichTextEditor from '../common/RichTextEditor.jsx';

export default function MessageBoard({ ticket, readOnly }) {
  const { user } = useAuth();
  const { addMessage } = useTickets();
  const { message } = AntdApp.useApp();
  const [contentDoc, setContentDoc] = useState(createEmptyRichTextDoc());
  const [fileList, setFileList] = useState([]);
  const [sending, setSending] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState(null);
  const sendingRef = useRef(false);

  const messages = useMemo(
    () => getVisibleMessages(ticket?.messages || []).sort(byCreatedAtDesc),
    [ticket?.messages]
  );
  const allowMessage = isTicketMessageAllowed(ticket);

  const handleSend = async () => {
    if (sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setSending(true);
    try {
      await submitMessageDraft({
        ticketId: ticket?.id,
        addMessage,
        contentDoc,
        fileList,
        user,
        quotedMessage
      });

      setContentDoc(createEmptyRichTextDoc());
      setFileList([]);
      setQuotedMessage(null);
      message.success('留言已发送');
    } catch (error) {
      console.error(error);
      if (error?.message === '工单信息缺失') {
        message.error('工单信息缺失，无法发送留言');
      } else if (error?.message === '请输入留言内容或上传附件') {
        message.warning('请输入留言内容或上传附件');
      } else if (error?.message === '当前用户信息缺失' || error?.message === '当前用户信息不完整') {
        message.error(error.message);
      } else {
        message.error('留言发送失败');
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <Card
      title={
        <Space>
          留言区
          <Tag color="blue">{messages.length} 条留言</Tag>
          <Typography.Text type="secondary">按时间倒序</Typography.Text>
        </Space>
      }
    >
      {!readOnly && allowMessage && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }}>
          {quotedMessage && (
            <div className="message-quote-editor">
              <div className="message-quote-editor-main">
                <Typography.Text strong>正在引用 {quotedMessage.authorName}</Typography.Text>
                <Typography.Paragraph className="message-quote-editor-text">
                  {buildQuotePreview(quotedMessage)}
                </Typography.Paragraph>
              </div>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setQuotedMessage(null)}
              />
            </div>
          )}
          <RichTextEditor
            value={contentDoc}
            onChange={setContentDoc}
            disabled={sending}
            placeholder="输入留言内容，支持富文本、图片和引用回复..."
          />
          <Space wrap>
            <FileUploader
              fileList={fileList}
              onChange={setFileList}
              disabled={sending}
              buttonText="留言附件"
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
              onClick={handleSend}
            >
              发送留言
            </Button>
          </Space>
        </Space>
      )}

      {messages.length === 0 ? (
        <Empty description="暂无留言" />
      ) : (
        <div className="message-thread">
          {messages.map((messageItem) => (
            <div key={messageItem.id} className="message-thread-item">
              <div className="message-thread-avatar">
                <Avatar className="message-thread-avatar-inner" icon={<UserOutlined />} />
              </div>
              <div className="message-thread-body">
                <div className="message-thread-header">
                  <Space size={8} wrap>
                    <Typography.Text strong>{messageItem.authorName}</Typography.Text>
                    <Tag color={tagColorOfRole(messageItem.authorRole)}>
                      {ROLE_LABELS[messageItem.authorRole] || messageItem.authorRole}
                    </Tag>
                  </Space>
                  <Typography.Text type="secondary">
                    {formatDateTime(messageItem.createdAt)}
                  </Typography.Text>
                </div>

                {messageItem.quote && (
                  <div className="message-quote-block">
                    <Typography.Text strong>{messageItem.quote.authorName}</Typography.Text>
                    <Typography.Paragraph className="message-quote-block-text">
                      {messageItem.quote.previewText}
                    </Typography.Paragraph>
                  </div>
                )}

                <div style={{ marginBottom: messageItem.attachments?.length ? 8 : 0 }}>
                  <RichContentPreview
                    className="message-rich-content"
                    doc={messageItem.contentDoc}
                    html={messageItem.contentHtml}
                    text={messageItem.content}
                    emptyText="(无文本内容)"
                  />
                </div>

                {messageItem.attachments && messageItem.attachments.length > 0 && (
                  <AttachmentList attachments={messageItem.attachments} compact />
                )}

                {!readOnly && allowMessage && (
                  <div className="message-thread-actions">
                    <Button
                      type="text"
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={() => setQuotedMessage(messageItem)}
                    >
                      引用
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!readOnly && !allowMessage && (
        <Typography.Text type="secondary">
          草稿箱状态不允许留言，请先提交工单后再进行沟通。
        </Typography.Text>
      )}
    </Card>
  );
}

function tagColorOfRole(role) {
  switch (role) {
    case 'REQUESTER':
      return 'blue';
    case 'L1':
      return 'geekblue';
    case 'L2':
      return 'purple';
    default:
      return 'default';
  }
}

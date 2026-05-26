'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Alert, App as AntdApp, Button, Drawer, Input, Space, Spin, Typography } from 'antd';

const INITIAL_USER_MESSAGE = '请根据这张工单的信息，先尝试给出解决方案。';

export default function AiTicketAssistantDrawer({
  open,
  ticket,
  onResolved,
  onManual,
  onClose,
  confirming = false
}) {
  const { message } = AntdApp.useApp();
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const startedTicketIdRef = useRef(null);
  const streamAbortRef = useRef(null);

  useEffect(() => {
    if (!open || !ticket?.id || startedTicketIdRef.current === ticket.id) return;

    startedTicketIdRef.current = ticket.id;
    const initialMessages = [{ role: 'user', content: INITIAL_USER_MESSAGE }];
    setMessages([]);
    setError('');
    void streamAssistantReply(initialMessages);
  }, [open, ticket?.id]);

  const abortStreaming = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    setStreaming(false);
  };

  const streamAssistantReply = async (nextMessages) => {
    abortStreaming();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setStreaming(true);
    setError('');
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('/api/submission/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, messages: nextMessages }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      if (!response.body) {
        throw new Error('大模型未返回流式内容');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantContent += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((item, index) =>
            index === nextMessages.length ? { ...item, content: assistantContent } : item
          )
        );
      }
    } catch (streamError) {
      if (streamError?.name === 'AbortError') {
        return;
      }
      console.error(streamError);
      const reason = streamError.message || '大模型解答失败';
      setError(reason);
      message.error(reason);
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      setStreaming(false);
    }
  };

  const handleAskFollowUp = () => {
    const content = question.trim();
    if (!content || streaming) return;

    const nextMessages = [...messages, { role: 'user', content }];
    setQuestion('');
    void streamAssistantReply(nextMessages);
  };

  const handleResolved = () => {
    const answer = [...messages].reverse().find((item) => item.role === 'assistant')?.content || '';
    onResolved?.({ messages, answer });
  };

  const handleManualSubmit = () => {
    abortStreaming();
    onManual?.();
  };

  const handleClose = () => {
    abortStreaming();
    onClose?.();
  };

  return (
    <Drawer
      title="大模型尝试解答"
      open={open}
      onClose={handleClose}
      width={640}
      destroyOnClose
      maskClosable={false}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="工单已先保存为草稿"
          description="请先查看大模型建议。若问题已解决可直接办结；若仍需支持，可转人工进入待受理。"
        />

        <div className="ai-ticket-chat-panel">
          {messages.map((item, index) => {
            const isUser = item.role === 'user';
            return (
              <div key={`${item.role}_${index}`} className={`ai-ticket-chat-row ai-ticket-chat-${item.role}`}>
                {!isUser && <div className="ai-ticket-chat-avatar">AI</div>}
                <div className="ai-ticket-chat-bubble">
                  <Typography.Text strong className="ai-ticket-chat-name">
                    {isUser ? '你' : '大模型'}
                  </Typography.Text>
                  <Typography.Paragraph className="ai-ticket-chat-content">
                    {item.content || (item.role === 'assistant' && streaming ? '正在生成...' : '')}
                  </Typography.Paragraph>
                </div>
                {isUser && <div className="ai-ticket-chat-avatar">我</div>}
              </div>
            );
          })}
          {streaming && (
            <Space size="small">
              <Spin size="small" />
              <Typography.Text type="secondary">大模型正在流式回答...</Typography.Text>
            </Space>
          )}
          {error && <Alert type="error" showIcon message={error} />}
        </div>

        <Input.TextArea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="可以继续追问，例如：这个问题还需要检查哪些配置？"
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={streaming || confirming}
        />

        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={handleAskFollowUp} disabled={!question.trim() || streaming || confirming}>
            追问
          </Button>
          <Space>
            <Button onClick={handleManualSubmit} loading={confirming} disabled={confirming}>
              继续提交工单
            </Button>
            <Button type="primary" onClick={handleResolved} loading={confirming} disabled={streaming || !messages.length}>
              问题已解决
            </Button>
          </Space>
        </Space>
      </Space>
    </Drawer>
  );
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    return payload?.reason || '大模型解答失败';
  }
  return (await response.text()) || '大模型解答失败';
}

import OpenAI from 'openai';
import { NextResponse } from 'next/server.js';

import { getSessionUserFromRequest } from '../../../../src/server/session.js';

export const runtime = 'nodejs';

export async function POST(request) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: '未配置 OPENAI_API_KEY' }, { status: 500 });
  }

  const { ticket, messages = [] } = await request.json();
  if (!ticket || typeof ticket !== 'object') {
    return NextResponse.json({ ok: false, reason: '工单数据不完整' }, { status: 400 });
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.codexzh.com/v1'
  });
  const model = process.env.OPENAI_MODEL || 'gpt-5.4';

  try {
    const completionStream = await client.chat.completions.create({
      model,
      stream: true,
      messages: buildAssistantMessages(ticket, messages, user)
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completionStream) {
            const content = chunk.choices?.[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (error) {
          console.error(error);
          controller.enqueue(encoder.encode('\n\n[大模型响应中断，请稍后重试]'));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform'
      }
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, reason: error.message || '大模型解答失败' }, { status: 500 });
  }
}

function buildAssistantMessages(ticket, messages, user) {
  return [
    {
      role: 'system',
      content:
        '你是 ITSM 工单智能助手。请基于工单信息给出可执行、简洁的排查和解决建议。' +
        '如果无法判断，请说明需要人工技术支持继续处理。回答使用中文。'
    },
    {
      role: 'user',
      content: buildTicketContext(ticket, user)
    },
    ...sanitizeMessages(messages)
  ];
}

function buildTicketContext(ticket, user) {
  return [
    `提单人：${ticket.requesterName || user?.name || '-'}`,
    `标题：${ticket.title || '-'}`,
    `工单类型：${ticket.toolType || '-'}`,
    `优先级：${ticket.priority || '-'}`,
    `系统：${ticket.systemName || ticket.systemCode || '-'}`,
    `手机号：${ticket.reporterPhone || '-'}`,
    `邮箱：${ticket.reporterEmail || '-'}`,
    `是否替他人上报：${ticket.reportForOthers ? '是' : '否'}`,
    `问题描述：${ticket.description || '-'}`
  ].join('\n');
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && String(message?.content || '').trim())
    .slice(-20)
    .map((message) => ({
      role: message.role,
      content: String(message.content)
    }));
}

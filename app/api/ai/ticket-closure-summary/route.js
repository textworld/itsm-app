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

  const { ticket } = await request.json();
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
      messages: buildClosureSummaryMessages(ticket, user)
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
    return NextResponse.json({ ok: false, reason: error.message || '大模型总结失败' }, { status: 500 });
  }
}

export function buildClosureSummaryMessages(ticket, user) {
  return [
    {
      role: 'system',
      content:
        '你是 ITSM 一线技术支持的办结总结助手。请基于工单事实生成可直接提交给提单人确认的处理总结。' +
        '要求：中文、简洁、客观，不编造不存在的处理动作；按“问题概述、处理过程、处理结论、后续建议”组织，每段 1-3 句。'
    },
    {
      role: 'user',
      content: buildTicketSummaryContext(ticket, user)
    }
  ];
}

function buildTicketSummaryContext(ticket, user) {
  return [
    `当前操作人：${user?.name || '-'}`,
    `工单编号：${ticket.id || '-'}`,
    `标题：${ticket.title || '-'}`,
    `工具类型：${ticket.toolType || '-'}`,
    `优先级：${ticket.priority || '-'}`,
    `系统：${ticket.systemName || ticket.systemCode || '-'}`,
    `提单人：${ticket.requesterName || ticket.requesterId || '-'}`,
    `问题描述：${ticket.description || ticket.descriptionHtml || '-'}`,
    `二线结论：${ticket.l2Conclusion || '-'}`,
    `关联缺陷：${formatLinkedDefect(ticket.linkedDefect)}`,
    `缺陷标记：${formatDefectTag(ticket.defectTag)}`,
    `留言记录：${formatMessages(ticket.messages)}`,
    `流转轨迹：${formatTimeline(ticket.timeline)}`
  ].join('\n');
}

function formatLinkedDefect(linkedDefect) {
  if (!linkedDefect) return '-';
  return [
    linkedDefect.defectId,
    linkedDefect.title,
    linkedDefect.module ? `模块：${linkedDefect.module}` : '',
    linkedDefect.priority ? `优先级：${linkedDefect.priority}` : ''
  ].filter(Boolean).join(' | ');
}

function formatDefectTag(defectTag) {
  if (!defectTag) return '-';
  return [
    defectTag.type ? `类型：${defectTag.type}` : '',
    defectTag.description ? `描述：${defectTag.description}` : '',
    defectTag.taggedBy ? `标记人：${defectTag.taggedBy}` : ''
  ].filter(Boolean).join(' | ') || '-';
}

function formatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '-';
  return messages
    .slice(-10)
    .map((message) => `${message.authorName || message.authorId || '-'}：${message.content || message.contentHtml || '-'}`)
    .join('\n');
}

function formatTimeline(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) return '-';
  return timeline
    .slice(-20)
    .map((item) => `${item.at || '-'} ${item.operator || '-'} ${item.actionLabel || item.event || '-'} ${item.remark || ''}`.trim())
    .join('\n');
}

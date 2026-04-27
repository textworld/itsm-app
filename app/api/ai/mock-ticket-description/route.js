import OpenAI from 'openai';
import { NextResponse } from 'next/server.js';

import { collectChatCompletionStreamText } from '../../../../src/server/aiText.js';
import {
  buildMockTicketDescriptionMessages,
  prepareGeneratedMockTicketDescription
} from '../../../../src/server/mockTicketDescription.js';
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

  const { ticket = {} } = await request.json();
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.codexzh.com/v1'
  });
  const model = process.env.OPENAI_MODEL || 'gpt-5.4';

  try {
    const completionStream = await client.chat.completions.create({
      model,
      stream: true,
      messages: buildMockTicketDescriptionMessages(ticket)
    });

    const rawDescription = await collectChatCompletionStreamText(completionStream);
    if (!rawDescription) {
      console.warn('Mock ticket description AI returned empty stream content');
      return NextResponse.json({ ok: false, reason: '大模型返回空描述' }, { status: 502 });
    }
    const description = prepareGeneratedMockTicketDescription(rawDescription, ticket);

    return NextResponse.json({ ok: true, description });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, reason: error.message || '模拟工单描述生成失败' }, { status: 500 });
  }
}

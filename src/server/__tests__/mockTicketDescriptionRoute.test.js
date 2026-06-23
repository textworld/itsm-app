import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { collectChatCompletionStreamText, extractChatCompletionText } from '../aiText.js';
import {
  buildLocalMockTicketDescription,
  buildMockTicketDescriptionMessages,
  prepareGeneratedMockTicketDescription
} from '../mockTicketDescription.js';
import { reseedDb } from '../db.js';

const routeSource = fs.readFileSync(
  new URL('../../../app/api/ai/mock-ticket-description/route.js', import.meta.url),
  'utf8'
);

test.beforeEach(() => {
  reseedDb();
});

test('模拟工单描述接口使用 OpenAI SDK 生成描述且不硬编码密钥', () => {
  assert.match(routeSource, /import OpenAI from 'openai'/);
  assert.match(routeSource, /baseURL:\s*process\.env\.OPENAI_BASE_URL \|\| 'https:\/\/api\.codexzh\.com\/v1'/);
  assert.match(routeSource, /process\.env\.OPENAI_MODEL \|\| 'gpt-5\.4'/);
  assert.match(routeSource, /chat\.completions\.create/);
  assert.match(routeSource, /stream:\s*true/);
  assert.match(routeSource, /buildMockTicketDescriptionMessages\(ticket\)/);
  assert.match(routeSource, /prepareGeneratedMockTicketDescription\(rawDescription,\s*ticket\)/);
  assert.doesNotMatch(routeSource, /sk-[A-Za-z0-9]/);
});

test('提取模拟工单描述兼容结构化 content', () => {
  const text = extractChatCompletionText({
    choices: [
      {
        message: {
          content: [
            { type: 'text', text: ' 问题现象：订单状态未同步。 ' },
            { type: 'text', text: '\n期望处理：请修正批处理结果。' }
          ]
        }
      }
    ]
  });

  assert.equal(text, '问题现象：订单状态未同步。\n期望处理：请修正批处理结果。');
});

test('模拟工单描述接口不能把空模型响应当作成功', () => {
  assert.match(routeSource, /collectChatCompletionStreamText\(completionStream\)/);
  assert.match(routeSource, /大模型返回空描述/);
  assert.match(routeSource, /status:\s*502/);
});

test('提取模拟工单描述兼容流式 delta content', async () => {
  async function* stream() {
    yield { choices: [{ delta: { content: '问题现象：' } }] };
    yield { choices: [{ delta: { content: '订单状态未同步。' } }] };
    yield { choices: [{ finish_reason: 'stop', delta: {} }] };
  }

  const text = await collectChatCompletionStreamText(stream());

  assert.equal(text, '问题现象：订单状态未同步。');
});

test('模拟工单描述 prompt 明确要求生成问题工单描述', () => {
  const messages = buildMockTicketDescriptionMessages({
    title: '【模拟】ERP 订单状态批量修正申请',
    toolType: 'DATA_FIX',
    priority: 'P2',
    systemName: 'ERP_CORE'
  });
  const joinedMessages = messages.map((message) => message.content).join('\n');

  assert.match(joinedMessages, /提单人视角/);
  assert.match(joinedMessages, /问题描述正文/);
  assert.match(joinedMessages, /不要输出处理建议/);
  assert.match(joinedMessages, /不要输出.*建议补充的信息/);
  assert.match(joinedMessages, /不要 Markdown/);
  assert.match(joinedMessages, /ERP 核心系统（ERP_CORE）/);
});

test('模拟工单描述会丢弃摘要和建议类大模型输出', () => {
  const description = prepareGeneratedMockTicketDescription(
    '可以，先帮你整理成一版规范工单内容：\n**工单摘要**\n- 标题：`【模拟】ERP 订单状态批量修正申请`\n**建议补充的信息**\n- 修正对象',
    {
      title: '【模拟】ERP 订单状态批量修正申请',
      toolType: 'DATA_FIX',
      priority: 'P2',
      systemName: 'ERP_CORE'
    }
  );

  assert.match(description, /ERP 核心系统/);
  assert.match(description, /订单状态批量修正申请/);
  assert.doesNotMatch(description, /可以|工单摘要|建议补充的信息|\*\*|^- /m);
});

test('模拟工单描述会丢弃过短或不完整的大模型输出', () => {
  const description = prepareGeneratedMockTicketDescription('ERP核心系统中，存在一批订单状态与', {
    title: '【模拟】ERP 订单状态批量修正申请',
    toolType: 'DATA_FIX',
    priority: 'P2',
    systemName: 'ERP_CORE'
  });

  assert.match(description, /ERP 核心系统/);
  assert.match(description, /订单状态批量修正申请/);
  assert.ok(description.length > 80);
});

test('本地兜底模拟描述也基于工单基本信息生成问题描述', () => {
  const description = buildLocalMockTicketDescription({
    title: '【模拟】ERP 订单状态批量修正申请',
    toolType: 'DATA_FIX',
    priority: 'P2',
    systemName: 'ERP_CORE'
  });

  assert.match(description, /ERP 核心系统/);
  assert.match(description, /生产系统数据修正/);
  assert.match(description, /P2-中/);
  assert.match(description, /订单状态批量修正申请/);
  assert.doesNotMatch(description, /处理建议|建议补充的信息|工单摘要|可以/);
});

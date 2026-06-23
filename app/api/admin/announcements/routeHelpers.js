import { NextResponse } from 'next/server.js';

const FORBIDDEN_REASONS = new Set([
  '仅指定审批人可审批',
  '无权创建公告',
  '无权编辑公告',
  '无权编辑该公告',
  '无权提交公告',
  '无权提交该公告',
  '仅管理员可撤回公告',
  '仅管理员可置顶公告'
]);

export function mutationResponse(result) {
  return NextResponse.json(result, { status: statusForMutationResult(result) });
}

export function statusForMutationResult(result) {
  if (result.ok) return 200;
  if (result.reason === '公告不存在') return 404;
  if (FORBIDDEN_REASONS.has(result.reason)) return 403;
  return 400;
}

export async function readOptionalJson(request) {
  if (typeof request.json !== 'function') {
    return { ok: true, value: {} };
  }

  try {
    const value = await request.json();
    if (value == null) return { ok: true, value: {} };
    if (typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reason: '请求体格式错误' };
    }
    return { ok: true, value };
  } catch (error) {
    if (isEmptyBodyJsonError(error)) {
      return { ok: true, value: {} };
    }
    return { ok: false, reason: '请求体格式错误' };
  }
}

export async function readRequiredJson(request) {
  if (typeof request.json !== 'function') {
    return { ok: false, reason: '请求体格式错误' };
  }

  try {
    const value = await request.json();
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, reason: '请求体格式错误' };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, reason: '请求体格式错误' };
  }
}

export function malformedJsonResponse(reason = '请求体格式错误') {
  return NextResponse.json({ ok: false, reason }, { status: 400 });
}

function isEmptyBodyJsonError(error) {
  return error instanceof SyntaxError
    && String(error.message || '').includes('Unexpected end');
}

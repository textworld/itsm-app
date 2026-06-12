import { NextResponse } from 'next/server.js';
import { requireAdminUser } from '../../../../src/server/adminAuth.js';
import { getSessionUserFromRequest } from '../../../../src/server/session.js';

const THIRD_PARTY_DATA_FIX_SCHEMES = [
  {
    id: 'tp_dfs_policy_refresh',
    code: 'TP-DFS-001',
    title: '第三方保单缓存刷新',
    sourceSystem: '第三方数据平台',
    description: '同步保单状态并刷新缓存'
  },
  {
    id: 'tp_dfs_claim_repush',
    code: 'TP-DFS-002',
    title: '第三方理赔结果重推',
    sourceSystem: '第三方数据平台',
    description: '重新推送理赔处理结果'
  },
  {
    id: 'tp_dfs_customer_sync',
    code: 'TP-DFS-003',
    title: '第三方客户资料同步',
    sourceSystem: '第三方主数据平台',
    description: '同步客户证件、联系方式和主数据标识'
  }
];

function authorize(request) {
  return requireAdminUser(getSessionUserFromRequest(request));
}

function authResponse(auth) {
  return NextResponse.json({ ok: false, reason: auth.reason }, { status: auth.status });
}

export async function GET(request) {
  const auth = authorize(request);
  if (!auth.ok) return authResponse(auth);

  const url = new URL(request.url);
  const keyword = String(url.searchParams.get('keyword') || '').trim().toLocaleLowerCase();
  const schemes = keyword
    ? THIRD_PARTY_DATA_FIX_SCHEMES.filter((scheme) => [
        scheme.id,
        scheme.code,
        scheme.title,
        scheme.sourceSystem,
        scheme.description
      ].join(' ').toLocaleLowerCase().includes(keyword))
    : THIRD_PARTY_DATA_FIX_SCHEMES;

  return NextResponse.json({ ok: true, schemes });
}

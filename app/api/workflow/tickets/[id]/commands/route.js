import { NextResponse } from 'next/server.js';
import { dispatchTicketEvent } from '../../../../../../src/server/store.js';
import { getSessionUserFromRequest } from '../../../../../../src/server/session.js';

const COMMAND_EVENT_MAP = {
  SUBMIT: 'SUBMIT',
  CREATE_DRAFT: 'CREATE_DRAFT',
  UPDATE_DRAFT: 'UPDATE_DRAFT',
  AI_RESOLVE: 'AI_RESOLVE',
  WITHDRAW: 'WITHDRAW',
  ACCEPT: 'ACCEPT',
  TAG_DEFECT: 'TAG_DEFECT',
  UPDATE_LINKED_DEFECT: 'UPDATE_LINKED_DEFECT',
  UPDATE_SUMMARY: 'UPDATE_SUMMARY',
  SUSPEND: 'SUSPEND',
  RESUME_FROM_SUSPEND: 'RESUME_FROM_SUSPEND',
  REQUEST_L2_SUPPORT: 'REQUEST_L2_SUPPORT',
  CREATE_SUBTASK: 'CREATE_SUBTASK',
  CREATE_SUBTASK_TICKET: 'CREATE_SUBTASK_TICKET',
  CLAIM_SUBTASK: 'CLAIM_SUBTASK',
  TRANSFER_SUBTASK: 'TRANSFER_SUBTASK',
  NO_ACTION_SUBTASK: 'NO_ACTION_SUBTASK',
  START_SUBTASK: 'START_SUBTASK',
  COMPLETE_SUBTASK: 'COMPLETE_SUBTASK',
  TRANSFER_TECH: 'TRANSFER_TECH',
  AUTO_ASSIGN_TECH: 'AUTO_ASSIGN_TECH',
  RETURN_FOR_INFO: 'RETURN_FOR_INFO',
  UPDATE_INFO_SUPPLEMENT: 'UPDATE_INFO_SUPPLEMENT',
  COMPLETE_INFO_SUPPLEMENT: 'COMPLETE_INFO_SUPPLEMENT',
  L1_REVIEW: 'L1_REVIEW',
  INITIATE_CLOSURE: 'INITIATE_CLOSURE',
  REQUESTER_CLOSE: 'REQUESTER_CLOSE',
  VERIFY_YES: 'VERIFY_YES',
  VERIFY_NO: 'VERIFY_NO',
  SUBMIT_TO_OA: 'SUBMIT_TO_OA',
  SUBMIT_DATA_FIX_SCHEME_REVIEW: 'SUBMIT_DATA_FIX_SCHEME_REVIEW',
  REQUESTER_SUBMIT_OA: 'REQUESTER_SUBMIT_OA',
  OA_ITSM_GENERATE_TICKET: 'OA_ITSM_GENERATE_TICKET',
  OA_DIRECT_CLOSE: 'OA_DIRECT_CLOSE',
  OA_REJECT: 'OA_REJECT',
  OA_REOPEN: 'OA_REOPEN',
  OA_REAPPROVE_GENERATE: 'OA_REAPPROVE_GENERATE',
  OA_REAPPROVE_CLOSE: 'OA_REAPPROVE_CLOSE',
  CONFIRM_DATA_FIX_SOLUTION: 'CONFIRM_DATA_FIX_SOLUTION'
};

export async function POST(request, { params }) {
  const user = getSessionUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, reason: '未登录' }, { status: 401 });
  }

  const resolvedParams = await params;
  const { command, payload = {} } = await request.json();
  const event = COMMAND_EVENT_MAP[command];
  if (!event) {
    return NextResponse.json({ ok: false, reason: '不支持的指令' }, { status: 400 });
  }

  const result = dispatchTicketEvent(resolvedParams.id, event, payload, user);
  const status = result.ok ? 200 : isMissingTicketError(result.reason) ? 404 : 400;
  return NextResponse.json(result, { status });
}

function isMissingTicketError(reason) {
  return String(reason || '').includes('工单不存在') || String(reason || '').includes('宸ュ崟涓嶅瓨鍦');
}

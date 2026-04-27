import { ROLES } from '../constants/roles.js';
import { EVENTS } from '../state-machine/ticketStateMachine.js';
import {
  PROCESSING_SUB_STATUS,
  STATUS,
  getProcessingSubStatus,
  getRequesterStatus,
  getSupportStatus
} from '../constants/ticketStatus.js';

export function getTicketListActions(ticket, user) {
  if (!ticket || !user) return [];

  if (user.role === ROLES.REQUESTER) {
    return getRequesterActions(ticket);
  }

  if (user.role === ROLES.L1) {
    return getL1Actions(ticket, user);
  }

  return [];
}

function getRequesterActions(ticket) {
  const requesterStatus = getRequesterStatus(ticket);

  if (requesterStatus === STATUS.DRAFT) {
    return [
      {
        key: 'submit',
        label: '提交',
        event: EVENTS.SUBMIT,
        confirmTitle: '确认提交该草稿工单？',
        confirmDescription: '提交后工单会进入待受理，等待一线技术支持受理。',
        okText: '确认提交',
        payload: {
          __timelineRemark: '提单人从工单列表重新提交工单'
        },
        successMessage: '工单已提交，等待一线受理',
        systemMessage: '【系统】提单人已从工单列表重新提交工单，当前状态为待受理。'
      }
    ];
  }

  if (requesterStatus === STATUS.PENDING) {
    return [
      {
        key: 'withdraw',
        label: '撤回',
        event: EVENTS.WITHDRAW,
        confirmTitle: '确认撤回到草稿箱？',
        confirmDescription: '撤回后工单会返回草稿箱，可继续修改后重新提交。',
        okText: '确认撤回',
        payload: {
          __timelineRemark: '提单人从工单列表撤回至草稿箱'
        },
        successMessage: '工单已撤回，可在草稿箱中找到',
        systemMessage: '【系统】提单人已从工单列表撤回工单，工单已进入草稿箱。'
      }
    ];
  }

  if (requesterStatus === STATUS.INFO_SUPPLEMENT) {
    return [
      {
        key: 'complete_info_supplement',
        label: '已补充',
        event: EVENTS.COMPLETE_INFO_SUPPLEMENT,
        confirmTitle: '确认已补充信息？',
        confirmDescription: '提交后工单会回到处理中，请确认描述和附件已经补充完整。',
        okText: '确认提交',
        payload: {
          __timelineRemark: '提单人已补充信息'
        },
        successMessage: '已补充，工单回到处理中',
        systemMessage: '【系统】提单人已补充信息，工单回到处理中。'
      }
    ];
  }

  return [];
}

function getL1Actions(ticket, user) {
  const supportStatus = getSupportStatus(ticket);
  const processingSubStatus = getProcessingSubStatus(ticket);

  if (supportStatus === STATUS.PENDING) {
    return [
      {
        key: 'accept',
        label: '受理',
        event: EVENTS.ACCEPT,
        confirmTitle: '确认受理该工单？',
        confirmDescription: '受理后您将成为一线处理人，工单会进入处理中。',
        okText: '确认受理',
        payload: {
          assigneeL1Id: user.id,
          assigneeL1Name: user.name,
          __timelineRemark: '一线受理'
        },
        successMessage: '已受理，进入处理中',
        systemMessage: `【系统】一线技术支持 ${user.name} 已受理本工单。`
      }
    ];
  }

  if (supportStatus === STATUS.PROCESSING && processingSubStatus === PROCESSING_SUB_STATUS.L1_INVESTIGATION) {
    const actions = [
      {
        key: 'return_for_info',
        label: '退回补充',
        event: EVENTS.RETURN_FOR_INFO,
        confirmTitle: '确认退回提单人补充信息？',
        confirmDescription: '退回后工单会进入信息补充状态，等待提单人修改后再继续处理。',
        okText: '确认退回',
        payload: {
          __timelineRemark: '一线退回提单人补充信息'
        },
        successMessage: '已退回提单人，工单进入信息补充',
        systemMessage: '【系统】一线技术支持已退回工单，请提单人补充信息后再继续处理。'
      }
    ];

    if (ticket.defectTag && ticket.linkedDefect) {
      actions.push({
        key: 'request_l2_support',
        label: '二线支持',
        event: EVENTS.REQUEST_L2_SUPPORT,
        confirmTitle: '确认发起二线支持？',
        confirmDescription: '发起后工单会保留处理中状态，并切换到二线排查。',
        okText: '确认发起',
        payload: {
          assigneeL2Id: null,
          assigneeL2Name: null,
          l2SupportRequested: true,
          __timelineRemark: `已关联缺陷 ${ticket.linkedDefect?.defectId || ''}`
        },
        successMessage: '已请求二线支持，工单仍为处理中',
        systemMessage: `【系统】已将工单标记为【${ticket.defectTag?.type || ''}】缺陷并关联到 ${ticket.linkedDefect?.defectId || ''}，请求二线运维支持。`
      });
    }

    if (String(ticket.summary || '').trim()) {
      actions.push({
        key: 'initiate_closure',
        label: '申请办结',
        event: EVENTS.INITIATE_CLOSURE,
        confirmTitle: '确认申请办结？',
        confirmDescription: '申请后工单会进入提单人待确认，请确认工单总结已准备好。',
        okText: '确认申请',
        payload: {
          summary: ticket.summary || '',
          summarySyncedToCorpus: Boolean(String(ticket.summary || '').trim()),
          __timelineRemark: '一线从工单列表发起办结'
        },
        successMessage: '已发起办结，工单进入待确认',
        systemMessage: '【系统】一线已发起办结，请提单人确认。'
      });
    }

    return actions;
  }

  return [];
}

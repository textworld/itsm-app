import test from 'node:test';
import assert from 'node:assert/strict';

import { PRIORITIES } from '../../constants/priorities.js';
import { ROLES } from '../../constants/roles.js';
import { PROCESSING_SUB_STATUS, STATUS } from '../../constants/ticketStatus.js';
import { EVENTS, applyTransition } from '../ticketStateMachine.js';
const l2User = { id: 'u_l2_1', name: 'ops', role: 'L2' };

const requesterUser = { id: 'u_requester_1', name: '张三', role: 'REQUESTER' };
const l1User = { id: 'u_l1_1', name: '李工', role: 'L1' };

test('CREATE_DRAFT 通过状态机创建草稿且不进入待受理', () => {
  const nextTicket = applyTransition(
    null,
    EVENTS.CREATE_DRAFT,
    {
      id: 'draft_state_1',
      title: '暂存草稿',
      toolType: 'DATA_EXTRACT',
      priority: PRIORITIES.P4,
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: '',
      reportForOthers: false,
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '草稿描述' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.requesterStatus, STATUS.DRAFT);
  assert.equal(nextTicket.supportStatus, STATUS.DRAFT);
  assert.equal(nextTicket.id, 'draft_state_1');
  assert.equal(nextTicket.description, '草稿描述');
  assert.equal(nextTicket.timeline.length, 1);
  assert.equal(nextTicket.timeline[0].action, EVENTS.CREATE_DRAFT);
});

test('自定义标签不作为状态机事件维护', () => {
  assert.equal(EVENTS.UPDATE_CUSTOM_TAGS, undefined);
});

test('TRANSFER_TECH 只允许技术支持同角色转交', () => {
  const transferred = applyTransition(
    {
      id: 'TKT-TRANSFER-L1-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      assigneeL1Id: 'u_l1_old',
      assigneeL1Name: '旧一线',
      assigneeL2Id: 'u_l2_1',
      assigneeL2Name: '王二线',
      timeline: []
    },
    EVENTS.TRANSFER_TECH,
    {
      targetRole: 'L1',
      assigneeId: 'u_l1_1',
      assigneeName: '李一线',
      communicated: true
    },
    l1User
  );

  assert.equal(transferred.status, STATUS.PROCESSING);
  assert.equal(transferred.assigneeL1Id, 'u_l1_1');
  assert.equal(transferred.assigneeL1Name, '李一线');
  assert.equal(transferred.assigneeL2Id, 'u_l2_1');
  assert.equal(transferred.techTransfer?.communicated, true);

  assert.throws(
    () =>
      applyTransition(
        transferred,
        EVENTS.TRANSFER_TECH,
        {
          targetRole: 'L2',
          assigneeId: 'u_l2_1',
          assigneeName: '王二线'
        },
        l1User
      ),
    /操作前置条件未满足/
  );
});

test('TRANSFER_TECH records previous and next assignees in assignee history', () => {
  const transferred = applyTransition(
    {
      id: 'TKT-ASSIGNEE-HISTORY-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: 'L1 One',
      assigneeHistory: []
    },
    EVENTS.TRANSFER_TECH,
    {
      targetRole: ROLES.L1,
      assigneeId: 'u_l1_2',
      assigneeName: 'L1 Two'
    },
    l1User
  );

  assert.deepEqual(
    transferred.assigneeHistory.map((entry) => ({
      role: entry.role,
      assigneeId: entry.assigneeId,
      assigneeName: entry.assigneeName
    })),
    [
      { role: ROLES.L1, assigneeId: 'u_l1_1', assigneeName: 'L1 One' },
      { role: ROLES.L1, assigneeId: 'u_l1_2', assigneeName: 'L1 Two' }
    ]
  );
});

test('automatic tech transfer appends a timeline entry naming the assigned support user', () => {
  const transferred = applyTransition(
    {
      id: 'TKT-AUTO-ASSIGN-TIMELINE-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: 'L1 One',
      timeline: []
    },
    EVENTS.TRANSFER_TECH,
    {
      targetRole: ROLES.L1,
      assigneeId: 'u_l1_2',
      assigneeName: 'L1 Two',
      communicated: false,
      autoAssign: true,
      targetSystemCategory: 'NEW',
      targetSystemCode: 'OPS_MONITOR',
      targetSystemName: 'OPS Monitor'
    },
    l1User
  );

  const assignmentEntry = transferred.timeline.find((entry) => entry.action === 'AUTO_ASSIGN_TECH');

  assert.equal(transferred.timeline.length, 2);
  assert.ok(assignmentEntry);
  assert.equal(assignmentEntry.actionLabel, '系统自动派工');
  assert.match(assignmentEntry.remark, /L1 Two/);
});

test('L1 automatic tech transfer records a different target system', () => {
  const transferred = applyTransition(
    {
      id: 'TKT-AUTO-TRANSFER-SYSTEM-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      systemCategory: 'OLD',
      systemCode: 'ERP_CORE',
      systemName: 'ERP 核心系统',
      assigneeL1Id: 'u_l1_1',
      assigneeL1Name: '李工',
      timeline: []
    },
    EVENTS.TRANSFER_TECH,
    {
      targetRole: ROLES.L1,
      assigneeId: 'u_l1_2',
      assigneeName: '周一线',
      communicated: false,
      targetSystemCategory: 'NEW',
      targetSystemCode: 'OPS_MONITOR',
      targetSystemName: '运维监控中心'
    },
    l1User
  );

  assert.equal(transferred.techTransfer?.targetSystemCategory, 'NEW');
  assert.equal(transferred.techTransfer?.targetSystemCode, 'OPS_MONITOR');
  assert.equal(transferred.techTransfer?.targetSystemName, '运维监控中心');

  assert.throws(
    () =>
      applyTransition(
        transferred,
        EVENTS.TRANSFER_TECH,
        {
          targetRole: ROLES.L1,
          assigneeId: 'u_l1_3',
          assigneeName: '吴一线',
          communicated: false,
          targetSystemCategory: 'OLD',
          targetSystemCode: 'ERP_CORE',
          targetSystemName: 'ERP 核心系统'
        },
        l1User
      ),
    /操作前置条件未满足/
  );
});

test('SUBMIT 通过状态机创建待受理工单', () => {
  const nextTicket = applyTransition(
    null,
    EVENTS.SUBMIT,
    {
      id: 'TKT-STATE-1',
      title: '导出任务失败',
      toolType: 'DATA_EXTRACT',
      priority: PRIORITIES.P2,
      systemName: 'ERP',
      reporterPhone: '13800138000',
      reporterEmail: 'zhangsan@example.com',
      reportForOthers: false,
      description: '导出报错',
      descriptionHtml: '<p>导出报错</p>',
      attachments: []
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.PENDING);
  assert.equal(nextTicket.requesterStatus, STATUS.PENDING);
  assert.equal(nextTicket.supportStatus, STATUS.PENDING);
  assert.equal(nextTicket.id, 'TKT-STATE-1');
  assert.equal(nextTicket.timeline.length, 1);
  assert.equal(nextTicket.timeline[0].action, EVENTS.SUBMIT);
});

test('UPDATE_DRAFT 通过状态机保持草稿状态并更新工单要素', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      toolType: 'DATA_EXTRACT',
      title: '原始标题',
      priority: PRIORITIES.P4,
      systemCode: 'ERP',
      systemName: 'ERP系统',
      reporterPhone: '13800138000',
      reporterEmail: 'old@example.com',
      reportForOthers: false,
      reportedUserName: '',
      reportedUserPhone: '',
      description: '原始描述',
      descriptionHtml: '<p>原始描述</p>',
      descriptionHistory: [],
      attachments: []
    },
    EVENTS.UPDATE_DRAFT,
    {
      values: {
        toolType: 'DATA_EXTRACT',
        title: '修改后的标题',
        priority: PRIORITIES.P1,
        systemName: 'OA',
        reporterPhone: '13800138001',
        reporterEmail: 'new@example.com',
        reportForOthers: false,
        reportedUserName: '',
        reportedUserPhone: '',
        descriptionHtml: '<p>修改后的描述</p>'
      },
      attachments: [{ id: 'att_1', name: '截图.png', size: 1, type: 'image/png', base64: 'data:image/png;base64,abc' }]
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.title, '修改后的标题');
  assert.equal(nextTicket.priority, PRIORITIES.P1);
  assert.equal(nextTicket.description, '修改后的描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
});

test('SUBMIT 通过状态机允许草稿再次提交到待受理', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-2',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      toolType: 'DATA_EXTRACT',
      title: '草稿待提交工单',
      priority: PRIORITIES.P2,
      systemCode: 'ERP',
      systemName: 'ERP系统',
      reporterPhone: '13800138009',
      reporterEmail: 'draft@example.com',
      reportForOthers: false,
      description: '草稿描述',
      descriptionHtml: '<p>草稿描述</p>',
      descriptionHistory: [
        {
          id: 'desc_TKT-DRAFT-2_1',
          version: 1,
          description: '草稿描述',
          descriptionHtml: '<p>草稿描述</p>',
          editedAt: '2026-04-24T10:00:00.000Z',
          editorId: requesterUser.id,
          editorName: requesterUser.name,
          reason: '提交工单初始版本'
        }
      ],
      timeline: []
    },
    EVENTS.SUBMIT,
    {},
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.PENDING);
  assert.equal(nextTicket.requesterStatus, STATUS.PENDING);
  assert.equal(nextTicket.supportStatus, STATUS.PENDING);
  assert.equal(nextTicket.title, '草稿待提交工单');
  assert.equal(nextTicket.description, '草稿描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
  assert.equal(nextTicket.timeline.at(-1).action, EVENTS.SUBMIT);
});

test('AI_RESOLVE 通过状态机允许草稿直接办结并标注大模型解决', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-DRAFT-AI-1',
      status: STATUS.DRAFT,
      requesterStatus: STATUS.DRAFT,
      supportStatus: STATUS.DRAFT,
      title: '草稿智能解答',
      priority: PRIORITIES.P3,
      systemCode: 'ERP_CORE',
      systemName: 'ERP 核心系统',
      reporterPhone: '13800138000',
      reportForOthers: false,
      description: '系统登录失败',
      descriptionHistory: [],
      timeline: []
    },
    EVENTS.AI_RESOLVE,
    {
      aiResolution: {
        answer: '请清理浏览器缓存后重试。',
        messages: [{ role: 'assistant', content: '请清理浏览器缓存后重试。' }]
      }
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.CLOSED);
  assert.equal(nextTicket.requesterStatus, STATUS.CLOSED);
  assert.equal(nextTicket.supportStatus, STATUS.CLOSED);
  assert.equal(nextTicket.aiResolved, true);
  assert.equal(nextTicket.aiResolution.answer, '请清理浏览器缓存后重试。');
  assert.equal(nextTicket.timeline.at(-1).action, EVENTS.AI_RESOLVE);
});

test('UPDATE_INFO_SUPPLEMENT 通过状态机保持信息补充状态并写入描述历史', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-INFO-1',
      status: STATUS.INFO_SUPPLEMENT,
      requesterStatus: STATUS.INFO_SUPPLEMENT,
      supportStatus: STATUS.INFO_SUPPLEMENT,
      description: '旧描述',
      descriptionHtml: '<p>旧描述</p>',
      descriptionHistory: []
    },
    EVENTS.UPDATE_INFO_SUPPLEMENT,
    {
      descriptionHtml: '<p>补充后的描述</p>'
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.INFO_SUPPLEMENT);
  assert.equal(nextTicket.requesterStatus, STATUS.INFO_SUPPLEMENT);
  assert.equal(nextTicket.description, '补充后的描述');
  assert.equal(nextTicket.descriptionHistory.length, 1);
});

test('UPDATE_INFO_SUPPLEMENT 允许信息补充阶段修改系统', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-INFO-SYSTEM-1',
      status: STATUS.INFO_SUPPLEMENT,
      requesterStatus: STATUS.INFO_SUPPLEMENT,
      supportStatus: STATUS.INFO_SUPPLEMENT,
      systemCategory: 'OLD',
      systemCode: 'ERP_CORE',
      systemName: 'ERP 核心系统',
      description: '描述',
      descriptionHistory: []
    },
    EVENTS.UPDATE_INFO_SUPPLEMENT,
    {
      systemCategory: 'NEW',
      systemName: 'OPS_MONITOR'
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.INFO_SUPPLEMENT);
  assert.equal(nextTicket.systemCategory, 'NEW');
  assert.equal(nextTicket.systemCode, 'OPS_MONITOR');
  assert.equal(nextTicket.systemName, '运维监控中心');
});

test('信息补充完成后回到退回前的处理子状态', () => {
  const returnedTicket = applyTransition(
    {
      id: 'TKT-INFO-RETURN-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION
    },
    EVENTS.RETURN_FOR_INFO,
    {},
    l1User
  );

  const completedTicket = applyTransition(
    returnedTicket,
    EVENTS.COMPLETE_INFO_SUPPLEMENT,
    {},
    requesterUser
  );

  assert.equal(returnedTicket.status, STATUS.INFO_SUPPLEMENT);
  assert.equal(returnedTicket.infoSupplementReturnStatus, STATUS.PROCESSING);
  assert.equal(returnedTicket.infoSupplementReturnSubStatus, PROCESSING_SUB_STATUS.L2_INVESTIGATION);
  assert.equal(completedTicket.status, STATUS.PROCESSING);
  assert.equal(completedTicket.processingSubStatus, PROCESSING_SUB_STATUS.L2_INVESTIGATION);
});

test('TAG_DEFECT 和 UPDATE_LINKED_DEFECT 通过状态机更新处理中工单附属信息', () => {
  const baseTicket = {
    id: 'TKT-PROCESSING-1',
    status: STATUS.PROCESSING,
    requesterStatus: STATUS.PROCESSING,
    supportStatus: STATUS.PROCESSING,
    processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    defectTag: null,
    linkedDefect: null
  };

  const taggedTicket = applyTransition(
    baseTicket,
    EVENTS.TAG_DEFECT,
    {
      defectTag: {
        type: '产品缺陷',
        description: '分页异常',
        taggedAt: '2026-04-24T15:00:00.000Z',
        taggedBy: '李工'
      }
    },
    l1User
  );

  const linkedTicket = applyTransition(
    taggedTicket,
    EVENTS.UPDATE_LINKED_DEFECT,
    {
      linkedDefect: {
        defectId: 'BUG-2026-0001',
        title: '列表分页错乱',
        module: '工单列表',
        priority: 'P1',
        isNew: false
      }
    },
    l1User
  );

  assert.equal(linkedTicket.status, STATUS.PROCESSING);
  assert.equal(linkedTicket.processingSubStatus, PROCESSING_SUB_STATUS.L1_INVESTIGATION);
  assert.equal(linkedTicket.defectTag.type, '产品缺陷');
  assert.equal(linkedTicket.linkedDefect.defectId, 'BUG-2026-0001');
});

test('REQUEST_L2_SUPPORT 允许一线处理中直接转给二线', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-L2-DIRECT-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      defectTag: null,
      linkedDefect: null
    },
    EVENTS.REQUEST_L2_SUPPORT,
    {
      assigneeL2Id: 'u_l2_1',
      assigneeL2Name: '王工'
    },
    l1User
  );

  assert.equal(nextTicket.status, STATUS.PROCESSING);
  assert.equal(nextTicket.processingSubStatus, PROCESSING_SUB_STATUS.L2_INVESTIGATION);
  assert.equal(nextTicket.assigneeL2Name, '王工');
});

test('子任务通过状态机创建、处理和完成', () => {
  const baseTicket = {
    id: 'TKT-SUBTASK-1',
    status: STATUS.PROCESSING,
    requesterStatus: STATUS.PROCESSING,
    supportStatus: STATUS.PROCESSING,
    processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    subtasks: []
  };

  const withSubtask = applyTransition(
    baseTicket,
    EVENTS.CREATE_SUBTASK,
    {
      subtask: {
        id: 'subtask_1',
        systemCategory: 'NEW',
        systemCode: 'OPS_MONITOR',
        systemName: '运维监控中心',
        description: '请协助排查监控告警',
        assigneeId: 'u_l2_1',
        assigneeName: '王二线 (二线运维)'
      }
    },
    l1User
  );
  const processingSubtask = applyTransition(
    withSubtask,
    EVENTS.START_SUBTASK,
    { subtaskId: 'subtask_1' },
    l1User
  );
  const completedSubtask = applyTransition(
    processingSubtask,
    EVENTS.COMPLETE_SUBTASK,
    {
      subtaskId: 'subtask_1',
      noMainTicketActionRequired: true
    },
    l1User
  );

  assert.equal(withSubtask.subtasks[0].status, 'PENDING');
  assert.equal(processingSubtask.subtasks[0].status, 'PROCESSING');
  assert.equal(completedSubtask.subtasks[0].status, 'COMPLETED');
  assert.equal(completedSubtask.subtasks[0].noMainTicketActionRequired, true);
});

test('二线运维不能在父工单上创建子任务', () => {
  assert.throws(
    () =>
      applyTransition(
        {
          id: 'TKT-SUBTASK-L2-DENIED',
          status: STATUS.PROCESSING,
          requesterStatus: STATUS.PROCESSING,
          supportStatus: STATUS.PROCESSING,
          processingSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
          subtasks: []
        },
        EVENTS.CREATE_SUBTASK,
        {
          subtask: {
            id: 'subtask_denied',
            systemCode: 'OPS_MONITOR',
            systemName: '运维监控中心',
            description: '二线不能分派子任务'
          }
        },
        l2User
      ),
    /当前状态或角色无权执行该操作/
  );
});

test('创建子任务工单指定二线处理人时写入二线处理字段', () => {
  const subtaskTicket = applyTransition(
    null,
    EVENTS.CREATE_SUBTASK_TICKET,
    {
      id: 'subtask-ticket-l2',
      parentTicketId: 'TKT-SUBTASK-PARENT',
      title: '二线子任务',
      systemCode: 'ERP_CORE',
      assigneeId: 'u_l2_2',
      assigneeName: '郑二线 (二线运维)',
      assigneeRole: ROLES.L2
    },
    l1User
  );

  assert.equal(subtaskTicket.assigneeL1Id, null);
  assert.equal(subtaskTicket.assigneeL1Name, null);
  assert.equal(subtaskTicket.assigneeL2Id, 'u_l2_2');
  assert.equal(subtaskTicket.assigneeL2Name, '郑二线 (二线运维)');
});

test('存在未完成子任务时一线不能发起办结', () => {
  assert.throws(
    () =>
      applyTransition(
        {
          id: 'TKT-SUBTASK-CLOSE-1',
          status: STATUS.PROCESSING,
          requesterStatus: STATUS.PROCESSING,
          supportStatus: STATUS.PROCESSING,
          processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
          subtasks: [{ id: 'subtask_open', status: 'PENDING' }]
        },
        EVENTS.INITIATE_CLOSURE,
        { summary: '处理总结已填写' },
        l1User
      ),
    /操作前置条件未满足/
  );
});

test('UPDATE_SUMMARY 通过状态机保持处理中状态并更新总结字段', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-SUMMARY-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      summary: '',
      summarySyncedToCorpus: false
    },
    EVENTS.UPDATE_SUMMARY,
    {
      summary: '处理完成，总结如下',
      summarySyncedToCorpus: true
    },
    l1User
  );

  assert.equal(nextTicket.status, STATUS.PROCESSING);
  assert.equal(nextTicket.summary, '处理完成，总结如下');
  assert.equal(nextTicket.summarySyncedToCorpus, true);
});

test('REQUESTER_CLOSE 允许提单人在处理中主动关单', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-REQUESTER-CLOSE-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
      summary: ''
    },
    EVENTS.REQUESTER_CLOSE,
    {
      satisfaction: {
        rating: 5,
        comment: '问题已自行确认解决'
      },
      __timelineRemark: '提单人主动关单'
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.CLOSED);
  assert.equal(nextTicket.requesterStatus, STATUS.CLOSED);
  assert.equal(nextTicket.supportStatus, STATUS.CLOSED);
  assert.equal(nextTicket.processingSubStatus, null);
  assert.equal(nextTicket.satisfaction.rating, 5);
  assert.equal(nextTicket.timeline.at(-1).action, EVENTS.REQUESTER_CLOSE);
});

test('SUSPEND 和 RESUME_FROM_SUSPEND 仅允许一线在处理中工单上挂起并恢复处理', () => {
  const suspendedTicket = applyTransition(
    {
      id: 'TKT-SUSPEND-1',
      status: STATUS.PROCESSING,
      requesterStatus: STATUS.PROCESSING,
      supportStatus: STATUS.PROCESSING,
      processingSubStatus: PROCESSING_SUB_STATUS.L2_INVESTIGATION,
      timeline: []
    },
    EVENTS.SUSPEND,
    {
      __timelineRemark: '一线挂起工单'
    },
    l1User
  );

  assert.equal(suspendedTicket.status, STATUS.SUSPENDED);
  assert.equal(suspendedTicket.requesterStatus, STATUS.PROCESSING);
  assert.equal(suspendedTicket.supportStatus, STATUS.SUSPENDED);
  assert.equal(suspendedTicket.processingSubStatus, null);
  assert.equal(suspendedTicket.suspendedReturnSubStatus, PROCESSING_SUB_STATUS.L2_INVESTIGATION);
  assert.equal(suspendedTicket.timeline.at(-1).action, EVENTS.SUSPEND);

  assert.throws(
    () => applyTransition(suspendedTicket, EVENTS.RESUME_FROM_SUSPEND, {}, l2User),
    /当前状态或角色无权执行该操作/
  );

  const resumedTicket = applyTransition(
    suspendedTicket,
    EVENTS.RESUME_FROM_SUSPEND,
    {
      __timelineRemark: '一线取消挂起'
    },
    l1User
  );

  assert.equal(resumedTicket.status, STATUS.PROCESSING);
  assert.equal(resumedTicket.requesterStatus, STATUS.PROCESSING);
  assert.equal(resumedTicket.supportStatus, STATUS.PROCESSING);
  assert.equal(resumedTicket.processingSubStatus, PROCESSING_SUB_STATUS.L2_INVESTIGATION);
  assert.equal(resumedTicket.timeline.at(-1).action, EVENTS.RESUME_FROM_SUSPEND);
});

test('WITHDRAW 允许撤回时改为草稿编号并保留原工单编号', () => {
  const nextTicket = applyTransition(
    {
      id: 'TKT-WITHDRAW-1',
      status: STATUS.PENDING,
      requesterStatus: STATUS.PENDING,
      supportStatus: STATUS.PENDING,
      title: '待撤回工单'
    },
    EVENTS.WITHDRAW,
    {
      id: 'draft_withdraw_1',
      withdrawalReason: '信息需要重填',
      __timelineRemark: '提单人撤回至草稿箱'
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.DRAFT);
  assert.equal(nextTicket.requesterStatus, STATUS.DRAFT);
  assert.equal(nextTicket.supportStatus, STATUS.DRAFT);
  assert.equal(nextTicket.id, 'draft_withdraw_1');
  assert.equal(nextTicket.originalTicketId, 'TKT-WITHDRAW-1');
  assert.equal(nextTicket.withdrawalReason, '信息需要重填');
});
test('subtask tickets use independent claim complete no-action and transfer events', () => {
  const pendingSubtask = applyTransition(
    null,
    EVENTS.CREATE_SUBTASK_TICKET,
    {
      id: 'TKT-20260429-0001-1',
      parentTicketId: 'TKT-20260429-0001',
      title: '协助排查监控告警',
      systemCode: 'OPS_MONITOR',
      systemName: '运维监控中心',
      requesterId: 'u_requester_1',
      requesterName: '张三'
    },
    l1User
  );
  const claimedSubtask = applyTransition(pendingSubtask, EVENTS.CLAIM_SUBTASK, {}, l2User);
  const transferredSubtask = applyTransition(
    claimedSubtask,
    EVENTS.TRANSFER_SUBTASK,
    {
      systemCode: 'ERP_CORE',
      systemName: 'ERP核心',
      assigneeId: 'u_l1_1',
      assigneeName: '李一线'
    },
    l2User
  );
  const completedSubtask = applyTransition(transferredSubtask, EVENTS.NO_ACTION_SUBTASK, {}, l1User);

  assert.equal(pendingSubtask.isSubtask, true);
  assert.equal(pendingSubtask.subtaskStatus, 'PENDING');
  assert.equal(claimedSubtask.subtaskStatus, 'PROCESSING');
  assert.equal(claimedSubtask.assigneeL2Id, 'u_l2_1');
  assert.equal(transferredSubtask.systemCode, 'ERP_CORE');
  assert.equal(transferredSubtask.assigneeL1Id, 'u_l1_1');
  assert.equal(completedSubtask.subtaskStatus, 'COMPLETED');
  assert.equal(completedSubtask.noMainTicketActionRequired, true);
});

test('审批类工单通过 SUBMIT_TO_OA 进入审批中并锁定', () => {
  const nextTicket = applyTransition(
    null,
    EVENTS.SUBMIT_TO_OA,
    {
      id: 'TKT-OA-1',
      title: '数据提取审批',
      toolType: 'DATA_EXTRACT',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '需要提取数据' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(nextTicket.status, STATUS.APPROVING);
  assert.equal(nextTicket.requesterStatus, STATUS.APPROVING);
  assert.equal(nextTicket.supportStatus, STATUS.APPROVING);
  assert.equal(nextTicket.oaLocked, true);
  assert.equal(nextTicket.oaApplication.status, 'APPROVING');
  assert.match(nextTicket.oaApplication.oaId, /^OA-/);
  assert.throws(
    () => applyTransition(nextTicket, EVENTS.WITHDRAW, {}, requesterUser),
    /无权|狀態|状态|权限|操作|当前/
  );
});

test('数据修正有方案进入一线方案审核，无方案自动转咨询并保留原类型', () => {
  const withSolution = applyTransition(
    null,
    EVENTS.SUBMIT_DATA_FIX_SCHEME_REVIEW,
    {
      id: 'TKT-FIX-SOLUTION',
      title: '修正保单数据',
      toolType: 'DATA_FIX',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      dataFixSolution: {
        requesterSolution: '按附件 SQL 修正',
        relatedTicketId: ''
      },
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '需要修正' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(withSolution.status, STATUS.DATA_FIX_SCHEME_REVIEW);
  assert.equal(withSolution.supportStatus, STATUS.DATA_FIX_SCHEME_REVIEW);
  assert.equal(withSolution.oaLocked, false);

  const withoutSolution = applyTransition(
    null,
    EVENTS.SUBMIT,
    {
      id: 'TKT-FIX-NO-SOLUTION',
      title: '修正无方案',
      toolType: 'DATA_FIX',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '需要一线确认方案' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  assert.equal(withoutSolution.status, STATUS.PENDING);
  assert.equal(withoutSolution.toolType, 'CONSULT');
  assert.equal(withoutSolution.originalToolType, 'DATA_FIX');
});

test('数据修正无方案由一线确认方案后发起人一键提交 OA', () => {
  const processing = {
    id: 'TKT-FIX-OA-READY',
    status: STATUS.PROCESSING,
    requesterStatus: STATUS.PROCESSING,
    supportStatus: STATUS.PROCESSING,
    processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    toolType: 'CONSULT',
    originalToolType: 'DATA_FIX',
    timeline: []
  };

  const ready = applyTransition(
    processing,
    EVENTS.CONFIRM_DATA_FIX_SOLUTION,
    {
      dataFixSolution: {
        supportReason: '数据同步异常',
        supportSolution: '按确认口径修正字段'
      }
    },
    l1User
  );

  assert.equal(ready.status, STATUS.OA_READY);
  assert.equal(ready.dataFixSolution.supportReason, '数据同步异常');

  const approving = applyTransition(
    ready,
    EVENTS.REQUESTER_SUBMIT_OA,
    {},
    requesterUser
  );

  assert.equal(approving.status, STATUS.APPROVING);
  assert.equal(approving.oaLocked, true);
  assert.equal(approving.oaApplication.status, 'APPROVING');
});

test('OA 审核生成正式工单或直接办结都通过状态机联动', () => {
  const approving = applyTransition(
    null,
    EVENTS.SUBMIT_TO_OA,
    {
      id: 'TKT-OA-RESULT',
      title: '权限审批',
      toolType: 'PERMISSION',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: '申请权限' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const generated = applyTransition(
    approving,
    EVENTS.OA_ITSM_GENERATE_TICKET,
    { opinion: '需要一线处理' },
    { id: 'u_admin_1', name: '管理员', role: ROLES.ADMIN }
  );

  assert.equal(generated.status, STATUS.PENDING);
  assert.equal(generated.formalTicketCreated, true);
  assert.equal(generated.oaLocked, false);
  assert.equal(generated.oaApplication.status, 'COMPLETED_GENERATED');

  const closed = applyTransition(
    approving,
    EVENTS.OA_DIRECT_CLOSE,
    { opinion: '无需继续处理' },
    { id: 'u_admin_1', name: '管理员', role: ROLES.ADMIN }
  );

  assert.equal(closed.status, STATUS.CONFIRMING);
  assert.equal(closed.formalTicketCreated, false);
  assert.equal(closed.oaApplication.status, 'COMPLETED_CLOSED');
});

test('OA reject returns approving ticket to draft and unlocks it', () => {
  const approving = applyTransition(
    null,
    EVENTS.SUBMIT_TO_OA,
    {
      id: 'TKT-OA-REJECT',
      title: 'permission approval',
      toolType: 'PERMISSION',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'permission' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const rejected = applyTransition(
    approving,
    EVENTS.OA_REJECT,
    { opinion: '材料不完整' },
    { id: 'u_admin_1', name: 'Admin', role: ROLES.ADMIN }
  );

  assert.equal(rejected.status, STATUS.DRAFT);
  assert.equal(rejected.requesterStatus, STATUS.DRAFT);
  assert.equal(rejected.supportStatus, STATUS.DRAFT);
  assert.equal(rejected.oaLocked, false);
  assert.equal(rejected.oaApplication.status, 'REJECTED');
  assert.equal(rejected.isDraft, true);
});

test('OA 重新打开正式工单后挂起，重新审批继续处理后恢复', () => {
  const formalProcessing = {
    id: 'TKT-OA-REOPEN',
    status: STATUS.PROCESSING,
    requesterStatus: STATUS.PROCESSING,
    supportStatus: STATUS.PROCESSING,
    processingSubStatus: PROCESSING_SUB_STATUS.L1_INVESTIGATION,
    formalTicketCreated: true,
    oaApplication: {
      oaId: 'OA-TKT-OA-REOPEN',
      status: 'COMPLETED_GENERATED',
      approvalRecords: []
    },
    timeline: []
  };

  const reopened = applyTransition(
    formalProcessing,
    EVENTS.OA_REOPEN,
    { opinion: 'OA 重新打开' },
    { id: 'u_admin_1', name: '管理员', role: ROLES.ADMIN }
  );

  assert.equal(reopened.status, STATUS.SUSPENDED);
  assert.equal(reopened.oaApplication.status, 'REOPENED');
  assert.equal(reopened.suspendedReturnSubStatus, PROCESSING_SUB_STATUS.L1_INVESTIGATION);

  const restored = applyTransition(
    reopened,
    EVENTS.OA_REAPPROVE_GENERATE,
    { opinion: '重新审批后继续处理' },
    { id: 'u_admin_1', name: '管理员', role: ROLES.ADMIN }
  );

  assert.equal(restored.status, STATUS.PROCESSING);
  assert.equal(restored.processingSubStatus, PROCESSING_SUB_STATUS.L1_INVESTIGATION);
  assert.equal(restored.oaApplication.status, 'COMPLETED_GENERATED');
});

test('data fix without requester solution keeps original type when AI resolves it as consult', () => {
  const draft = applyTransition(
    null,
    EVENTS.CREATE_DRAFT,
    {
      id: 'draft_data_fix_ai',
      title: 'data fix without solution',
      toolType: 'DATA_FIX',
      priority: PRIORITIES.P4,
      systemName: 'ERP_CORE',
      reporterPhone: '13800138000',
      descriptionDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'no solution' }] }]
      },
      attachments: []
    },
    requesterUser
  );

  const closed = applyTransition(
    draft,
    EVENTS.AI_RESOLVE,
    {
      id: 'TKT-AI-DATA-FIX',
      aiResolution: {
        answer: 'consult answer',
        messages: []
      }
    },
    requesterUser
  );

  assert.equal(closed.status, STATUS.CLOSED);
  assert.equal(closed.toolType, 'CONSULT');
  assert.equal(closed.originalToolType, 'DATA_FIX');
});

/**
 * 状态机端到端冒烟测试（纯 Node 运行）
 * 模拟提单人 → 一线 → 二线 → 一线 → 提单人 的闭环流转，
 * 同时覆盖"VERIFY_NO 驳回重走"分支。
 *
 * 运行：node scripts/smokeStateMachine.mjs
 */
import {
  EVENTS,
  canTransition,
  applyTransition
} from '../src/state-machine/ticketStateMachine.js';
import { STATUS } from '../src/constants/ticketStatus.js';
import { ROLES } from '../src/constants/roles.js';

const REQUESTER = { id: 'u1', name: 'req', role: ROLES.REQUESTER };
const L1 = { id: 'u2', name: 'l1', role: ROLES.L1 };
const L2 = { id: 'u3', name: 'l2', role: ROLES.L2 };

let pass = 0;
let fail = 0;
function expect(label, cond) {
  if (cond) { pass++; console.log('  PASS  ', label); }
  else { fail++; console.log('  FAIL  ', label); }
}

console.log('\n[1] 创建 → PENDING');
let t = applyTransition(null, EVENTS.SUBMIT, { id: 'T1', title: 'test' }, REQUESTER);
expect('SUBMIT → PENDING', t.status === STATUS.PENDING);
expect('timeline 长度=1', t.timeline.length === 1);

console.log('\n[2] PENDING → PROCESSING (一线受理)');
t = applyTransition(t, EVENTS.ACCEPT, {}, L1);
expect('ACCEPT → PROCESSING', t.status === STATUS.PROCESSING);

console.log('\n[3] PROCESSING → INVESTIGATING 前置条件');
const checkFail = canTransition(t, EVENTS.TAG_DEFECT_AND_LINK, L1);
expect('未打标+未关联 → 不通过', !checkFail.ok);
t = { ...t, defectTag: { type: 'bug', description: 'x' }, linkedDefect: { defectId: 'D1' } };
const checkOk = canTransition(t, EVENTS.TAG_DEFECT_AND_LINK, L1);
expect('打标+关联 → 通过', checkOk.ok);
t = applyTransition(t, EVENTS.TAG_DEFECT_AND_LINK, {}, L1);
expect('→ INVESTIGATING', t.status === STATUS.INVESTIGATING);

console.log('\n[4] INVESTIGATING → REVIEWING (二线结论)');
const failNoConclusion = canTransition(t, EVENTS.SUBMIT_CONCLUSION, L2);
expect('无结论 → 不通过', !failNoConclusion.ok);
t = applyTransition(t, EVENTS.SUBMIT_CONCLUSION, { l2Conclusion: '已修复' }, L2);
expect('→ REVIEWING', t.status === STATUS.REVIEWING);

console.log('\n[5] REVIEWING → VERIFYING (一线复核)');
const failNoSummary = canTransition(t, EVENTS.SUBMIT_REVIEW, L1);
expect('无总结 → 不通过', !failNoSummary.ok);
t = applyTransition(t, EVENTS.SUBMIT_REVIEW, { summary: '总结文本', summarySyncedToCorpus: true }, L1);
expect('→ VERIFYING', t.status === STATUS.VERIFYING);

console.log('\n[6] VERIFYING → CLOSED (提单人验证通过)');
t = applyTransition(t, EVENTS.VERIFY_YES, { satisfaction: { rating: 5, comment: '好' } }, REQUESTER);
expect('→ CLOSED', t.status === STATUS.CLOSED);
expect('satisfaction 写入', t.satisfaction?.rating === 5);
expect('timeline >=6', t.timeline.length >= 6);

console.log('\n[7] VERIFY_NO 分支：从一个新的 VERIFYING 工单驳回');
let t2 = applyTransition(null, EVENTS.SUBMIT, { id: 'T2', title: 't2' }, REQUESTER);
t2 = applyTransition(t2, EVENTS.ACCEPT, {}, L1);
t2 = { ...t2, defectTag: { type: 'x', description: 'x' }, linkedDefect: { defectId: 'X' } };
t2 = applyTransition(t2, EVENTS.TAG_DEFECT_AND_LINK, {}, L1);
t2 = applyTransition(t2, EVENTS.SUBMIT_CONCLUSION, { l2Conclusion: 'ok' }, L2);
t2 = applyTransition(t2, EVENTS.SUBMIT_REVIEW, { summary: 's', summarySyncedToCorpus: true }, L1);
const failNoReason = canTransition(t2, EVENTS.VERIFY_NO, REQUESTER);
expect('无驳回原因 → 不通过', !failNoReason.ok);
t2 = applyTransition(t2, EVENTS.VERIFY_NO, { rejectionReason: '未生效' }, REQUESTER);
expect('VERIFY_NO → PROCESSING', t2.status === STATUS.PROCESSING);
expect('rejectionReason 写入', t2.rejectionReason === '未生效');

console.log('\n[8] 角色权限校验：L2 不能受理');
const wrongRole = canTransition({ status: STATUS.PENDING }, EVENTS.ACCEPT, L2);
expect('L2 ACCEPT → 被拒', !wrongRole.ok);

console.log(`\n===== Smoke Result: ${pass} passed, ${fail} failed =====`);
if (fail > 0) process.exit(1);

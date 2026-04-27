import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ticketInfoCardSource = fs.readFileSync(
  new URL('../TicketInfoCard.jsx', import.meta.url),
  'utf8'
);

const requesterActionsSource = fs.readFileSync(
  new URL('../RequesterActions.jsx', import.meta.url),
  'utf8'
);

const ticketDetailSource = fs.readFileSync(
  new URL('../../../views/TicketDetail/index.jsx', import.meta.url),
  'utf8'
);

const l1ActionsSource = fs.readFileSync(
  new URL('../L1Actions.jsx', import.meta.url),
  'utf8'
);

const defectTagModalSource = fs.readFileSync(
  new URL('../DefectTagModal.jsx', import.meta.url),
  'utf8'
);

const l2ActionsSource = fs.readFileSync(
  new URL('../L2Actions.jsx', import.meta.url),
  'utf8'
);

const linkDefectPanelSource = fs.readFileSync(
  new URL('../LinkDefectPanel.jsx', import.meta.url),
  'utf8'
);

test('草稿状态的修改工单要素入口放在基本信息卡片右上角', () => {
  assert.match(
    ticketInfoCardSource,
    /<Card[\s\S]*title="工单基本信息"[\s\S]*extra=\{[\s\S]*DraftTicketEditButton[\s\S]*\}/
  );
  assert.doesNotMatch(requesterActionsSource, /修改工单要素/);
});

test('草稿状态详情页直接使用提交工单表单编辑态', () => {
  assert.match(ticketDetailSource, /import \{ TicketSubmitForm \} from '..\/TicketSubmit\/index\.jsx';/);
  assert.match(
    ticketDetailSource,
    /isDraftTicket \? <TicketSubmitForm draftTicket=\{ticket\} \/> : <TicketInfoCard ticket=\{ticket\} \/>/
  );
  assert.match(
    ticketDetailSource,
    /<Col xs=\{24\} lg=\{8\}>[\s\S]*\{renderActions\(\)\}[\s\S]*<QuickMessageCard ticket=\{ticket\}/
  );
});

test('提单人操作区的直接动作按钮带二次确认', () => {
  assert.match(
    requesterActionsSource,
    /<Popconfirm[\s\S]*onConfirm=\{handleCompleteInfoSupplement\}[\s\S]*已补充/
  );
});

test('信息补充阶段打开描述弹窗时会回填当前工单描述', () => {
  assert.match(
    requesterActionsSource,
    /const handleOpenDescriptionEdit = \(\) => \{[\s\S]*setEditingDescriptionDoc\(ticket\.descriptionDoc \|\| richTextValueToDoc\(ticket\.descriptionHtml\)\);[\s\S]*setEditOpen\(true\);[\s\S]*\}/
  );
  assert.match(requesterActionsSource, /onClick=\{handleOpenDescriptionEdit\}[\s\S]*修改工单描述/);
});

test('一线操作区的直接动作按钮带二次确认', () => {
  assert.match(l1ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleAccept\}[\s\S]*受理工单/);
  assert.match(
    l1ActionsSource,
    /<Popconfirm[\s\S]*onConfirm=\{handleReturnForInfo\}[\s\S]*退回提单人-信息补充/
  );
  assert.match(l1ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleSubmitReview\}[\s\S]*发起办结/);
  assert.match(l1ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleFlowToL2\}[\s\S]*二线支持/);
});

test('二线操作区和缺陷关联操作带二次确认', () => {
  assert.match(l2ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleSubmit\}[\s\S]*一线复核/);
  assert.match(linkDefectPanelSource, /<Popconfirm[\s\S]*onConfirm=\{handleLink\}[\s\S]*关联/);
  assert.match(linkDefectPanelSource, /<Popconfirm[\s\S]*onConfirm=\{handleUnlink\}[\s\S]*取消关联/);
});

test('打标为缺陷通过弹窗承载缺陷关联，而不是在一线操作区直接展示', () => {
  assert.doesNotMatch(l1ActionsSource, /<LinkDefectPanel[\s\S]*ticket=\{ticket\}[\s\S]*onChange=\{handleLinkChange\}/);
  assert.match(
    defectTagModalSource,
    /import LinkDefectPanel from '\.\/LinkDefectPanel\.jsx';[\s\S]*<LinkDefectPanel[\s\S]*ticket=\{ticket\}[\s\S]*onChange=\{onLinkChange\}/
  );
});

test('草稿状态的提单人操作区再次提交时先进入大模型解答流程', () => {
  const draftActionStart = requesterActionsSource.indexOf('if (requesterStatus === STATUS.DRAFT) {');
  const draftActionEnd = requesterActionsSource.indexOf('  if (requesterStatus === STATUS.CLOSED)', draftActionStart);
  const draftActionSource = requesterActionsSource.slice(draftActionStart, draftActionEnd);

  assert.notEqual(draftActionStart, -1);
  assert.match(requesterActionsSource, /import AiTicketAssistantDrawer from '..\/TicketSubmit\/AiTicketAssistantDrawer\.jsx';/);
  assert.match(
    draftActionSource,
    /const handleStartDraftAiSubmit = \(\) => \{[\s\S]*setAiDrawerOpen\(true\);[\s\S]*\}/
  );
  assert.match(
    draftActionSource,
    /const handleDraftAiResolved = async \(\{ messages, answer \}\) => \{[\s\S]*EVENTS\.AI_RESOLVE/
  );
  assert.match(
    draftActionSource,
    /const handleDraftManualProcess = async \(\) => \{[\s\S]*EVENTS\.SUBMIT/
  );
  assert.match(
    draftActionSource,
    /<Button type="primary" icon=\{<CheckCircleOutlined \/>\} onClick=\{handleStartDraftAiSubmit\}>[\s\S]*提交工单/
  );
  assert.match(
    draftActionSource,
    /<AiTicketAssistantDrawer[\s\S]*onResolved=\{handleDraftAiResolved\}[\s\S]*onManual=\{handleDraftManualProcess\}/
  );
  assert.doesNotMatch(draftActionSource, /<Popconfirm/);
});

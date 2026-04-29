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

const appLayoutSource = fs.readFileSync(
  new URL('../../Layout/AppLayout.jsx', import.meta.url),
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

const subtaskPanelSource = fs.readFileSync(
  new URL('../SubtaskPanel.jsx', import.meta.url),
  'utf8'
);

const techTransferPanelSource = fs.existsSync(new URL('../TechTransferPanel.jsx', import.meta.url))
  ? fs.readFileSync(new URL('../TechTransferPanel.jsx', import.meta.url), 'utf8')
  : '';

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

test('工单详情页不显示返回工单列表入口', () => {
  assert.doesNotMatch(ticketDetailSource, /handleBackToTicketList/);
  assert.doesNotMatch(ticketDetailSource, /onBackToList/);
  assert.doesNotMatch(ticketInfoCardSource, /onBackToList/);
  assert.doesNotMatch(ticketInfoCardSource, /返回工单列表/);
});

test('工单详情页不显示顶部工单列表标题', () => {
  assert.match(appLayoutSource, /const isTicketDetailPage = /);
  assert.match(appLayoutSource, /pathname\.startsWith\('\/tickets\/'\)/);
  assert.match(appLayoutSource, /!isTicketDetailPage && \(/);
  assert.match(appLayoutSource, /<Typography\.Title[\s\S]*className="app-shell-page-title"/);
});

test('自定义标签放在详情页右侧操作区', () => {
  const rightColumnStart = ticketDetailSource.indexOf('<Col xs={24} lg={8}>');
  const rightColumnEnd = ticketDetailSource.indexOf('</Col>', rightColumnStart);
  const rightColumnSource = ticketDetailSource.slice(rightColumnStart, rightColumnEnd);

  assert.match(ticketDetailSource, /import CustomTicketTags from '..\/..\/components\/TicketDetail\/CustomTicketTags\.jsx';/);
  assert.doesNotMatch(ticketInfoCardSource, /<CustomTicketTags ticket=\{ticket\}/);
  assert.match(rightColumnSource, /<Card title="自定义标签"[\s\S]*<CustomTicketTags ticket=\{ticket\} \/>[\s\S]*\{renderActions\(\)\}/);
});

test('工单总结使用富文本预览支持图片', () => {
  const summaryStart = ticketInfoCardSource.indexOf('{ticket.summary && (');
  const summaryEnd = ticketInfoCardSource.indexOf('{ticket.aiResolved', summaryStart);
  const summarySource = ticketInfoCardSource.slice(summaryStart, summaryEnd);

  assert.notEqual(summaryStart, -1);
  assert.match(ticketInfoCardSource, /import RichContentPreview from '..\/common\/RichContentPreview\.jsx';/);
  assert.match(summarySource, /<RichContentPreview[\s\S]*html=\{ticket\.summary\}/);
  assert.doesNotMatch(
    summarySource,
    /<Typography\.Paragraph style=\{\{ whiteSpace: 'pre-wrap' \}\}>[\s\S]*\{ticket\.summary\}/
  );
});

test('技术支持转交仅提供同角色转交并要求是否提前沟通', () => {
  assert.match(l1ActionsSource, /<TechTransferPanel ticket=\{ticket\} role=\{ROLES\.L1\}/);
  assert.match(l2ActionsSource, /<TechTransferPanel ticket=\{ticket\} role=\{ROLES\.L2\}/);
  assert.match(techTransferPanelSource, /EVENTS\.TRANSFER_TECH/);
  assert.match(techTransferPanelSource, /name="communicated"/);
  assert.match(techTransferPanelSource, /name="assigneeId"/);
  assert.match(techTransferPanelSource, /targetRole: role/);
});

test('草稿状态详情页直接使用提交工单表单编辑态', () => {
  assert.match(ticketDetailSource, /import \{ TicketSubmitForm \} from '..\/TicketSubmit\/index\.jsx';/);
  assert.match(
    ticketDetailSource,
    /isDraftTicket \? \([\s\S]*<TicketSubmitForm draftTicket=\{ticket\} \/>[\s\S]*\) : \([\s\S]*<Tabs className="ticket-detail-sticky-tabs" items=\{detailTabs\} \/>[\s\S]*\)/
  );
  assert.match(ticketDetailSource, /!isDraftTicket && <QuickMessageCard ticket=\{ticket\}/);
});

test('工单详情页把留言放在工单信息下方而不是独立 tab', () => {
  const infoTabStart = ticketDetailSource.indexOf("key: 'info'");
  const timelineTabStart = ticketDetailSource.indexOf("key: 'timeline'");
  const infoTabSource = ticketDetailSource.slice(infoTabStart, timelineTabStart);

  assert.notEqual(infoTabStart, -1);
  assert.match(infoTabSource, /<TicketInfoCard ticket=\{ticket\} \/>[\s\S]*<div ref=\{messageBoardRef\}>[\s\S]*<MessageBoard ticket=\{ticket\} \/>/);
  assert.doesNotMatch(ticketDetailSource, /key:\s*'messages'/);
  assert.doesNotMatch(ticketDetailSource, /label:\s*'留言'/);
});

test('工单详情页使用 tabs 承载流转轨迹和子任务', () => {
  assert.match(ticketDetailSource, /<Tabs[\s\S]*items=\{detailTabs\}/);
  assert.match(ticketDetailSource, /key:\s*'timeline'[\s\S]*label:\s*'流转轨迹'/);
  assert.match(ticketDetailSource, /key:\s*'subtasks'[\s\S]*label:\s*'子任务'/);
  assert.doesNotMatch(ticketInfoCardSource, /<Typography\.Title level=\{5\}>流转轨迹<\/Typography\.Title>/);
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

test('信息补充阶段允许修改新老系统标签和系统名称', () => {
  assert.match(requesterActionsSource, /name="systemCategory"/);
  assert.match(requesterActionsSource, /name="systemName"/);
  assert.match(requesterActionsSource, /getSystemOptionsByCategory/);
  assert.match(requesterActionsSource, /EVENTS\.UPDATE_INFO_SUPPLEMENT[\s\S]*systemCategory[\s\S]*systemName/);
});

test('一线操作区的直接动作按钮带二次确认', () => {
  assert.match(l1ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleAccept\}[\s\S]*受理工单/);
  assert.match(
    l1ActionsSource,
    /<Popconfirm[\s\S]*onConfirm=\{handleReturnForInfo\}[\s\S]*退回提单人-信息补充/
  );
  assert.match(l1ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleFlowToL2\}[\s\S]*二线支持/);
});

test('一线发起办结前通过弹窗填写工单处理总结', () => {
  assert.match(l1ActionsSource, /const \[closureOpen, setClosureOpen\]/);
  assert.match(l1ActionsSource, /<Modal[\s\S]*title=\{[\s\S]*发起办结[\s\S]*onOk=\{handleSubmitReview\}/);
  assert.match(l1ActionsSource, /name="summary"[\s\S]*label="工单处理总结"/);
  assert.match(l1ActionsSource, /<RichTextEditor[\s\S]*value=\{closureSummaryDoc\}/);
  assert.match(l1ActionsSource, /fetch\('\/api\/ai\/ticket-closure-summary'/);
  assert.match(l1ActionsSource, /readClosureSummaryDraft\(window\.localStorage/);
  assert.match(l1ActionsSource, /writeCompletedClosureSummaryDraft\([\s\S]*window\.localStorage/);
  assert.match(l1ActionsSource, /EVENTS\.INITIATE_CLOSURE[\s\S]*summary: summaryHtml/);
});

test('一线处理中操作区提供 PMS 缺陷和故障入口且不展示处理中提示', () => {
  const processingStart = l1ActionsSource.indexOf('if (status === STATUS.PROCESSING)');
  const processingEnd = l1ActionsSource.indexOf('  if (status === STATUS.INFO_SUPPLEMENT)', processingStart);
  const processingSource = l1ActionsSource.slice(processingStart, processingEnd);

  assert.notEqual(processingStart, -1);
  assert.match(l1ActionsSource, /关联缺陷/);
  assert.match(l1ActionsSource, /故障应急/);
  assert.match(l1ActionsSource, /window\.open\(`\/pms\/create\?\$\{params\.toString\(\)\}`/);
  assert.match(l1ActionsSource, /openPmsCreate\('defect'\)/);
  assert.match(l1ActionsSource, /openPmsCreate\('incident'\)/);
  assert.doesNotMatch(l1ActionsSource, /message="本工单处理中"/);
  assert.doesNotMatch(processingSource, /<Divider \/>/);
  assert.match(processingSource, /<Space wrap[\s\S]*关联缺陷[\s\S]*故障应急[\s\S]*退回提单人-信息补充[\s\S]*发起办结[\s\S]*二线支持[\s\S]*<TechTransferPanel/);
});

test('子任务面板支持可空指定处理人并创建子任务工单', () => {
  const assigneeStart = subtaskPanelSource.indexOf('name="assigneeId"');
  const assigneeEnd = subtaskPanelSource.indexOf('</Form.Item>', assigneeStart);
  const assigneeSource = subtaskPanelSource.slice(assigneeStart, assigneeEnd);

  assert.notEqual(assigneeStart, -1);
  assert.match(subtaskPanelSource, /name="assigneeId"[\s\S]*label="指定处理人"/);
  assert.doesNotMatch(assigneeSource, /rules=\{\[\{ required: true/);
  assert.match(subtaskPanelSource, /EVENTS\.CREATE_SUBTASK/);
  assert.match(subtaskPanelSource, /subtaskTicket/);
});

test('二线操作区和缺陷关联操作带二次确认', () => {
  assert.match(l2ActionsSource, /<Popconfirm[\s\S]*onConfirm=\{handleSubmit\}[\s\S]*一线复核/);
  assert.match(linkDefectPanelSource, /<Popconfirm[\s\S]*onConfirm=\{handleLink\}[\s\S]*关联/);
  assert.match(linkDefectPanelSource, /<Popconfirm[\s\S]*onConfirm=\{handleUnlink\}[\s\S]*取消关联/);
});

test('缺陷关联由 PMS 创建入口承载', () => {
  assert.doesNotMatch(l1ActionsSource, /<LinkDefectPanel[\s\S]*ticket=\{ticket\}[\s\S]*onChange=\{handleLinkChange\}/);
  assert.doesNotMatch(l1ActionsSource, /<DefectTagModal/);
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
    /<Card title="草稿箱操作">/
  );
  assert.match(
    draftActionSource,
    /该工单仍在草稿箱中，继续提交后会先由大模型尝试解答，也可转人工进入待受理。/
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

test('提单人在处理中状态可以主动关单', () => {
  assert.match(requesterActionsSource, /EVENTS\.REQUESTER_CLOSE/);
  assert.match(
    requesterActionsSource,
    /requesterStatus === STATUS\.PROCESSING[\s\S]*主动关单/
  );
  assert.match(
    requesterActionsSource,
    /<SatisfactionModal[\s\S]*onOk=\{handleRequesterCloseSubmit\}/
  );
});

test('工单详情页 tabs 导航滚动到顶部后吸顶', () => {
  const cssSource = fs.readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');

  assert.match(ticketDetailSource, /<Tabs[\s\S]*className="ticket-detail-sticky-tabs"[\s\S]*items=\{detailTabs\}/);
  assert.match(cssSource, /\.ticket-detail-sticky-tabs\s*>\s*\.ant-tabs-nav[\s\S]*position:\s*sticky/);
  assert.match(cssSource, /\.ticket-detail-sticky-tabs\s*>\s*\.ant-tabs-nav[\s\S]*top:\s*0/);
  assert.match(cssSource, /\.ticket-detail-sticky-tabs\s*>\s*\.ant-tabs-nav[\s\S]*z-index:\s*\d+/);
});
test('L1 closure summary generation can be stopped before editing and submission', () => {
  assert.match(l1ActionsSource, /const handleStopClosureSummaryGeneration = \(\) => \{[\s\S]*abortClosureSummaryGeneration\(\);[\s\S]*\}/);
  assert.match(l1ActionsSource, /title=\{[\s\S]*closureGenerating && \([\s\S]*<Button[\s\S]*onClick=\{handleStopClosureSummaryGeneration\}[\s\S]*\)[\s\S]*\}/);
  assert.match(l1ActionsSource, /confirmLoading=\{closureGenerating\}/);
  assert.match(l1ActionsSource, /okButtonProps=\{\{ disabled: closureGenerating \}\}/);
  assert.match(l1ActionsSource, /<RichTextEditor[\s\S]*disabled=\{closureGenerating\}/);
});

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

const stateMachinePageSource = fs.readFileSync(
  new URL('../../../views/StateMachine/index.jsx', import.meta.url),
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
const draftTicketEditButtonSource = fs.readFileSync(
  new URL('../DraftTicketEditButton.jsx', import.meta.url),
  'utf8'
);
const ticketSubmitSource = fs.readFileSync(
  new URL('../../../views/TicketSubmit/index.jsx', import.meta.url),
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
const subtaskActionsSource = fs.readFileSync(
  new URL('../SubtaskActions.jsx', import.meta.url),
  'utf8'
);

const techTransferPanelSource = fs.existsSync(new URL('../TechTransferPanel.jsx', import.meta.url))
  ? fs.readFileSync(new URL('../TechTransferPanel.jsx', import.meta.url), 'utf8')
  : '';

const linkDefectPanelSource = fs.readFileSync(
  new URL('../LinkDefectPanel.jsx', import.meta.url),
  'utf8'
);
const customTicketTagsSource = fs.readFileSync(
  new URL('../CustomTicketTags.jsx', import.meta.url),
  'utf8'
);

const ticketDispatchLogCardSource = fs.existsSync(new URL('../TicketDispatchLogCard.jsx', import.meta.url))
  ? fs.readFileSync(new URL('../TicketDispatchLogCard.jsx', import.meta.url), 'utf8')
  : '';

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
  assert.match(rightColumnSource, /<Card title="自定义标签"[\s\S]*<CustomTicketTags ticket=\{ticket\} \/>[\s\S]*!isAdminView && renderActions\(\)/);
  assert.match(customTicketTagsSource, /updateCustomTags\(ticket\.id, tags\)/);
  assert.doesNotMatch(customTicketTagsSource, /EVENTS\.UPDATE_CUSTOM_TAGS/);
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
  assert.match(
    l2ActionsSource,
    /<TechTransferPanel[\s\S]*role=\{ROLES\.L2\}[\s\S]*buttonText="转给其他二线运维"[\s\S]*modalTitle="转给其他二线运维"/
  );
  assert.match(techTransferPanelSource, /EVENTS\.TRANSFER_TECH/);
  assert.match(techTransferPanelSource, /name="communicated"/);
  assert.match(techTransferPanelSource, /name="assigneeId"/);
  assert.match(techTransferPanelSource, /targetRole: role/);
});

test('一线自动派工转交时按新老系统标签级联选择其他系统', () => {
  assert.match(techTransferPanelSource, /SYSTEM_CATEGORY_OPTIONS/);
  assert.match(techTransferPanelSource, /getSystemOptionsByCategory/);
  assert.match(techTransferPanelSource, /name="targetSystemCategory"/);
  assert.match(techTransferPanelSource, /name="targetSystemCode"/);
  assert.match(techTransferPanelSource, /targetSystemCode[\s\S]*ticket\.systemCode/);
  assert.match(techTransferPanelSource, /targetSystemCategory:\s*values\.targetSystemCategory/);
  assert.match(techTransferPanelSource, /targetSystemCode:\s*values\.targetSystemCode/);
  assert.match(techTransferPanelSource, /targetSystemName:\s*targetSystem\?\.label/);
});

test('automatic tech transfer leaves assignee selection to the backend', () => {
  assert.doesNotMatch(techTransferPanelSource, /routeTechTransferAssignee/);
  assert.match(techTransferPanelSource, /autoAssign:\s*values\.communicated !== true/);
});

test('二线操作区不展示通用的转给其他技术支持按钮', () => {
  const l2TransferStart = l2ActionsSource.indexOf('<TechTransferPanel');
  const l2TransferEnd = l2ActionsSource.indexOf('/>', l2TransferStart);
  const l2TransferSource = l2ActionsSource.slice(l2TransferStart, l2TransferEnd);

  assert.notEqual(l2TransferStart, -1);
  assert.match(l2TransferSource, /buttonText="转给其他二线运维"/);
  assert.doesNotMatch(l2TransferSource, /转给其他技术支持/);
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
  assert.match(infoTabSource, /<TicketInfoCard ticket=\{ticket\} \/>[\s\S]*<div ref=\{messageBoardRef\}>[\s\S]*<MessageBoard ticket=\{ticket\} readOnly=\{isAdminView\} \/>/);
  assert.doesNotMatch(ticketDetailSource, /key:\s*'messages'/);
  assert.doesNotMatch(ticketDetailSource, /label:\s*'留言'/);
});

test('工单详情页使用 tabs 承载流转轨迹和子任务', () => {
  assert.match(ticketDetailSource, /<Tabs[\s\S]*items=\{detailTabs\}/);
  assert.match(ticketDetailSource, /key:\s*'timeline'[\s\S]*label:\s*'流转轨迹'/);
  assert.match(ticketDetailSource, /key:\s*'subtasks'[\s\S]*label:\s*'子任务'/);
  assert.doesNotMatch(ticketInfoCardSource, /<Typography\.Title level=\{5\}>流转轨迹<\/Typography\.Title>/);
});

test('流转轨迹将操作人角色展示为独立标签', () => {
  assert.match(ticketDetailSource, /import[\s\S]*Tag[\s\S]*from 'antd'/);
  assert.match(ticketDetailSource, /<Tag[\s\S]*ROLE_LABELS\[timelineItem\.role\]/);
  assert.doesNotMatch(ticketDetailSource, /timelineItem\.role \? `（\$\{ROLE_LABELS\[timelineItem\.role\]/);
});

test('提单人查看工单详情时不展示子任务 tab', () => {
  assert.match(ticketDetailSource, /user\?\.role !== ROLES\.REQUESTER[\s\S]*key:\s*'subtasks'/);
});

test('管理员查看工单详情只读并展示派工日志', () => {
  const timelineTabStart = ticketDetailSource.indexOf("key: 'timeline'");
  const subtaskTabStart = ticketDetailSource.indexOf("key: 'subtasks'");
  const afterTimelineTabsSource = ticketDetailSource.slice(timelineTabStart, subtaskTabStart);
  const rightColumnStart = ticketDetailSource.indexOf('<Col xs={24} lg={8}>');
  const rightColumnEnd = ticketDetailSource.indexOf('</Col>', rightColumnStart);
  const rightColumnSource = ticketDetailSource.slice(rightColumnStart, rightColumnEnd);

  assert.match(ticketDetailSource, /import TicketDispatchLogCard from '..\/..\/components\/TicketDetail\/TicketDispatchLogCard\.jsx';/);
  assert.match(ticketDetailSource, /const isAdminView = user\?\.role === ROLES\.ADMIN/);
  assert.match(ticketDetailSource, /<MessageBoard ticket=\{ticket\} readOnly=\{isAdminView\} \/>/);
  assert.match(ticketDetailSource, /!isAdminView && user\?\.role !== ROLES\.REQUESTER/);
  assert.match(ticketDetailSource, /!isAdminView && renderActions\(\)/);
  assert.match(ticketDetailSource, /!isAdminView && !isDraftTicket && <QuickMessageCard/);
  assert.match(afterTimelineTabsSource, /isAdminView && \{[\s\S]*key:\s*'dispatchLogs'[\s\S]*label:\s*'派工日志'[\s\S]*<TicketDispatchLogCard ticketId=\{ticket\.id\} \/>/);
  assert.doesNotMatch(rightColumnSource, /<TicketDispatchLogCard ticketId=\{ticket\.id\} \/>/);
  assert.match(ticketDispatchLogCardSource, /Card[\s\S]*title="派工日志"/);
  assert.match(ticketDispatchLogCardSource, /Timeline/);
  assert.match(ticketDispatchLogCardSource, /\/api\/workflow\/tickets\/\$\{ticketId\}\/dispatch-logs/);
  assert.match(ticketDispatchLogCardSource, /ruleType/);
  assert.match(ticketDispatchLogCardSource, /routeKey/);
});

test('子任务面板展示子任务单号并支持一键复制', () => {
  assert.match(subtaskPanelSource, /title:\s*'子任务单号'/);
  assert.match(subtaskPanelSource, /copyable=\{\{[\s\S]*text:\s*subtask\.id/);
});

test('一线操作区通过状态机事件提供挂起和取消挂起按钮', () => {
  assert.match(l1ActionsSource, /EVENTS\.SUSPEND/);
  assert.match(l1ActionsSource, /EVENTS\.RESUME_FROM_SUSPEND/);
  assert.match(l1ActionsSource, /status === STATUS\.SUSPENDED/);
  assert.match(l1ActionsSource, /取消挂起/);
});

test('一线处理中操作区按钮按业务动作分组展示', () => {
  const processingStart = l1ActionsSource.indexOf('if (status === STATUS.PROCESSING)');
  const processingEnd = l1ActionsSource.indexOf('  if (status === STATUS.SUSPENDED)', processingStart);
  const processingSource = l1ActionsSource.slice(processingStart, processingEnd);
  const pmsGroupStart = processingSource.indexOf('title="PMS 处理"');
  const ticketGroupStart = processingSource.indexOf('title="工单处理"');
  const transferGroupStart = processingSource.indexOf('title="协同转交"');

  assert.notEqual(pmsGroupStart, -1);
  assert.notEqual(ticketGroupStart, -1);
  assert.notEqual(transferGroupStart, -1);
  assert.ok(pmsGroupStart < ticketGroupStart);
  assert.ok(ticketGroupStart < transferGroupStart);

  assert.match(
    processingSource.slice(pmsGroupStart, ticketGroupStart),
    /关联缺陷[\s\S]*故障应急/
  );
  assert.match(
    processingSource.slice(ticketGroupStart, transferGroupStart),
    /挂起[\s\S]*退回提单人-信息补充[\s\S]*发起办结/
  );
  assert.match(
    processingSource.slice(transferGroupStart),
    /二线支持[\s\S]*<TechTransferPanel/
  );
});

test('角色事件权限矩阵按工单状态拆分为 tabs', () => {
  assert.match(stateMachinePageSource, /statusPermissionTabs/);
  assert.match(stateMachinePageSource, /<Tabs[\s\S]*items=\{statusPermissionTabs\}/);
  assert.match(stateMachinePageSource, /STATUS_LABELS\[status\]/);
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
  assert.match(l1ActionsSource, /<Modal[\s\S]*title="发起办结"[\s\S]*open=\{closureOpen\}/);
  assert.match(l1ActionsSource, /name="summary"[\s\S]*label="工单处理总结"/);
  assert.match(l1ActionsSource, /<RichTextEditor[\s\S]*value=\{closureSummaryDoc\}/);
  assert.match(l1ActionsSource, /fetch\('\/api\/ai\/ticket-closure-summary'/);
  assert.match(l1ActionsSource, /readClosureSummaryDraft\(window\.localStorage/);
  assert.match(l1ActionsSource, /writeCompletedClosureSummaryDraft\([\s\S]*window\.localStorage/);
  assert.match(l1ActionsSource, /EVENTS\.INITIATE_CLOSURE[\s\S]*summary: summaryHtml/);
});

test('存在未完成子任务时发起办结按钮禁用并提示原因', () => {
  assert.match(l1ActionsSource, /const hasIncompleteSubtasks = \(ticket\.subtasks \|\| \[\]\)\.some/);
  assert.match(l1ActionsSource, /<Tooltip[\s\S]*存在子任务未完结[\s\S]*<Button[\s\S]*disabled=\{hasIncompleteSubtasks\}[\s\S]*发起办结/);
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

test('子任务面板只有一线技术支持可以创建子任务', () => {
  assert.match(subtaskPanelSource, /canPerformTicketAction\(ticket, user, TICKET_ACTIONS\.CREATE_SUBTASK\)/);
  assert.match(subtaskPanelSource, /canCreateSubtask && \(/);
});

test('二线复核结论使用富文本编辑器提交 HTML', () => {
  assert.match(l2ActionsSource, /import RichTextEditor from '..\/common\/RichTextEditor\.jsx';/);
  assert.match(l2ActionsSource, /const \[conclusionDoc, setConclusionDoc\]/);
  assert.match(l2ActionsSource, /<RichTextEditor[\s\S]*value=\{conclusionDoc\}/);
  assert.match(l2ActionsSource, /l2Conclusion: conclusionHtml/);
  assert.doesNotMatch(l2ActionsSource, /<Input\.TextArea/);
  assert.match(ticketInfoCardSource, /<RichContentPreview[\s\S]*html=\{ticket\.l2Conclusion\}/);
});

test('技术支持手动转交处理人选择框支持搜索', () => {
  assert.match(techTransferPanelSource, /<Select[\s\S]*showSearch[\s\S]*optionFilterProp="label"/);
});

test('所有系统名称选择框支持搜索', () => {
  for (const source of [
    requesterActionsSource,
    subtaskPanelSource,
    subtaskActionsSource,
    draftTicketEditButtonSource,
    ticketSubmitSource
  ]) {
    if (!source.includes('getSystemOptionsByCategory') && !source.includes('SYSTEM_OPTIONS')) continue;
    assert.match(source, /showSearch/);
    assert.match(source, /optionFilterProp="label"/);
  }
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

test('OA 审批信息在详情页展示且锁定时不显示撤回编辑入口', () => {
  assert.match(ticketInfoCardSource, /oaApplication/);
  assert.match(ticketInfoCardSource, /OA 申请单/);
  assert.match(ticketInfoCardSource, /approvalRecords/);
  assert.match(draftTicketEditButtonSource, /ticket\.oaLocked/);
  assert.match(requesterActionsSource, /ticket\.oaLocked/);
});

test('数据修正 OA 待提交和一线方案确认操作通过状态机事件触发', () => {
  assert.match(requesterActionsSource, /EVENTS\.REQUESTER_SUBMIT_OA/);
  assert.match(requesterActionsSource, /一键提交 OA/);
  assert.match(l1ActionsSource, /EVENTS\.CONFIRM_DATA_FIX_SOLUTION/);
  assert.match(l1ActionsSource, /EVENTS\.SUBMIT_TO_OA/);
  assert.match(l1ActionsSource, /方案审核通过创建 OA/);
  assert.match(l1ActionsSource, /确认修正方案/);
});

test('L1 closure summary generation can be stopped before editing and submission', () => {
  const modalStart = l1ActionsSource.indexOf('<Modal');
  const modalEnd = l1ActionsSource.indexOf('</Modal>', modalStart);
  const closureModalSource = l1ActionsSource.slice(modalStart, modalEnd);

  assert.match(l1ActionsSource, /const handleStopClosureSummaryGeneration = \(\) => \{[\s\S]*abortClosureSummaryGeneration\(\);[\s\S]*\}/);
  assert.match(closureModalSource, /footer=\{\[[\s\S]*handleStopClosureSummaryGeneration[\s\S]*取消[\s\S]*handleSubmitReview[\s\S]*确认发起[\s\S]*\]\.filter\(Boolean\)\}/);
  assert.doesNotMatch(closureModalSource, /title=\{[\s\S]*handleStopClosureSummaryGeneration[\s\S]*\}/);
  assert.match(l1ActionsSource, /<RichTextEditor[\s\S]*disabled=\{closureGenerating\}/);
});

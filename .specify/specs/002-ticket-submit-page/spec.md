# Feature Specification: 工单提交页面

**Feature Branch**: `002-ticket-submit-page`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: 基于当前 `src/views/TicketSubmit/index.jsx`、状态机约束、提交页相关测试和系统配置变更重新生成 speckit 规约。

## User Scenarios & Testing

### User Story 1 - 提单人填写并提交普通咨询工单 (Priority: P1)

作为提单人，我希望填写工单类型、标题、优先级、系统、联系方式、描述和附件，并在提交后先由大模型尝试解答；如果大模型已解决，工单直接关闭，如果仍需人工处理，工单进入待受理。

**Why this priority**: 应用系统常规咨询是唯一走 AI 草稿解答流的提交类型，是提交页最核心的交互闭环。

**Independent Test**: 使用提单人账号打开 `/tickets/new`，选择“应用系统常规咨询”，填写必填项并提交，确认系统先通过 `CREATE_DRAFT` 创建草稿并打开大模型抽屉；点击“问题已解决”触发 `AI_RESOLVE`，点击“继续提交工单”触发 `SUBMIT`。

**Acceptance Scenarios**:

1. **Given** 提单人已登录且填写完整咨询工单，**When** 点击提交工单，**Then** 系统创建草稿并打开大模型解答抽屉。
2. **Given** 大模型抽屉已打开，**When** 提单人确认问题已解决，**Then** 工单通过状态机 `AI_RESOLVE` 进入已办结。
3. **Given** 大模型抽屉已打开，**When** 提单人选择继续提交工单，**Then** 工单通过状态机 `SUBMIT` 进入待受理。

---

### User Story 2 - 提单人提交审批类工单 (Priority: P1)

作为提单人，我希望数据提取、权限申请和有方案的数据修正工单跳过 AI 咨询流程，直接进入对应审批或方案审核流程。

**Why this priority**: 审批类工单不应由 AI 自动解答，必须保留 OA 或方案审核路径。

**Independent Test**: 分别提交数据提取、权限申请、数据修正工单，确认前两类触发 `SUBMIT_TO_OA`，有方案的数据修正触发 `SUBMIT_DATA_FIX_SCHEME_REVIEW`。

**Acceptance Scenarios**:

1. **Given** 提单人提交非结构化数据提取工单，**When** 表单校验通过，**Then** 系统通过 `SUBMIT_TO_OA` 创建审批中工单。
2. **Given** 提单人提交权限申请工单且已上传 Excel 申请文件，**When** 表单校验通过，**Then** 系统通过 `SUBMIT_TO_OA` 创建审批中工单。
3. **Given** 提单人提交数据修正工单且选择了数据修正方案，**When** 表单校验通过，**Then** 系统通过 `SUBMIT_DATA_FIX_SCHEME_REVIEW` 进入方案审核。

---

### User Story 3 - 结构化数据提取引导到提数平台 (Priority: P1)

作为提单人，当工单类型是生产系统数据提取时，我需要明确选择是否结构化；如果选择“是”，页面应提示去提数平台，并阻止提交 ITSM 工单。

**Why this priority**: 结构化提数不属于 ITSM 工单处理范围，必须在提交入口阻断。

**Independent Test**: 选择“生产系统数据提取”，将“是否结构化”设为“是”并点击提交，确认页面展示“结构化数据提取请去提数平台”提示且不创建工单。

**Acceptance Scenarios**:

1. **Given** 工单类型为数据提取，**When** 页面展示该类型附加字段，**Then** 显示“是否结构化”单选项。
2. **Given** 用户选择“是否结构化 = 是”，**When** 点击提交工单，**Then** 系统展示提数平台引导并阻止提交。
3. **Given** 用户选择“是否结构化 = 否”，**When** 其他字段校验通过，**Then** 按数据提取审批流程提交。

---

### User Story 4 - 权限申请必须上传 Excel 申请文件 (Priority: P1)

作为提单人，当工单类型是账号及权限申请时，我需要下载权限申请模板并上传 Excel 权限申请文件，系统在缺少文件或文件类型错误时阻止提交。

**Why this priority**: 权限申请需要标准化申请材料，避免进入审批后缺少授权依据。

**Independent Test**: 选择“账号及权限申请”，确认页面展示模板下载链接和权限申请文件上传控件；未上传或上传非 Excel 文件时提交失败，上传 `.xls` 或 `.xlsx` 后可以提交。

**Acceptance Scenarios**:

1. **Given** 工单类型为权限申请，**When** 页面展示该类型附加字段，**Then** 显示权限申请模板下载链接。
2. **Given** 用户未上传权限申请文件，**When** 点击提交工单，**Then** 系统提示必须上传 Excel 申请文件。
3. **Given** 用户上传非 Excel 文件，**When** 文件进入上传控件校验，**Then** 系统拒绝该文件。
4. **Given** 用户上传有效 Excel 文件，**When** 工单提交成功，**Then** 该附件以权限申请文件类别保存到工单附件中。

---

### User Story 5 - 数据修正选择后台配置方案或转咨询 (Priority: P1)

作为提单人，当工单类型是生产系统数据修正时，我希望从后台配置的数据修正方案中单选一个方案；如果没有匹配方案，我可以一键转为常规咨询。

**Why this priority**: 数据修正需要前置方案审核；没有方案时应降级为咨询，而不是绕过方案审核。

**Independent Test**: 选择“生产系统数据修正”，打开方案弹窗，从 `/api/data-fix-schemes` 加载方案并单选；确认提交 payload 写入 `selectedSchemeId`、`selectedSchemeTitle`、`selectedSchemeDescription` 和 `requesterSolution`。点击“没有方案，转人工咨询”后，工单类型变为 `CONSULT`。

**Acceptance Scenarios**:

1. **Given** 工单类型为数据修正，**When** 点击选择数据修正方案，**Then** 系统加载可用方案并以表格单选展示。
2. **Given** 用户选择一个方案，**When** 确认选择，**Then** 页面回显方案标题和描述，并写入提交 payload。
3. **Given** 用户没有适配方案，**When** 点击转人工咨询，**Then** 工单类型切换为常规咨询并清空数据修正方案。

---

### User Story 6 - 提单人暂存和编辑草稿 (Priority: P2)

作为提单人，我希望可以不通过完整表单校验直接暂存草稿，并在草稿详情中继续编辑；再次提交时仍按当前工单类型进入正确流程。

**Why this priority**: 草稿能力降低一次性填写成本，并复用同一提交页表单以减少行为分叉。

**Independent Test**: 在提交页点击暂存草稿，确认使用 `CREATE_DRAFT` 事件并跳转草稿箱；在草稿详情中编辑后保存，确认使用 `UPDATE_DRAFT`，提交时按咨询或审批类型继续流转。

**Acceptance Scenarios**:

1. **Given** 用户填写了部分字段，**When** 点击暂存草稿，**Then** 系统不触发表单必填校验，并通过 `CREATE_DRAFT` 保存草稿。
2. **Given** 用户打开草稿工单，**When** 页面加载，**Then** 表单回填草稿字段、普通附件和权限申请附件。
3. **Given** 用户编辑草稿并保存，**When** 点击保存草稿，**Then** 系统通过 `UPDATE_DRAFT` 更新草稿。

---

### User Story 7 - 提单人使用一键生成模拟工单 (Priority: P3)

作为演示用户，我希望在非草稿编辑页面一键生成模拟工单数据，并让系统尝试调用大模型生成描述；如果大模型失败，也能保留本地模拟数据。

**Why this priority**: 这是原型演示效率能力，不影响核心提交路径。

**Independent Test**: 点击“一键生成模拟工单”，确认页面填充模拟字段，调用 `/api/ai/mock-ticket-description`，成功时写入富文本描述，失败时展示具体失败原因但保留本地模拟字段。

**Acceptance Scenarios**:

1. **Given** 用户在新建提交页，**When** 点击一键生成模拟工单，**Then** 页面填充模拟字段并清空附件列表。
2. **Given** 大模型描述生成成功，**When** 接口返回描述，**Then** 页面将描述转换为富文本并写入描述字段。
3. **Given** 大模型描述生成失败，**When** 本地模拟数据已生成，**Then** 页面保留模拟字段并提示失败原因。

## Edge Cases

- 非提单人访问提交页时，页面必须拒绝提交入口并显示“仅提单人可提交工单”。
- 必填字段缺失、手机号格式错误、邮箱格式错误或描述为空时，系统必须阻止提交，滚动到首个错误字段，并用弹窗列出最多前 5 条错误。
- 系统列表加载失败时，系统名称下拉框不得展示已废弃的本地默认系统；用户必须从当前可用系统配置中选择。
- 后台系统配置改名后，新提交工单使用新中文名，历史工单已保存的 `systemName` 不被改写。
- 切换新老系统标签时，已选系统名称必须清空，避免提交与分类不匹配的系统。
- 权限申请文件和普通附件必须分开维护，权限申请文件只允许 1 个，普通附件最多 10 个。
- 草稿提交为审批类工单时，必须先 `UPDATE_DRAFT` 保存最新表单数据，再通过对应审批事件提交。
- 结构化数据提取被阻止时，不得创建草稿、正式工单或 OA 审批记录。

## Requirements

### Functional Requirements

- **FR-001**: 提交页必须只允许 `REQUESTER` 角色提交或暂存工单。
- **FR-002**: 提交页必须支持四种可选工单类型：生产系统数据提取、生产系统数据修正、账号及权限申请、应用系统常规咨询。
- **FR-003**: 表单必须包含并校验标题、优先级、新老系统标签、系统名称、手机号、是否替他人上报和富文本描述。
- **FR-004**: 标题最长 80 个字符；手机号必须符合中国大陆 11 位手机号格式；邮箱可选但填写时必须符合邮箱格式。
- **FR-005**: 当“是否替他人上报”为是时，必须要求上报人姓名和上报人手机号。
- **FR-006**: 系统选择必须通过 `/api/systems` 获取后台配置中 `visibleInSubmit !== false` 的系统，并按新老系统标签级联过滤。
- **FR-007**: 提交 payload 必须同时保存系统编码 `systemCode` 和提交当时的系统中文名 `systemName`；`systemName` 是历史快照，不因后台系统改名而回写。
- **FR-008**: 提交页必须展示优先级 SLA 提示：P1 30 分钟、P2 2 小时、P3 6 小时、P4 8 小时。
- **FR-009**: 数据提取工单必须展示“是否结构化”单选项，默认值为否。
- **FR-010**: 当数据提取工单选择结构化为是时，系统必须展示提数平台引导并阻止提交。
- **FR-011**: 权限申请工单必须展示权限申请模板下载链接，目标为 `/api/templates/permission-request`。
- **FR-012**: 权限申请工单必须要求上传 `.xls` 或 `.xlsx` 权限申请文件，且该文件保存时必须标记为权限申请附件类别。
- **FR-013**: 普通附件必须支持常见办公文件、压缩包、文本、CSV 和图片类型，最多 10 个。
- **FR-014**: 数据修正工单必须支持从 `/api/data-fix-schemes` 加载方案，并以弹窗表格单选。
- **FR-015**: 选择数据修正方案后，提交 payload 必须包含方案 ID、标题、描述和 requesterSolution。
- **FR-016**: 数据修正工单必须支持“没有方案，转人工咨询”，该操作把 `toolType` 改为 `CONSULT` 并清空方案数据。
- **FR-017**: 应用系统常规咨询提交时必须先通过 `CREATE_DRAFT` 创建草稿，再打开大模型解答抽屉。
- **FR-018**: 大模型确认已解决必须通过 `AI_RESOLVE` 事件关闭工单；继续人工处理必须通过 `SUBMIT` 事件进入待受理。
- **FR-019**: 数据提取和权限申请提交必须通过 `SUBMIT_TO_OA` 进入审批中。
- **FR-020**: 有方案的数据修正提交必须通过 `SUBMIT_DATA_FIX_SCHEME_REVIEW` 进入方案审核。
- **FR-021**: 暂存草稿必须通过 `CREATE_DRAFT` 事件完成，不得直接写入工单状态字段。
- **FR-022**: 草稿编辑保存必须通过 `UPDATE_DRAFT` 事件完成；草稿再次提交必须复用当前提交页的类型分支规则。
- **FR-023**: 表单提交校验失败时必须弹出警告、滚动到首个错误字段，并对错误字段使用强调样式。
- **FR-024**: 一键生成模拟工单只在新建模式展示，不在草稿编辑模式展示。
- **FR-025**: 一键生成模拟工单必须优先调用 `/api/ai/mock-ticket-description` 生成描述，失败时保留本地模拟字段并提示失败原因。
- **FR-026**: 提交页、API、store 和组件不得直接写入 `status`、`requesterStatus`、`supportStatus` 或 `processingSubStatus`。

### Non-Functional Requirements

- **NFR-001**: 提交页应保持企业后台表单布局，避免卡片嵌套和营销式展示。
- **NFR-002**: 所有选择框必须支持搜索，避免系统或方案数量增加后难以查找。
- **NFR-003**: 新增业务规则必须有聚焦测试覆盖，至少覆盖成功路径和关键阻断路径。
- **NFR-004**: AI 能力不可用时，不得阻塞核心人工提交流程。

## Key Entities

- **Ticket Form Values**: 提交页表单值，包含工单类型、标题、优先级、系统分类、系统编码、联系方式、代报信息、结构化提数标记、数据修正方案、富文本描述和附件列表。
- **Ticket Payload**: 发送给状态机或创建接口的工单数据，必须包含 `systemCode`、`systemName`、`priorityLabel`、`description`、`descriptionDoc`、`requesterId` 和 `requesterName`。
- **System Config Option**: 后台配置的系统选项，包含 `code`、`name`、`category`、`visibleInSubmit`；提交页只使用可见系统。
- **Permission Application Attachment**: 权限申请专用 Excel 附件，使用 `PERMISSION_APPLICATION` 类别区分于普通附件。
- **Data Fix Scheme**: 后台配置的数据修正方案，包含 `id`、`title`、`description`，用于生成数据修正工单的方案审核信息。
- **AI Draft Ticket**: 常规咨询提交后生成的草稿工单，用于承接大模型解答和后续人工提交。
- **Description Document**: 富文本 JSON 描述，用于持久化图文描述，并派生纯文本 `description`。

## Success Criteria

### Measurable Outcomes

- **SC-001**: 提单人能在 3 分钟内完成一张普通咨询工单填写，并进入 AI 解答抽屉。
- **SC-002**: 数据提取选择结构化为是时，提交阻断率为 100%，且不会产生任何新工单记录。
- **SC-003**: 权限申请未上传 Excel 时，提交阻断率为 100%；上传有效 Excel 后可进入 OA 审批。
- **SC-004**: 提交页所有系统名称选择只来自当前可见系统配置，不再依赖本地默认系统常量。
- **SC-005**: 任一新提交工单均同时包含系统编码和中文名快照；后台改名后，历史工单中文名保持不变。
- **SC-006**: 常规咨询的 AI 已解决和继续人工处理两个分支都能通过状态机事件完成，并保留时间线。
- **SC-007**: 相关测试覆盖提交页 AI 流程、草稿流程、结构化数据提取阻断、权限 Excel 文件、系统配置读取和状态机创建路径。

## Assumptions

- 结构化数据提取由外部提数平台承接，本系统只负责提示和阻断，不提供跳转 URL 配置能力。
- 权限申请模板由 `/api/templates/permission-request` 返回，模板内容属于原型能力，后续可由真实模板文件替换。
- 数据提取、权限申请和数据修正审批流仍由现有 OA/方案审核状态机事件表达，不在提交页引入新的状态字段。
- 系统配置由后台系统配置页面维护；提交页只消费可见系统，不提供系统新增或编辑能力。
- 当前附件实现可以使用本地 base64 或上传记录归一化模型，提交页不关心底层存储实现。

## Constitution Compliance

- 工单创建、草稿、AI 办结、人工提交、审批提交和方案审核全部通过 `src/state-machine/ticketStateMachine.js` 中的事件完成。
- 提交页和 API 不得直接写入 `status`、`requesterStatus`、`supportStatus` 或 `processingSubStatus`。
- 审批类和咨询类分支必须在 UI、API 和状态机之间保持一致。
- 系统名称快照属于工单业务数据，必须在状态机创建或更新工单时写入；后台配置改名不得回写历史工单。
- 提交页相关行为必须由聚焦测试守护，包括 `ticketSubmitAiFlow`、`ticketSubmitDraft`、`ticketSubmitPriorityLayout`、`fileUtils`、状态机和创建路由测试。


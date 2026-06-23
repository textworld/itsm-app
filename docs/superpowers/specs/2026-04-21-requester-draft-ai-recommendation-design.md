# 提单人草稿、筛选与智能推荐设计

## 背景

当前提单页仅支持直接提交正式工单，请求人列表仅按工单状态分 Tab 展示，缺少草稿概念、组合筛选能力，以及“先获取智能推荐再提交”的前置约束。

本次需求要求补齐提单人的完整预提交链路：

- 提单界面支持“暂存”，且每次暂存生成一条独立草稿记录
- 提单人的工单列表新增“草稿” Tab
- 提单列表新增按工单编号、工单标题、创建日期范围、级别、系统的筛选
- 提单界面新增“智能推荐”，模拟大模型基于工单描述生成解决方案
- 点击“智能推荐”时必须先对当前工单进行暂存
- 只有点击过“智能推荐”后，用户才允许提交工单

## 目标

- 为提单人建立“草稿 -> 智能推荐 -> 正式提交”的明确链路
- 草稿作为独立记录持久化到现有本地存储中，可在草稿 Tab 中继续编辑
- 不把草稿强行并入现有正式工单状态机
- 在提单列表中提供足够的组合筛选能力，覆盖草稿与正式工单视图
- 用前端模拟方式实现“智能推荐”，保证原型可演示、可重复生成

## 非目标

- 不接入真实大模型或远程接口
- 不让草稿进入现有 `/tickets/:id` 详情处理流
- 不修改一线、二线处理流程和既有状态机事件
- 不新增服务端持久化或数据库结构

## 方案选择

### 方案一：草稿与正式工单共用 `tickets` 存储，通过记录类型区分（推荐）

在现有 `TicketContext` 的 `tickets` 数组中同时存储草稿记录和正式工单记录，通过新增字段明确区分：

- `recordType: 'DRAFT' | 'TICKET'`
- 草稿不进入状态机
- 正式工单继续沿用现有 `status`、`timeline`、SLA 逻辑

优点：

- 改动面最小，复用现有 localStorage、Context、导出、列表渲染链路
- 草稿 Tab 与正式工单列表天然可以共用表格和筛选结构
- 从草稿转正式工单时，不需要跨两个数据源搬运复杂状态

缺点：

- 列表、详情、SLA 等位置都需要显式跳过草稿语义
- 表格渲染需要根据记录类型切换交互入口

### 方案二：新增独立 `drafts` 存储

单独维护草稿集合，列表页再将 `drafts` 和正式工单组合展示。

优点：

- 正式工单语义更纯粹

缺点：

- 存储、筛选、计数、导出、路由回填都需要两套拼装逻辑
- 对当前前端原型来说复杂度不成比例

### 方案三：仅保存单页表单快照

只在提单页维护一份或多份临时草稿，不进入列表。

缺点：

- 与“每次暂存生成一条独立草稿记录，可在草稿 Tab 中继续编辑”的需求不符

## 总体设计

### 数据模型

在现有工单对象基础上新增以下字段：

- `recordType: 'DRAFT' | 'TICKET'`
- `aiRecommendation: null | { generatedAt: string, summary: string, solutions: string[], nextActions: string[] }`
- `aiRecommendationReady: boolean`
- `aiRecommendationFingerprint: string`
- `draftSourceId?: string`

约束如下：

- 草稿记录使用 `recordType: 'DRAFT'`
- 正式工单使用 `recordType: 'TICKET'`
- 草稿记录不要求具备正式工单全部字段的完整值，但为简化表格和表单回填，仍保持与正式工单尽量一致的字段形状
- 正式工单提交成功后，不复用草稿记录本身，而是生成新的正式工单记录，并将草稿记录保留为“已转提交”或直接从草稿视图移除

推荐做法：

- 草稿保留在 `tickets` 中，但增加 `draftConvertedToTicketId`
- 草稿 Tab 默认仅显示未提交草稿，即 `recordType === 'DRAFT' && !draftConvertedToTicketId`

### 编号策略

正式工单继续使用现有 `TKT-YYYYMMDD-XXXX` 编号生成规则。

草稿记录单独使用草稿编号，避免与正式工单号混淆，建议格式：

- `DRF-YYYYMMDD-XXXX`

这样列表与编辑页都能清晰区分草稿和正式工单。

### 路由设计

提单页统一承担“新建”和“草稿继续编辑”两种模式：

- 新建：`/tickets/new`
- 草稿编辑：`/tickets/new?draftId=<draftId>`

草稿不进入现有 `/tickets/:id` 详情页。原因如下：

- 详情页天然绑定现有状态机、角色动作和留言处理流
- 草稿没有“受理 / 处理中 / 待验证”等正式状态语义
- 将草稿纳入详情页会引入大量分支判断，收益很低

## 提单页设计

### 页面动作

提单页新增三个主要动作：

- `暂存`
- `智能推荐`
- `提交工单`

行为约束：

1. 点击 `暂存`
   - 新建模式下生成一条新的草稿记录
   - 草稿编辑模式下更新当前草稿
   - 保存成功后页面继续停留在提单页，并切换为该草稿的编辑上下文

2. 点击 `智能推荐`
   - 必须先执行一次暂存
   - 暂存成功后，根据当前表单关键字段生成模拟推荐结果
   - 将推荐结果回写到对应草稿记录
   - `aiRecommendationReady` 置为 `true`

3. 点击 `提交工单`
   - 仅当当前上下文存在草稿且 `aiRecommendationReady === true` 时可执行
   - 提交时基于草稿内容生成正式工单记录
   - 正式工单走现有 `STATUS.PENDING` 初始状态与 `SUBMIT` 时间线

### 推荐失效规则

一旦用户修改以下任一关键字段，必须重新点击一次“智能推荐”后才允许提交：

- 工单标题
- 工单描述
- 级别
- 系统
- 工单类型

实现方式：

- 对上述字段计算一个 `fingerprint`
- 智能推荐成功后保存到 `aiRecommendationFingerprint`
- 表单值变化导致新指纹与已保存指纹不一致时，自动将 `aiRecommendationReady` 视为失效

此规则比“推荐只要点过一次就永久有效”更严格，也更符合需求中的提交门禁语义。

### 表单回填

当以 `draftId` 打开提单页时：

- 表单字段由草稿记录回填
- 附件列表按草稿附件回填为可继续保留的展示态
- 智能推荐结果区域显示最近一次推荐内容
- 若关键字段已被修改并导致推荐失效，则显示“需重新智能推荐后才能提交”

### 智能推荐展示

推荐结果建议以卡片形式展示在提单页表单下方，包含：

- 问题摘要
- 推荐处理思路
- 推荐解决方案（2-3 条）
- 建议下一步动作

展示目标是支持原型演示，不要求完全拟真，但需要做到：

- 同一份输入可稳定给出结构化结果
- 不同系统、级别、工单类型和描述能表现出明显差异

## 草稿存储与提交转换

### 草稿暂存

草稿对象建议至少包含以下字段：

- `id`
- `recordType`
- `title`
- `toolType`
- `priority`
- `priorityLabel`
- `systemCode`
- `systemName`
- `reporterPhone`
- `reporterEmail`
- `reportForOthers`
- `reportedUserName`
- `reportedUserPhone`
- `description`
- `descriptionHtml`
- `attachments`
- `createdAt`
- `updatedAt`
- `requesterId`
- `requesterName`
- `aiRecommendation`
- `aiRecommendationReady`
- `aiRecommendationFingerprint`
- `draftConvertedToTicketId`

草稿不需要：

- `status`
- `timeline`
- `assigneeL1Id`
- `assigneeL2Id`
- SLA 到期时间

如果现有表格和渲染链路为了兼容需要这些字段，可以为空值占位，但不赋予正式语义。

### 从草稿提交正式工单

提交时执行以下步骤：

1. 校验当前草稿存在
2. 校验 `aiRecommendationReady === true`
3. 基于草稿内容生成新的正式工单号
4. 生成正式工单记录，设置：
   - `recordType: 'TICKET'`
   - `status: STATUS.PENDING`
   - `timeline` 包含一次 `SUBMIT`
   - `expiresAt` 按现有 SLA 规则计算
5. 将草稿记录标记为已转换，记录 `draftConvertedToTicketId`
6. 跳转到新的正式工单详情页

不建议直接把草稿记录原地“升格”为正式工单。原因：

- 草稿号和正式工单号的编号规则不同
- 保留来源关系更利于原型演示和后续追踪
- 可以清晰表达“推荐发生在草稿阶段，提交后生成正式工单”

## 列表页设计

### 提单人 Tab

提单人视图新增 `草稿` Tab，并保留原有正式工单状态 Tab。

建议结构：

- 全部
- 草稿
- 待受理
- 处理中
- 待排查
- 待复核
- 待验证
- 已办结

其中：

- `全部` 仅展示正式工单，不混入草稿
- `草稿` 仅展示当前用户未提交草稿
- 其余状态 Tab 仅展示正式工单

这样可以避免“全部”把草稿和正式工单混在一起，导致用户对状态语义产生误解。

### 筛选区

列表页顶部新增筛选栏，字段包括：

- 工单编号
- 工单标题
- 创建日期范围
- 级别
- 系统

筛选规则：

- 对当前活动 Tab 内的数据再做二次筛选
- 工单编号与工单标题采用模糊匹配
- 创建日期范围按 `createdAt` 过滤
- 级别按 `priority` 过滤
- 系统按 `systemCode` 或 `systemName` 过滤

建议提供：

- 查询按钮
- 重置按钮

但如果沿用受控表单实时过滤也可接受，只要交互清晰且性能足够。

### 表格表现

表格需要对草稿记录做差异化展示：

- 草稿行不显示 SLA 计时
- 草稿行状态列显示固定标签 `草稿`
- 草稿行操作文案显示 `继续编辑`
- 点击工单编号或标题时，草稿跳到 `/tickets/new?draftId=...`，正式工单仍跳 `/tickets/:id`

如果当前 `TicketTable` 复用难度较高，可以在列渲染中按 `recordType` 分支，而不是新建整套表格组件。

## 上下文与状态管理

`TicketContext` 需要补充的能力建议包括：

- `saveDraft(draft)`
- `updateDraft(draftId, updater)`
- `getDraftById(draftId)`
- `submitDraft(draftId, user)`

也可以不显式新增“DraftContext”，继续在 `TicketContext` 中集中维护，避免状态分散。

核心原则：

- 草稿和正式工单共用一个持久化源
- 草稿相关操作是正式工单操作的补充，不影响既有状态机实现

## 智能推荐模拟策略

建议新增一个纯函数工具模块，例如：

- `src/utils/aiRecommendation.js`

输入：

- `title`
- `description`
- `toolType`
- `priority`
- `systemName`

输出：

- `summary`
- `solutions`
- `nextActions`

推荐逻辑可采用规则组合模拟：

- 根据 `toolType` 决定主建议类型，例如权限、数据提取、其他
- 根据 `systemName` 拼接系统特定排查建议
- 根据 `priority` 调整建议语气和动作优先级
- 根据描述关键词匹配若干典型方案，如“超时”“乱码”“权限”“导出失败”“报错”

设计要求：

- 函数纯净，可重复
- 不依赖网络请求
- 输出结构稳定，便于 UI 展示与测试

## 错误处理

- 暂存失败：保留当前表单内容，提示失败
- 智能推荐失败：草稿应已成功保存，推荐失败不丢失草稿
- 提交失败：不清空草稿，允许继续修正后再次提交
- 草稿不存在：从 `draftId` 进入编辑页但未找到记录时，给出提示并允许回到新建页

## 影响范围

预计涉及文件：

- `src/pages/TicketSubmit/index.jsx`
- `src/pages/TicketList/index.jsx`
- `src/components/TicketList/TicketTable.jsx`
- `src/context/TicketContext.jsx`
- `src/constants/ticketStatus.js`
- `src/utils/idGenerator.js`
- `src/utils/storage.js`
- `src/utils/fileUtils.js`
- `src/router/index.jsx`
- `src/utils/aiRecommendation.js`（新增）
- 如需要，新增与筛选相关的轻量辅助模块或组件

## 验证方案

至少覆盖以下场景：

1. 新建提单页点击“暂存”后生成一条独立草稿记录
2. 草稿 Tab 能看到该草稿，并可进入继续编辑
3. 草稿编辑后再次暂存，只更新当前草稿，不重复生成新草稿
4. 未点击“智能推荐”时，提交按钮不可用或提交被拦截
5. 点击“智能推荐”时会先暂存，再展示推荐结果
6. 点击“智能推荐”后允许提交工单
7. 推荐完成后修改标题、描述、级别、系统或工单类型，会重新锁定提交
8. 草稿提交后生成新的正式工单，并跳转详情页
9. 草稿 Tab 中已转提交草稿默认不再展示
10. 列表页在任意 Tab 下都可按工单编号、标题、创建日期范围、级别、系统筛选
11. 草稿记录在列表中不显示正式状态流转语义和 SLA 倒计时

## 实施建议

建议按以下顺序实施：

1. 先扩展数据模型与 ID 生成逻辑，打通草稿存储
2. 再改造提单页，使其支持新建、暂存、草稿回填、智能推荐门禁
3. 然后改造列表页，接入草稿 Tab 和组合筛选
4. 最后补齐草稿转正式工单的提交链路与 UI 细节

这样可以先把数据和页面入口稳定下来，再处理列表和门禁规则，降低返工概率。

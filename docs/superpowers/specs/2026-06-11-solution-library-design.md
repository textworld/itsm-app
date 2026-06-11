# 标准解决方案库一期设计

## 背景

当前系统已有“数据修正方案”配置，但它只服务于特定提单场景，无法承载全局标准化解决方案库需要的权限、版本、引用追踪和统计能力。本期采用独立 SQLite 表设计，不复用 `data-fix-schemes` 配置，避免语义混淆，并为后续检索和统计扩展留出空间。

一期目标是完成可用闭环：管理员维护方案，处理人在工单留言中引用方案，系统保留引用时的方案版本与快照，后台可追踪版本、回滚、统计和批量导入导出。

## 范围

### 本期包含

- 全局标准解决方案库的创建、编辑、删除、启用、停用。
- 核心字段：方案编码、标题、描述、详细说明、适用险种、关联内部方案。
- 多维分类：工单类型、业务系统、问题类型。
- 权限分级：编辑权限和引用权限。
- 方案版本管理：每次创建、编辑、启停、回滚均生成版本记录。
- 历史版本查看、字段级文本对比、一键回滚。
- 工单留言区一键引用方案，引用记录写入方案统计和工单日志。
- 引用记录保留方案版本号和完整引用快照。
- 标准 Excel 模板导入、导出，以及批量启用、停用。

### 本期不包含

- 独立团队或处理组管理页面。一期用角色组 `L1`、`L2` 映射“指定团队/处理组”。
- 多个进展操作面板的全面嵌入。一期先接入工单留言区，后续可扩展到进展更新入口。
- 高级可视化 diff。一期做字段级文本对比。

## 数据模型

### `solutions`

保存方案当前态，使用独立表承载查询与统计。

核心列：

- `id`：方案 ID。
- `code`：方案编码，唯一，用于导入 upsert。
- `title`：方案标题。
- `enabled`：启用状态。
- `version_no`：当前版本号。
- `updated_at`：最近更新时间，用于列表排序。
- `data`：完整 JSON 当前快照。

`data` 中保存：

- `description`：方案描述。
- `detailHtml`、`detailText`：详细说明富文本和纯文本。
- `insuranceTypeIds`：适用险种 ID 列表，来自 `INSURANCE_TYPE` 词典。
- `relatedInternalSchemeIds`：关联内部方案 ID 列表，初期可引用现有数据修正方案或方案库内其他方案。
- `ticketTypes`：工单类型标签。
- `systemCodes`：业务系统编码，来自系统配置。
- `problemTypeIds`：问题类型 ID 列表，优先使用系统分类词典选项。
- `editPermission`：`ADMIN_ONLY` 或 `ASSIGNED_TEAMS`，带 `teamRoles`。
- `referencePermission`：`COMPANY` 或 `ASSIGNED_GROUPS`，带 `groupRoles`。
- `stats`：引用次数、最近引用时间。
- `createdAt`、`createdBy`、`updatedAt`、`updatedBy`。

### `solution_versions`

保存每次变更快照，版本号单调递增。

核心列：

- `id`：版本记录 ID。
- `solution_id`：方案 ID。
- `version_no`：版本号。
- `change_type`：`CREATE`、`UPDATE`、`ENABLE`、`DISABLE`、`ROLLBACK`、`IMPORT`。
- `snapshot`：该版本完整方案快照。
- `operator`：操作人快照。
- `created_at`：版本生成时间。

回滚不会覆盖历史版本，而是以目标版本快照生成一个新的当前版本，`change_type` 为 `ROLLBACK`。

### `solution_references`

保存方案被工单引用的历史。引用记录必须保留引用时版本号和完整快照，防止后续方案编辑导致历史工单内容变化。

核心列：

- `id`：引用记录 ID。
- `solution_id`：方案 ID。
- `solution_code`：引用时方案编码。
- `solution_title`：引用时方案标题。
- `version_no`：引用时方案版本号。
- `snapshot`：引用时方案完整快照。
- `ticket_id`：关联工单 ID。
- `message_id`：写入留言区的消息 ID。
- `operator`：引用人快照。
- `quoted_at`：引用时间。
- `channel`：引用入口，初期为 `MESSAGE_REPLY`。

## 服务层

新增 `src/server/solutionLibraryStore.js`：

- `listSolutions(filters, user)`：后台列表和筛选。
- `listReferenceableSolutions(ticket, user, filters)`：按工单上下文和用户权限过滤可引用方案。
- `createSolution(input, user)`、`updateSolution(id, input, user)`。
- `deleteSolution(id, user)`。
- `setSolutionEnabled(id, enabled, user)`、`bulkSetSolutionEnabled(ids, enabled, user)`。
- `getSolutionDetail(id)`：返回当前态、版本和引用统计。
- `rollbackSolution(id, versionNo, user)`。
- `referenceSolution({ solutionId, ticketId, channel }, user)`：创建引用记录，返回引用消息和系统日志消息。
- `parseSolutionImportWorkbook(file, user)`、`buildSolutionExportWorkbook(filters)`。

新增 `src/utils/solutionLibrary.js`：

- 字段标准化与校验。
- 权限判断。
- 筛选匹配。
- 版本快照构建。
- 导入导出行映射。

权限规则：

- 后台管理入口仅管理员可见。
- 编辑权限为 `ADMIN_ONLY` 时只有管理员可编辑。
- 编辑权限为 `ASSIGNED_TEAMS` 时，管理员和配置的角色组成员可编辑；但后台页面一期仍只开放给管理员，接口保留规则。
- 引用权限为 `COMPANY` 时，`L1`、`L2` 均可引用。
- 引用权限为 `ASSIGNED_GROUPS` 时，仅配置角色组可引用。
- 停用方案不可引用。

## API 设计

后台接口：

- `GET /api/admin/solutions`：列表、筛选、依赖数据。
- `POST /api/admin/solutions`：创建方案。
- `GET /api/admin/solutions/[id]`：详情、版本、引用统计。
- `PUT /api/admin/solutions/[id]`：编辑方案。
- `DELETE /api/admin/solutions/[id]`：删除方案。
- `POST /api/admin/solutions/[id]/enable`：启用或停用。
- `POST /api/admin/solutions/bulk-status`：批量启停。
- `POST /api/admin/solutions/[id]/rollback`：回滚到指定版本。
- `GET /api/admin/solutions/export`：导出当前筛选结果。
- `GET /api/admin/solutions/template`：下载空模板。
- `POST /api/admin/solutions/import`：导入模板。

工单侧接口：

- `GET /api/solutions/referenceable`：按当前用户、工单上下文返回可引用方案。
- `POST /api/workflow/tickets/[id]/solution-references`：引用方案，创建引用记录并写入工单消息。

`POST /api/workflow/tickets/[id]/solution-references` 不直接修改工单状态字段，只通过现有消息写入机制追加留言和系统日志，遵守工单状态机约束。

## 后台页面

新增页面 `src/views/AdminSolutions`，路由为 `/solutions`，菜单文案为“标准解决方案库”。

列表能力：

- 关键词搜索：编码、标题、描述、详细说明。
- 筛选：启用状态、险种、工单类型、业务系统、问题类型。
- 列展示：标题、编码、启用状态、分类标签、权限摘要、当前版本、引用次数、更新时间。
- 操作：详情、编辑、删除、启用、停用、版本、回滚。
- 批量操作：批量启用、批量停用、导出。

编辑抽屉：

- 基础字段：编码、标题、描述。
- 富文本详细说明。
- 适用险种下拉。
- 关联内部方案下拉。
- 分类字段：工单类型、业务系统、问题类型。
- 权限字段：编辑权限、引用权限。
- 保存后生成版本记录。

详情抽屉：

- 当前方案内容。
- 引用统计。
- 版本列表。
- 历史版本查看。
- 当前版本与历史版本字段级对比。
- 回滚操作。

## 工单引用交互

在工单详情留言区给 `L1`、`L2` 处理人提供“引用方案”按钮。

流程：

1. 点击“引用方案”打开选择弹窗。
2. 弹窗按当前工单上下文预筛选：业务系统、问题类型、工单类型。
3. 用户可搜索并查看方案详情。
4. 选择方案后，将方案标题、版本号、描述和详细说明插入留言富文本。
5. 发送引用时调用 `POST /api/workflow/tickets/[id]/solution-references`。
6. 服务端创建引用记录，写入一条可见留言，并追加一条系统日志消息。

留言元数据：

- 引用留言携带 `solutionReference`：`solutionId`、`solutionCode`、`solutionTitle`、`versionNo`、`referenceId`。
- 留言展示时显示“引用方案 vN”标签。
- 系统日志消息格式：`【系统】{操作人}引用标准解决方案《{标题}》v{版本号}`。

## 导入导出

Excel 模板列：

- 方案编码。
- 方案标题。
- 方案描述。
- 详细说明。
- 启用状态。
- 适用险种。
- 关联内部方案。
- 工单类型。
- 业务系统。
- 问题类型。
- 编辑权限。
- 编辑团队。
- 引用权限。
- 引用处理组。

导入规则：

- 按方案编码 upsert。
- 编码存在则更新并生成新版本。
- 编码不存在则创建。
- 校验失败返回行号、字段和错误原因。
- 一期不做静默跳过；有错误则整体失败，避免半导入难追踪。

导出规则：

- 支持按当前筛选结果导出。
- 导出当前版本内容，不导出历史版本。
- 另提供空模板下载。

## 错误处理

- 接口统一返回 `{ ok: false, reason, errors? }`。
- 字段校验错误使用 `path` 和 `message`。
- 导入错误包含 `rowNumber`、`field`、`message`。
- 删除被引用方案时，一期允许删除当前态，但保留 `solution_versions` 和 `solution_references` 历史；后台详情不可再打开当前态，只在引用历史中保留快照。
- 引用已停用或无权限方案时返回 403。
- 引用不存在方案时返回 404。

## 测试策略

工具层测试：

- 字段校验。
- 权限过滤。
- 筛选匹配。
- 版本号递增。
- 回滚快照。
- 导入行解析和导出行映射。

服务层测试：

- 创建、编辑、删除、启停、批量启停。
- 创建和编辑生成版本。
- 回滚生成新版本。
- 引用记录保留 `versionNo` 和完整 `snapshot`。
- 引用统计递增。
- 引用 v2 后编辑到 v3，历史引用仍显示 v2 快照。

路由测试：

- 管理员接口鉴权。
- 非管理员拒绝后台管理。
- L1/L2 按引用权限获取可引用方案。
- 引用接口写入留言、系统日志和引用记录。
- 导入错误返回行号。

前端静态测试：

- 菜单入口。
- 后台页面字段、筛选、批量操作、导入导出入口。
- 详情抽屉、版本列表、回滚入口。
- 工单留言区“引用方案”入口和引用标签。

集成验证：

- 运行方案库相关 `node --test`。
- 运行工单消息相关测试。
- 运行 `npm run build`。

## 兼容性与迁移

- 现有“数据修正方案”保留，不作为本期方案库底层存储。
- 可在方案编辑中把现有数据修正方案作为“关联内部方案”下拉来源之一。
- SQLite native 不可用时，JSON fallback 需要同步支持 `solutions`、`solution_versions`、`solution_references`。
- 本期不迁移已有数据修正方案到方案库，避免自动迁移造成语义误判。

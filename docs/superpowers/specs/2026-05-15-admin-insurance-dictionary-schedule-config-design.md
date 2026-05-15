# 管理员险种词典与排班配置设计

## 背景

当前 ITSM 应用已有 `ADMIN` 角色、受保护路由、Ant Design 后台布局、SQLite 主存储与 JSON fallback 存储。工单业务状态必须通过 `src/state-machine/ticketStateMachine.js` 事件流转，后台配置能力不应直接修改任何工单状态字段。

本设计新增两个管理员配置入口：

- `险种词典`
- `排班配置`

第一版只把“险种”做成通用词典；系统仍复用现有 `src/constants/systems.js` 的 `SYSTEM_OPTIONS`，不迁移为可配置项。

## 目标

- 管理员可以维护险种词典，供排班配置选择。
- 管理员可以维护多个排班分组。
- 一个排班分组可以选择多个系统。
- 一个排班分组必须包含一个基础排班，基础排班只需要选择人员。
- 一个排班分组可以包含多个险种排班小组，每个小组选择人员和险种。
- 排班人员只允许选择现有 `L1` 一线技术支持人员。
- 非管理员不能看到配置入口，也不能访问页面或接口。

## 非目标

- 不改工单创建、受理、流转、分派等状态机逻辑。
- 不把系统、工单类型、优先级等现有常量迁移到词典。
- 不限制同一个人员跨不同排班分组出现。
- 不把排班配置接入自动派单或子任务路由；本次只完成后台配置管理。

## 导航与权限

顶部导航新增两个入口：

- `/dictionaries/insurance-types`：险种词典
- `/schedules`：排班配置

导航规则：

- 仅 `user.role === ROLES.ADMIN` 时展示两个入口。
- 页面服务端入口使用管理员权限检查；非登录用户跳转登录，非管理员展示无权限页面或返回 403 语义页面。
- API 使用同一套管理员检查；非登录返回 401，非管理员返回 403。

## 险种词典

险种字段：

- `id`：内部 ID，如 `ins_...`
- `code`：险种编码，必填、唯一、稳定，例如 `MEDICAL`
- `name`：险种名称，必填、唯一，例如 `医疗险`
- `enabled`：是否启用
- `createdAt`
- `updatedAt`

交互：

- 列表展示编码、名称、状态、更新时间和操作。
- 支持新增、编辑、启用、停用。
- 删除采用停用，不做物理删除，避免已有排班引用失效。
- 排班配置只允许选择启用的险种。

## 排班配置

排班配置为一个配置对象，包含多个分组：

```js
{
  groups: [
    {
      id: 'grp_...',
      name: 'ERP 排班组',
      systemCodes: ['ERP_CORE', 'FINANCE_BI'],
      baseSchedule: {
        userIds: ['u_l1_1', 'u_l1_2']
      },
      insuranceTeams: [
        {
          id: 'team_...',
          name: '医疗险小组',
          userIds: ['u_l1_3'],
          insuranceTypeCodes: ['MEDICAL']
        }
      ]
    }
  ],
  updatedAt: '2026-05-15T00:00:00.000Z',
  updatedBy: {
    id: 'u_admin_1',
    name: '管理员'
  }
}
```

页面交互：

- 顶部提供“新增分组”和“保存配置”。
- 分组以可编辑卡片或折叠面板展示。
- 每个分组编辑：
  - 分组名称
  - 系统多选
  - 基础排班人员多选
  - 险种排班小组列表
- 险种排班小组编辑：
  - 小组名称
  - 人员多选
  - 险种多选
- 人员选择列表只包含 `L1` 一线技术支持人员。
- 系统选择列表来自 `SYSTEM_OPTIONS`。
- 险种选择列表来自启用的险种词典。

## 校验规则

保存排班配置时，前端和后端都执行同一组校验：

- 一个系统不能出现在多个排班分组中。
- 每个分组必须有分组名称。
- 每个分组必须至少选择一个系统。
- 每个分组必须有基础排班。
- 基础排班必须至少选择一个 `L1` 人员。
- 险种排班小组的人员必须全部是 `L1`。
- 同一个排班分组内，同一个人不能出现在多个险种排班小组中。
- 同一个排班分组内，同一个险种不能出现在两个险种排班小组中。
- 险种排班小组只能引用启用的险种。
- 险种排班小组可以为空列表；基础排班是必填。
- 同一个人员跨不同排班分组出现暂不限制。

后端返回结构化错误，包含字段路径和错误信息，便于页面定位：

```js
{
  ok: false,
  reason: '排班配置校验失败',
  errors: [
    { path: ['groups', 0, 'systemCodes'], message: 'ERP 核心系统已出现在其他排班分组中' }
  ]
}
```

## 存储设计

沿用当前 `src/server/db.js` 模式，同时支持 SQLite 与 JSON fallback。

新增 SQLite 表：

```sql
CREATE TABLE IF NOT EXISTS dictionary_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL,
  UNIQUE(type, code)
);

CREATE TABLE IF NOT EXISTS app_configs (
  key TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
```

约定：

- 险种词典 `type = 'INSURANCE_TYPE'`。
- 排班配置 `app_configs.key = 'SCHEDULE_CONFIG'`。
- JSON fallback 增加 `dictionary_items` 与 `app_configs` 数组。
- 初始种子可以提供少量默认险种，便于演示。

## 服务端模块

新增 `src/server/adminConfigStore.js`：

- `listInsuranceTypes()`
- `createInsuranceType(input, user)`
- `updateInsuranceType(id, input, user)`
- `setInsuranceTypeEnabled(id, enabled, user)`
- `getScheduleConfig()`
- `saveScheduleConfig(input, user)`
- `listL1Users()`

新增 `src/utils/adminConfigValidation.js`：

- `validateInsuranceTypeInput(input, existingItems, currentId)`
- `validateScheduleConfig(config, context)`
- `normalizeScheduleConfig(config, context)`

`context` 包含：

- `systems`
- `enabledInsuranceTypes`
- `assignableUsers`

纯函数校验用于前端预校验和服务端强校验，测试集中覆盖业务约束。

## API

险种词典：

- `GET /api/admin/dictionaries/insurance-types`
- `POST /api/admin/dictionaries/insurance-types`
- `PATCH /api/admin/dictionaries/insurance-types/[id]`

排班配置：

- `GET /api/admin/schedules`
- `PUT /api/admin/schedules`

响应约定：

- 成功：`{ ok: true, ...payload }`
- 未登录：`401 { ok: false, reason: '未登录' }`
- 非管理员：`403 { ok: false, reason: '无管理员权限' }`
- 校验失败：`400 { ok: false, reason, errors }`

## 前端页面

新增页面：

- `app/(protected)/dictionaries/insurance-types/page.jsx`
- `app/(protected)/schedules/page.jsx`
- `src/views/AdminInsuranceDictionary/index.jsx`
- `src/views/AdminScheduleConfig/index.jsx`

布局风格：

- 继续使用现有后台顶栏布局。
- 页面用 Ant Design `Card`、`Table`、`Form`、`Select`、`Switch`、`Modal`、`Collapse`。
- 不做营销式页面；配置页保持表单化、密集但清晰。

前端 API 封装：

- 可在页面内保留局部 `requestJson`，与现有 `AuthContext`、`TicketContext` 风格一致。
- 页面加载失败展示 `Alert`。
- 保存成功使用 Ant Design message 提示。
- 后端结构化校验错误映射为页面顶部错误列表，必要时同步到表单字段。

## 测试策略

优先覆盖纯业务规则和接口权限：

- `src/utils/__tests__/adminConfigValidation.test.js`
  - 险种编码和名称唯一。
  - 排班配置必须有基础排班。
  - 系统不能跨分组重复。
  - 同组内险种不能跨险种小组重复。
  - 同组内人员不能跨险种小组重复。
  - 非 L1 人员不能作为排班人员。
  - 停用险种不能被排班引用。
- `src/server/__tests__/adminConfigStore.test.js`
  - SQLite/fallback 可读写险种和排班配置。
  - 保存时写入更新时间和更新人。
- `src/server/__tests__/adminConfigRoutes.test.js`
  - 未登录 401。
  - 非管理员 403。
  - 管理员可读写。
  - 校验失败返回结构化错误。
- `src/components/Layout/__tests__/appLayout.test.js`
  - 管理员导航展示词典与排班入口。
  - 非管理员不展示。

## 风险与取舍

- 使用 JSON data 列存储配置对象与当前 tickets/defects 模式一致，开发成本低，适合当前应用规模。
- 排班配置暂不接入自动派单，避免扩大影响面；后续若接入状态机或工单分派，应新增明确事件或路由策略，不绕过状态机改工单状态。
- 系统仍为代码常量，符合本次“只管理险种”的范围；后续若系统也需要配置，应单独设计迁移。

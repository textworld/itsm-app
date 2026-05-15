# 后台一线休息时间配置设计

## 背景

当前 ITSM 应用已经有管理员后台入口、管理员鉴权、账号管理、险种词典、排班配置、`app_configs` 配置存储，以及只允许管理员访问的后台 API。工单业务状态必须通过 `src/state-machine/ticketStateMachine.js` 的事件分发流转；本功能只维护一线技术支持休息时间，不修改派单逻辑，也不写入任何工单状态字段。

用户已确认休息时间按具体时间段配置，不做每周重复规则。

## 目标

- 管理员可以单独进入“一线休息时间配置”页面。
- 管理员可以维护一线技术支持人员的具体休息时间段。
- 管理员可以清楚查看未来 7、14、30 天内处于休息时间的技术支持人员清单。
- 顶部导航支持二级菜单，把后台管理相关入口集中展示。
- 保留本次需求提示词与设计文档，后续相关提示词和设计文档继续保存到 `docs/superpowers/` 下。

## 非目标

- 不修改自动派单、子任务派工、技术转交或任何工单流转行为。
- 不新增状态机事件。
- 不直接修改工单的 `status`、`requesterStatus`、`supportStatus`、`processingSubStatus`。
- 不做重复休息规则、班次轮转、请假审批、审批流或日历订阅。

## 导航设计

把当前管理员专属入口收进二级菜单“后台管理”：

- 后台管理
  - 账号管理
  - 险种词典
  - 排班配置
  - 休息时间配置

工单列表、提交工单、历史工单、流转规则等现有业务入口保持现有权限和展示逻辑。

选中态规则：

- `/admin/users` 选中后台管理下的账号管理。
- `/dictionaries/insurance-types` 选中后台管理下的险种词典。
- `/schedules` 选中后台管理下的排班配置。
- `/support-rests` 选中后台管理下的休息时间配置。

## 页面设计

新增管理员页面 `/support-rests`，页面仅管理员可访问。非登录用户跳转登录，非管理员显示无权限。

页面包含两个区域。

### 休息时间维护

使用表格或紧凑卡片维护休息记录。每条记录字段：

- `userIds`：一线技术支持人员，多选，仅允许 L1。
- `startsAt`：休息开始时间，ISO 字符串存储，页面使用日期时间控件编辑。
- `endsAt`：休息结束时间，ISO 字符串存储。
- `reason`：备注，可选。

交互：

- 新增休息记录。
- 编辑人员、开始时间、结束时间、备注。
- 删除休息记录。
- 刷新配置。
- 保存配置。
- 保存前前端预校验；服务端保存时再次强校验。

### 未来休息清单

默认展示未来 14 天内休息人员清单，可切换 7 / 14 / 30 天。

展示规则：

- 只展示与未来窗口有交集的休息记录。
- 按日期升序分组。
- 每条展示人员姓名、时间段、备注。
- 若某条休息跨天，在每个涉及日期下都展示该记录，并标明当天范围。
- 无数据时展示空状态。

## 数据模型

新增配置 key：

```js
export const SUPPORT_REST_CONFIG_KEY = 'SUPPORT_REST_CONFIG';
```

存储位置复用 `app_configs`：

```js
{
  restPeriods: [
    {
      id: 'rest_...',
      userIds: ['u_l1_1', 'u_l1_2'],
      startsAt: '2026-05-18T01:00:00.000Z',
      endsAt: '2026-05-18T10:00:00.000Z',
      reason: '调休'
    }
  ],
  updatedAt: '2026-05-15T00:00:00.000Z',
  updatedBy: {
    id: 'u_admin_1',
    name: '管理员'
  }
}
```

## 校验规则

前后端共用纯函数校验：

- `restPeriods` 缺省时归一化为空数组。
- 每条记录必须有稳定 `id`；缺省时按序生成临时 id。
- 必须选择至少一名一线技术支持人员。
- `startsAt` 必须是有效时间。
- `endsAt` 必须是有效时间。
- `startsAt` 必须早于 `endsAt`。
- 每个 `userId` 必须存在于可选 L1 用户列表中。
- 同一名用户不能存在重叠休息时间段。

重叠判定：同一用户的两个时间段满足 `left.startsAt < right.endsAt && right.startsAt < left.endsAt` 时视为重叠。相邻但不交叠的时间段允许，例如 09:00-12:00 和 12:00-18:00。

## 服务端设计

扩展 `src/utils/adminConfigValidation.js`：

- `SUPPORT_REST_CONFIG_KEY`
- `normalizeSupportRestConfig(input)`
- `validateSupportRestConfig(input, context)`
- `buildUpcomingSupportRestDays(config, users, options)`

扩展 `src/server/adminConfigStore.js`：

- `getSupportRestConfig()`
- `saveSupportRestConfig(input, user)`

复用现有：

- `listL1Users()`
- `requireAdminUser()`
- `getSessionUserFromRequest()`

## API 设计

新增接口：

- `GET /api/admin/support-rests`
- `PUT /api/admin/support-rests`

`GET` 响应：

```js
{
  ok: true,
  config: { restPeriods: [], updatedAt: null, updatedBy: null },
  users: [
    { id: 'u_l1_1', username: 'support1', name: '李一线1', role: 'L1' }
  ],
  upcoming: {
    days: [
      {
        date: '2026-05-18',
        items: [
          {
            id: 'rest_1',
            userIds: ['u_l1_1'],
            userNames: ['李一线1'],
            startsAt: '2026-05-18T01:00:00.000Z',
            endsAt: '2026-05-18T10:00:00.000Z',
            dayStartsAt: '2026-05-18T01:00:00.000Z',
            dayEndsAt: '2026-05-18T10:00:00.000Z',
            reason: '调休'
          }
        ]
      }
    ]
  }
}
```

`PUT` 请求：

```js
{
  restPeriods: [
    {
      id: 'rest_1',
      userIds: ['u_l1_1'],
      startsAt: '2026-05-18T01:00:00.000Z',
      endsAt: '2026-05-18T10:00:00.000Z',
      reason: '调休'
    }
  ]
}
```

成功响应：

```js
{ ok: true, config: { restPeriods: [], updatedAt: '...', updatedBy: { id: 'u_admin_1', name: '管理员' } } }
```

失败响应沿用现有管理员接口风格：

- 未登录：`401 { ok: false, reason: '未登录' }`
- 非管理员：`403 { ok: false, reason: '无管理员权限' }`
- 校验失败：`400 { ok: false, reason: '休息时间配置校验失败', errors: [...] }`

## 前端设计

新增：

- `app/(protected)/support-rests/page.jsx`
- `src/views/AdminSupportRestConfig/index.jsx`
- `src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`

页面使用 Ant Design：

- `Card`
- `Table`
- `Select`
- `DatePicker.RangePicker` 或两个 `DatePicker showTime`
- `Input`
- `Button`
- `Segmented`
- `Alert`
- `Empty`

页面状态：

- `restPeriods`
- `users`
- `upcomingDays`
- `rangeDays`
- `loading`
- `saving`
- `errors`

保存策略：

- 页面把日期时间统一转为 ISO 字符串提交。
- 保存成功后用服务端返回值刷新页面状态。
- `rangeDays` 变更时前端基于当前配置重新计算未来清单，或调用 GET 并带查询参数；第一版建议前端本地计算，减少接口复杂度。

## 测试策略

新增和扩展测试：

- `src/utils/__tests__/adminConfigValidation.test.js`
  - 休息记录必须选择 L1 人员。
  - 开始结束时间必填且有效。
  - 开始时间必须早于结束时间。
  - 非 L1 用户不能保存。
  - 同一用户重叠休息时间被拒绝。
  - 相邻时间段允许。
  - 未来清单按日期分组，跨天记录在多个日期展示。
- `src/server/__tests__/adminConfigStore.test.js`
  - 可保存和读取休息时间配置。
  - 保存写入更新时间和更新人。
  - 非法配置返回结构化错误。
- `src/server/__tests__/adminConfigRoutes.test.js`
  - GET/PUT 需要管理员权限。
  - GET 返回 L1 用户和配置。
  - PUT 校验失败返回结构化错误。
- `src/components/Layout/__tests__/appLayout.test.js`
  - 管理员导航包含二级后台管理菜单和休息时间配置入口。
- `src/views/AdminSupportRestConfig/__tests__/adminSupportRestConfigView.test.js`
  - 页面调用 `/api/admin/support-rests`。
  - 页面提供新增、删除、保存和未来窗口切换。

## 风险与取舍

- 使用 `app_configs` 存储能保持和现有排班配置一致，避免为轻量配置新增表。
- 第一版不接入派单，避免改变现有工单分配结果；后续如果要避开休息人员，应单独设计派单候选人选择策略。
- 禁止重叠休息时间可以减少未来展示歧义；如果业务允许重复记录，后续可放宽校验。

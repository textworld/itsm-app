# 后端接口文档

最后更新：2026-05-27

本文档覆盖本项目当前所有 `app/api/**/route.js` 接口。项目采用 Next.js Route Handlers，返回体大多为 JSON，少量接口返回文件流或 HTML 下载内容。

## 约定

- 鉴权方式：通过 Cookie 会话 `itsm_session_user_id`
- 返回结构：绝大多数 JSON 接口返回 `{ ok: boolean, ... }`
- 状态机约束：工单业务流转必须通过 `src/state-machine/ticketStateMachine.js` 的事件分发完成
- 路径命名：文档中的 `:id`、`:oaId` 为动态路由参数
- 兼容路由：`/api/config/**` 多为 `/api/admin/**`、`/api/personal/**`、`/api/dictionaries/**` 的转发入口

## 通用错误

| 状态码 | 含义 |
| --- | --- |
| 401 | 未登录 |
| 403 | 无管理员权限 |
| 404 | 资源不存在 |
| 400 | 参数错误 / 业务校验失败 |
| 500 | 服务内部错误 |
| 502 | AI 返回空内容等上游异常 |

---

## 一、鉴权与会话

### `POST /api/auth/login`
登录并写入会话 Cookie。

请求体：
```json
{ "username": "test_user", "password": "123456", "role": "REQUESTER" }
```

返回：
```json
{ "ok": true, "user": { "id": "...", "username": "...", "role": "..." } }
```

### `POST /api/auth/logout`
清除会话 Cookie。

返回：
```json
{ "ok": true }
```

### `POST /api/auth/register`
公开注册账号并自动登录。

请求体同登录类账号信息。

### `GET /api/auth/session`
读取当前会话用户。

返回：
```json
{ "ok": true, "user": null }
```
或：
```json
{ "ok": true, "user": { "id": "..." } }
```

### `POST /api/access/login`
### `POST /api/access/logout`
### `POST /api/access/register`
### `GET /api/access/session`
上面四个接口与 `/api/auth/*` 语义一致，为旧入口/兼容入口。

### `GET /api/access/templates/permission-request`
下载权限申请模板 Excel。

返回：`application/vnd.ms-excel`

### `GET /api/templates/permission-request`
同上，为公开模板入口。

---

## 二、工单提交

### `POST /api/submission/drafts`
创建草稿工单。内部走 `CREATE_DRAFT`。

请求体：
```json
{ "ticket": { "title": "..." } }
```

返回：
```json
{ "ok": true, "ticket": { "status": "DRAFT" } }
```

### `PATCH /api/submission/drafts/:id`
更新草稿。内部走 `UPDATE_DRAFT`。

请求体：
```json
{ "values": {}, "attachments": [] }
```

### `POST /api/submission/tickets`
提交正式工单。默认走 `SUBMIT`，但会根据工单类型自动切换到：
- `SUBMIT_TO_OA`
- `SUBMIT_DATA_FIX_SCHEME_REVIEW`
- `SUBMIT`

请求体：
```json
{ "ticket": {}, "draftId": "optional", "event": "SUBMIT" }
```

### `POST /api/tickets`
通用创建/提交入口，内部同样通过状态机创建工单。

### `POST /api/tickets/:id/dispatch`
对指定工单分发任意状态机事件。

请求体：
```json
{ "event": "ACCEPT", "payload": {} }
```

### `PATCH /api/tickets/:id`
当前仅返回 405，提示工单修改必须通过状态机事件接口。

---

## 三、工单工作流

### `GET /api/workflow/tickets`
获取当前用户可见工单列表。

### `POST /api/workflow/tickets`
通过工作流入口创建/提交工单。与 `/api/tickets` 逻辑一致。

### `GET /api/workflow/tickets/:id`
获取工单详情。

### `POST /api/workflow/tickets/:id/commands`
按命令名分发状态机事件。

请求体：
```json
{ "command": "ACCEPT", "payload": {} }
```

支持的命令包括：
`SUBMIT`、`CREATE_DRAFT`、`UPDATE_DRAFT`、`AI_RESOLVE`、`WITHDRAW`、`ACCEPT`、`TAG_DEFECT`、`UPDATE_LINKED_DEFECT`、`UPDATE_SUMMARY`、`SUSPEND`、`RESUME_FROM_SUSPEND`、`REQUEST_L2_SUPPORT`、`CREATE_SUBTASK`、`CREATE_SUBTASK_TICKET`、`CLAIM_SUBTASK`、`TRANSFER_SUBTASK`、`NO_ACTION_SUBTASK`、`START_SUBTASK`、`COMPLETE_SUBTASK`、`TRANSFER_TECH`、`AUTO_ASSIGN_TECH`、`RETURN_FOR_INFO`、`UPDATE_INFO_SUPPLEMENT`、`COMPLETE_INFO_SUPPLEMENT`、`L1_REVIEW`、`INITIATE_CLOSURE`、`REQUESTER_CLOSE`、`VERIFY_YES`、`VERIFY_NO`、`SUBMIT_TO_OA`、`SUBMIT_DATA_FIX_SCHEME_REVIEW`、`REQUESTER_SUBMIT_OA`、`OA_ITSM_GENERATE_TICKET`、`OA_DIRECT_CLOSE`、`OA_REJECT`、`OA_REOPEN`、`OA_REAPPROVE_GENERATE`、`OA_REAPPROVE_CLOSE`、`CONFIRM_DATA_FIX_SOLUTION`

### `POST /api/workflow/tickets/:id/messages`
给工单追加留言。

请求体：
```json
{ "message": { "id": "msg-1", "content": "hello" } }
```

### `POST /api/workflow/tickets/:id/custom-tags`
更新自定义标签。

请求体：
```json
{ "tags": [] }
```

### `GET /api/workflow/defects`
获取缺陷列表。

### `POST /api/workflow/defects`
创建缺陷。

### `GET /api/workflow/message-reads`
获取当前用户的留言已读记录。

### `POST /api/workflow/message-reads`
标记留言已读。

请求体：
```json
{ "ticketId": "TKT-1", "readAt": "2026-05-25T00:00:00.000Z" }
```

### `POST /api/workflow/reset`
重置工作流数据。

### `GET /api/workflow/export`
导出工单 JSON 文件。

返回：`application/json` 文件流。

---

## 四、工单与辅助入口

### `POST /api/tickets/:id/messages`
### `POST /api/tickets/:id/custom-tags`
### `POST /api/tickets/:id/dispatch`
历史入口，分别与工作流留言、标签、事件分发接口一致。

### `GET /api/support-assignees`
获取可分配的一线/二线支持人。

查询参数：`role=L1|L2`

### `GET /api/systems`
获取提交页可见系统列表。

### `GET /api/dictionaries/options?type=XXX`
获取字典可用选项。

### `GET /api/data`
一次性返回当前用户可见工单、缺陷和已读记录。

### `GET /api/export`
导出工单 JSON 文件。

### `POST /api/message-reads`
标记留言已读的旧入口。

### `POST /api/reset`
重置数据库数据的旧入口。

### `POST /api/defects`
创建缺陷的旧入口。

### `GET /api/data-fix-schemes`
获取数据修正规则配置。

---

## 五、OA / 审批

### `GET /api/approval/applications`
获取 OA 申请列表。

### `GET /api/approval/applications/:oaId`
获取单个 OA 申请详情。

### `POST /api/approval/applications/:oaId/actions`
执行 OA 审批动作。

请求体：
```json
{ "action": "GENERATE_TICKET", "opinion": "", "attachments": [] }
```

### `GET /api/oa-simulator/applications`
获取 OA 模拟器申请列表，仅管理员。

### `POST /api/oa-simulator/applications/:oaId/actions`
执行 OA 模拟器动作，仅管理员。

动作映射与审批接口一致。

---

## 六、配置接口

### `GET /api/admin/users`
### `POST /api/admin/users`
### `PATCH /api/admin/users`
管理员用户列表、创建账号、更新账号可用状态。

### `GET /api/access/admin/users`
### `POST /api/access/admin/users`
### `PATCH /api/access/admin/users`
同上，为兼容入口。

### `GET /api/admin/systems`
### `PUT /api/admin/systems`
系统配置读取与保存。

### `GET /api/config/admin/systems`
### `PUT /api/config/admin/systems`
同上，为兼容入口。

### `GET /api/admin/schedules`
### `PUT /api/admin/schedules`
排班配置读取与保存。

### `GET /api/config/admin/schedules`
### `PUT /api/config/admin/schedules`
同上，为兼容入口。

### `GET /api/admin/support-rests`
### `PUT /api/admin/support-rests`
值班休息配置读取与保存。

### `GET /api/config/admin/support-rests`
### `PUT /api/config/admin/support-rests`
同上，为兼容入口。

### `GET /api/admin/data-fix-schemes`
### `PUT /api/admin/data-fix-schemes`
数据修正规则配置读取与保存。

### `GET /api/config/admin/data-fix-schemes`
### `PUT /api/config/admin/data-fix-schemes`
同上，为兼容入口。

### `GET /api/admin/dictionaries/insurance-types`
### `POST /api/admin/dictionaries/insurance-types`
保险字典项列表与新增。

### `PATCH /api/admin/dictionaries/insurance-types/:id`
启用/停用或更新保险字典项。

### `GET /api/config/admin/dictionaries/insurance-types`
### `POST /api/config/admin/dictionaries/insurance-types`
同上，为兼容入口。

### `PATCH /api/config/admin/dictionaries/insurance-types/:id`
同上，为兼容入口。

### `GET /api/config/data-fix-schemes`
获取前台数据修正规则配置。

### `GET /api/config/systems`
获取前台系统配置。

### `GET /api/config/dictionaries/options?type=XXX`
获取前台字典选项。

### `GET /api/config/support-assignees?role=L1|L2`
获取前台支持人列表。

### `GET /api/config/personal/quick-phrases`
### `PUT /api/config/personal/quick-phrases`
当前用户的快捷短语读取与保存。

### `GET /api/personal/quick-phrases`
### `PUT /api/personal/quick-phrases`
同上，为旧入口。

---

## 七、AI 与文本辅助

### `POST /api/ai/ticket-assistant`
工单智能问答，返回流式纯文本。

请求体：
```json
{ "ticket": {}, "messages": [] }
```

### `POST /api/submission/ai-assistant`
同上，为提交页兼容入口。

### `POST /api/ai/ticket-closure-summary`
生成工单办结总结，返回流式纯文本。

请求体：
```json
{ "ticket": {} }
```

### `POST /api/ai/mock-ticket-description`
生成模拟工单描述。

### `POST /api/submission/mock-description`
同上，为兼容入口。

---

## 八、上传

### `POST /api/uploads`
上传附件，`multipart/form-data`，字段名为 `file`。

返回：
```json
{ "ok": true, "file": { "uploadId": "upl_...", "url": "/api/uploads/upl_..." } }
```

### `GET /api/uploads/:id`
下载已上传文件。

---

## 九、补充说明

- 工单状态变更请统一走 `/api/workflow/tickets/:id/commands`、`/api/workflow/tickets/:id/dispatch`、`/api/submission/tickets`、`/api/tickets` 这些状态机入口
- 不要直接通过接口修改 `status`、`requesterStatus`、`supportStatus`、`processingSubStatus`
- 新增工单编辑能力时，应先补状态机事件，再接接口和界面
- `/api/config/**` 与 `/api/admin/**` 本质上是同一套配置能力的不同入口，前者主要用于前台页面

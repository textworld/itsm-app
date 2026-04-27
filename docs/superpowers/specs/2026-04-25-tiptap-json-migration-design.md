# Tiptap JSON 与本地文件上传迁移设计

**日期：** 2026-04-25  
**状态：** 已批准，可进入规划阶段  
**范围：** 将当前自研富文本编辑器替换为 Tiptap；将富文本持久化格式从 HTML 字符串切换为 Tiptap JSON 文档；将富文本图片与工单附件从 base64 存储切换为本地文件存储，并通过受保护接口访问。

## 目标

本次 demo 目标包含三部分：

1. 将当前基于 `contentEditable + execCommand` 的编辑器替换为 Tiptap
2. 让 Tiptap JSON 成为工单描述、描述历史、留言内容的主存储格式
3. 将富文本内嵌图片和工单附件统一切换为本地文件存储，支持：
   - 工具栏选择图片上传
   - `Ctrl+V` 粘贴图片上传
   - 已登录用户通过受保护接口预览和下载

## 为什么要做这次改造

当前编辑器实现位于 `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/RichTextEditor.jsx`，底层依赖 `contentEditable` 和 `document.execCommand`。这种实现方式存在几个问题：

- 编辑行为难以稳定控制
- 浏览器间一致性较差
- 扩展能力弱，后续维护成本高

当前项目的文件处理方式也存在明显问题：

- 富文本内嵌图片直接转成 base64 放入 HTML
- 工单附件同样以 base64 持久化
- 这会让工单 JSON 体积迅速膨胀
- 图片粘贴能力缺失，编辑体验不完整

这次 demo 的目标不只是替换编辑器界面，而是把“富文本模型 + 图片/附件存储模型”一起替换，形成一条完整的新链路。

## 当前状态

### 当前编辑器能力

现有编辑器支持以下功能：

- 加粗
- 斜体
- 下划线
- 正文 / 标题 / 引用
- 有序列表与无序列表
- 插入链接
- 上传本地图片并转为 base64 插入
- 撤销 / 重做
- 清除格式

### 当前富文本数据流

- 提交工单时写入 `descriptionHtml`，并派生纯文本 `description`
- 工单详情页预览直接渲染 HTML
- 描述历史中每个版本保存 HTML 和纯文本
- 留言区写入 `contentHtml`，并派生纯文本 `content`

### 当前文件数据流

- 附件通过 `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/fileUtils.js` 转成 base64
- 附件元数据直接保存在工单 JSON 中
- 附件列表通过 `attachment.base64` 直接预览和下载
- 富文本图片同样以内嵌 base64 形式存在 HTML 中

### 受影响入口

- `/Users/textzwb/Documents/itsm-app-nextjs/src/views/TicketSubmit/index.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/TicketDetail/RequesterActions.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/TicketDetail/DraftTicketEditButton.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/TicketDetail/MessageBoard.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/RichTextEditor.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/RichContentPreview.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/FileUploader.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/AttachmentList.jsx`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/richText.js`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/fileUtils.js`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/descriptionHistory.js`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/server/db.js`
- `/Users/textzwb/Documents/itsm-app-nextjs/src/server/store.js`
- `/Users/textzwb/Documents/itsm-app-nextjs/app/api/reset/route.js`

## 已批准方案

### 主存储格式

采用 Tiptap JSON 作为富文本主持久化格式。

新增主字段：

- `descriptionDoc`
- `contentDoc`

保留纯文本派生字段：

- `description`
- `content`

描述历史从 HTML 快照切换为 JSON 快照：

- `descriptionDoc`

### 文件存储策略

富文本图片与工单附件统一改为本地文件存储，不再把文件内容以 base64 放进工单 JSON。

存储约束如下：

- 文件落盘目录：`/Users/textzwb/Documents/itsm-app-nextjs/data/uploads`
- 文件真实内容保存在本地文件系统
- 文件元数据保存在服务端持久层
- 工单 JSON、留言 JSON、Tiptap 文档中只保存文件引用信息，不保存文件原始二进制内容

### 访问策略

上传后的文件统一通过受保护接口访问，不直接暴露静态目录。

采用以下约束：

- 访问地址形如 `/api/uploads/:id`
- 必须已登录才能预览或下载
- 访问接口负责读取本地文件并回写正确的响应头

### 回收策略

本次 demo 不做自动文件回收。

也就是说：

- 删除附件时不自动删除本地文件
- 从富文本中删除图片时不自动删除本地文件
- 仅在“重置数据”时统一清空上传目录与上传元数据

### 渲染策略

运行时将 Tiptap JSON 转换为 HTML 后再展示。界面层不直接渲染编辑器内部状态，而是通过预览组件完成显示。

对于图片：

- Tiptap image 节点中的 `src` 指向受保护文件地址
- 预览时直接渲染该受保护地址

### 编辑器策略

`RichTextEditor` 对外接口尽量保持稳定：

- 接收 `value`
- 通过 `onChange` 抛出变更
- 支持 `disabled`
- 支持 `placeholder`

内部实现切换为 Tiptap，并引入满足当前需求的最小扩展集合：

- `StarterKit`
- `Underline`
- `Link`
- `Image`
- `Placeholder`

同时新增图片输入能力：

- 工具栏选择本地图片并上传
- 监听粘贴事件，识别剪贴板中的图片文件并上传
- 上传成功后，将受保护访问 URL 插入 image 节点

## 数据模型调整

### 工单描述

替换：

- `descriptionHtml`

为：

- `descriptionDoc`

保留：

- `description`

### 留言内容

替换：

- `contentHtml`

为：

- `contentDoc`

保留：

- `content`

### 描述历史

替换：

- `descriptionHtml`

为：

- `descriptionDoc`

保留：

- `description`

### 附件模型

附件不再保存 `base64`，改为保存文件引用型元数据。

推荐结构：

- `id`
- `name`
- `type`
- `size`
- `uploadId`
- `url`
- `uploadedAt`
- `uploader`

其中：

- `uploadId` 是服务端文件记录的主键
- `url` 是受保护访问地址，例如 `/api/uploads/:id`

### 富文本图片节点

Tiptap 文档中的 image 节点至少应包含：

- `src`
- `alt`
- `title`
- `uploadId`

其中：

- `src` 为受保护访问地址
- `uploadId` 用于保留服务端文件记录标识，便于后续扩展

## 服务端设计

### 上传元数据持久化

新增上传文件元数据存储，用于把“文件 ID”映射到本地文件路径和 MIME 信息。

建议在 SQLite 中新增 `uploads` 表，保存：

- `id`
- `stored_name`
- `original_name`
- `mime_type`
- `size`
- `created_at`
- `uploader_id`
- `uploader_name`

### 本地文件落盘

上传文件保存到：

- `/Users/textzwb/Documents/itsm-app-nextjs/data/uploads`

实际文件名应与用户原始文件名解耦，避免冲突和路径污染。推荐使用：

- `uploadId + 扩展名`

### 上传接口

新增受保护上传接口，供富文本图片和工单附件统一使用。

职责：

- 校验登录态
- 接收 `multipart/form-data`
- 校验文件类型
- 保存文件到本地
- 写入上传元数据
- 返回上传结果，例如：
  - `uploadId`
  - `url`
  - `name`
  - `type`
  - `size`

### 下载 / 预览接口

新增受保护读取接口：

- `GET /api/uploads/:id`

职责：

- 校验登录态
- 根据 `uploadId` 查元数据
- 读取本地文件
- 返回正确的 `Content-Type`
- 支持浏览器直接预览图片
- 支持附件下载

### 重置接口

更新 `/Users/textzwb/Documents/itsm-app-nextjs/app/api/reset/route.js`。

重置时应同时：

- 清空业务表数据
- 清空上传元数据
- 删除 `/Users/textzwb/Documents/itsm-app-nextjs/data/uploads` 目录中的文件

这样可以保证 demo 每次 reset 后回到干净状态。

## 兼容策略

### 新数据写入

所有新的富文本写入统一保存为 Tiptap JSON 文档，并同步生成纯文本字段。

所有新附件与图片统一保存为本地文件引用。

### 旧 HTML 数据

第一阶段不单独写批量迁移脚本，而是采用运行时兼容：

- 如果 JSON 存在，则 JSON 为唯一可信源
- 如果只有旧 HTML，则在读取或编辑时尝试转换成 Tiptap JSON
- 如果转换失败，则保留旧 HTML 的只读展示能力

### 旧 base64 附件数据

旧数据中的 base64 附件和 base64 图片需要继续可展示：

- 附件列表仍兼容旧 `base64` 字段
- 富文本预览仍兼容旧 HTML 中的 base64 `<img>`
- 新数据不再写入 base64

这样旧数据可读，新数据走新模型。

### 归一化说明

旧 HTML 进入 Tiptap 后，不保证字节级回写一致。只要语义和展示结果一致，就视为可接受：

- 段落可能被重新包裹
- 列表结构可能被标准化
- 链接、图片属性可能被重排

本次 demo 优先保证“语义一致”，而不是“HTML 字符串完全一致”。

## 组件设计

### `RichTextEditor`

重写 `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/RichTextEditor.jsx`，底层切换为 Tiptap。

职责：

- 用 JSON 内容初始化编辑器
- 在必要时从旧 HTML 兜底初始化
- 对外输出 JSON 文档
- 保留当前工具栏能力
- 支持选择图片上传
- 支持粘贴图片上传
- 上传成功后插入受保护图片 URL

### `RichContentPreview`

更新 `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/RichContentPreview.jsx`，渲染优先级调整为：

1. 有 JSON 文档时优先渲染 JSON
2. JSON 不存在时回退到旧 HTML
3. 两者都没有时回退到纯文本

这个组件将成为新旧数据兼容的核心边界。

### `FileUploader`

更新 `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/FileUploader.jsx`。

职责从“只维护前端文件列表”调整为：

- 调用受保护上传接口
- 将返回的文件元数据写入 `fileList`
- 图片仍支持预览
- 非图片附件支持下载

### `AttachmentList`

更新 `/Users/textzwb/Documents/itsm-app-nextjs/src/components/common/AttachmentList.jsx`。

展示逻辑改为：

- 优先使用新模型中的 `url`
- 若存在旧数据，再回退到 `base64`
- 下载按钮和图片预览都走受保护 URL

### 富文本工具函数

扩展 `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/richText.js`，增加面向 JSON 的工具方法：

- 判断 JSON 文档是否为空
- JSON 转纯文本
- JSON 转 HTML
- 旧 HTML 转 JSON
- 判断传入数据是 JSON 还是旧 HTML

### 文件工具函数

重构 `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/fileUtils.js`。

保留必要的文件类型校验逻辑，但去掉“默认将文件转成 base64 持久化”的主路径，改为：

- 构造上传请求
- 规范化上传响应
- 将已存在附件映射回上传组件需要的 `fileList`

### 描述历史

更新 `/Users/textzwb/Documents/itsm-app-nextjs/src/utils/descriptionHistory.js`，让历史版本保存 `descriptionDoc`，并从 JSON 派生纯文本。现有 diff 逻辑继续保留为纯文本比对，不改算法。

## 行为要求

### 提交工单

提交工单时保存：

- `descriptionDoc`
- 派生的 `description`
- 新模型附件数组

同时必须继续遵守仓库规则：工单创建仍然必须通过状态机的 `SUBMIT` 事件完成。

### 草稿编辑

草稿编辑时保存：

- `descriptionDoc`
- 派生的 `description`
- 新模型附件数组

不引入任何绕过状态机的状态直接写入。

### 信息补充

提单人在信息补充阶段修改描述时：

- 更新 `descriptionDoc`
- 更新 `description`
- 把当前 JSON 快照追加到描述历史中
- 若插入了图片，则图片已先通过上传接口落到本地文件

### 留言区

发送留言时保存：

- `contentDoc`
- 派生的 `content`
- 附件数组

留言中的富文本图片也走同一条上传链路。

## 安全说明

切换到 Tiptap 可以减少对废弃浏览器编辑 API 的依赖，但这并不等于自动解决所有渲染安全问题。运行时 HTML 渲染仍然需要清晰边界。

本次 demo 的安全约束如下：

- 优先渲染由应用内部 Tiptap JSON 生成的 HTML
- 所有新上传文件必须走登录保护接口访问
- 不直接暴露本地上传目录为静态目录
- 旧 HTML 和旧 base64 仅作为向后兼容兜底

本次不额外扩展成独立的内容安全治理项目。

## 样式与展示

界面布局和工具栏体积尽量保持接近当前版本，让这次 demo 聚焦在“编辑器 + 存储模型 + 上传模型替换”，而不是引入额外视觉改版。

`/Users/textzwb/Documents/itsm-app-nextjs/src/index.css` 中现有富文本样式应迁移到 Tiptap 编辑区域和预览输出上，而不是整套推倒重写。

## 依赖

为 demo 引入最小 Tiptap 依赖集合：

- `@tiptap/react`
- `@tiptap/pm`
- `@tiptap/starter-kit`
- `@tiptap/extension-underline`
- `@tiptap/extension-link`
- `@tiptap/extension-image`
- `@tiptap/extension-placeholder`
- `@tiptap/html`

## 测试策略

### 工具层测试

新增或更新以下测试：

- JSON 判空
- JSON 转纯文本
- JSON 转 HTML
- HTML 转 JSON
- 新附件模型规范化

### 服务端测试

新增或更新以下测试：

- 上传接口要求登录
- 上传接口可保存文件并返回元数据
- 下载接口要求登录
- 下载接口能正确返回图片或附件
- reset 会清空上传元数据和上传目录

### 数据流测试

新增或更新以下测试：

- 工单提交后的富文本 JSON 持久化
- 草稿编辑后的富文本 JSON 持久化
- 描述历史保存 JSON 快照
- 留言保存 JSON 内容
- 工单附件不再写入 base64

### 富文本交互测试

新增或更新以下测试：

- 富文本工具栏上传图片后插入 image 节点
- 粘贴图片后触发上传并插入 image 节点

### 回归测试

需要验证以下兼容行为：

- 只有旧 HTML 的记录仍能正常展示
- 只有旧 HTML 的记录可以进入新编辑器并重新保存为 JSON
- 旧 base64 附件仍可展示
- 文本 diff 仍然正常，因为纯文本派生逻辑仍保留

### 现有核心测试

继续运行与状态机、接口、UI 相关的现有测试，确保这次迁移没有破坏工单流转和 session 行为。

## 不在本次范围内

以下内容明确不纳入本次 demo：

- 自动文件回收
- 生产级富文本安全治理重构
- 远程对象存储接入
- 全量历史 HTML / base64 数据的服务端批量迁移
- 协同编辑
- 基于富文本树结构的高级 diff

## 分阶段实施

### 第一阶段

引入 Tiptap 依赖与上传存储基础设施：

- Tiptap 相关依赖
- 上传元数据表
- 本地上传目录
- 上传 / 读取接口
- reset 清理逻辑

### 第二阶段

替换编辑器组件，并接入：

- 提交工单
- 草稿编辑
- 信息补充
- 留言区

同时打通：

- 工具栏图片上传
- `Ctrl+V` 图片粘贴上传

### 第三阶段

更新预览、附件列表、历史渲染逻辑，优先使用 JSON 和受保护 URL，必要时回退到旧 HTML / base64。

### 第四阶段

补齐兼容与回归测试，并执行聚焦验证。

## 验收标准

满足以下条件时，本次 demo 视为完成：

- 自研 `execCommand` 编辑器已不再使用
- 新工单描述保存为 Tiptap JSON
- 新留言内容保存为 Tiptap JSON
- 描述历史保存为 JSON 快照
- 富文本图片和工单附件不再以 base64 持久化
- 新上传文件落到 `data/uploads`
- 新上传文件只能通过受保护接口访问
- `Ctrl+V` 粘贴图片可以上传并插入编辑器
- 旧 HTML 内容仍可展示
- 旧 base64 附件仍可展示
- 纯文本摘要与 diff 能继续工作
- reset 能清空上传文件和上传元数据
- 没有任何工单状态变更绕过状态机

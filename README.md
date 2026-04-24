# ITSM 工单系统原型 (itsm-app-proto)

一个基于 **React 18 + Ant Design 5 + Vite + React Router 6** 的 ITSM 工单管理系统前端原型，
完整还原提单人、一线技术支持、二线运维 3 类角色的工单流转闭环，支持：

- 工单提交 / 受理 / 打标缺陷 / 关联缺陷 / 二线排查 / 一线复核 / 提单人验证 / 满意度评价 全流程
- 基于状态机 (`src/state-machine/ticketStateMachine.js`) 的规则驱动流转
- `localStorage` 持久化 + "初始化数据" / "导出数据" 能力
- 角色感知的菜单、列表视图、操作按钮权限

## 一、启动方式

```bash
npm install
npm start          # 启动开发服务器
# 默认地址：http://localhost:5173/itsm-app-proto/
```

生产构建：

```bash
npm run build
npm run preview
```

> `vite.config.js` 中已配置 `base: '/itsm-app-proto/'`，打包后资源均挂载在此前缀下。
> `src/App.jsx` 的 BrowserRouter 也使用了相同的 `basename`。

## 二、测试账号（密码均为 `123456`）

| 角色 | 账号 | 说明 |
| --- | --- | --- |
| 提单人 | `test_user` | 可提交/查看自己工单/验证/评价 |
| 一线技术支持 | `support1` | 受理/打标/关联缺陷/复核/同步语料库 |
| 二线运维 | `ops1` | 接收缺陷类工单并输出排查结论 |

登录页已提供"一键填充"按钮，可快速切换账号体验。

## 三、目录结构

```text
src/
├── main.jsx                         # 入口，ConfigProvider(zh_CN)
├── App.jsx                          # BrowserRouter + 两个 Provider
├── index.css
├── router/index.jsx                 # 路由 + RequireAuth 守卫
├── context/
│   ├── AuthContext.jsx              # 当前登录用户
│   └── TicketContext.jsx            # 工单/缺陷 CRUD + 自动持久化 + 事件分发
├── constants/
│   ├── roles.js                     # REQUESTER / L1 / L2
│   ├── ticketStatus.js              # 6 状态枚举 + 中文 + 颜色
│   └── toolTypes.js                 # 权限申请 / 数据提取 / 其他
├── state-machine/
│   └── ticketStateMachine.js        # 状态、事件、转移表、canTransition、applyTransition
├── mock/
│   ├── initialTickets.json          # 初始 4 条不同状态工单
│   ├── initialUsers.json            # 3 个测试账号
│   └── initialDefects.json          # 项目管理系统缺陷池
├── utils/
│   ├── storage.js                   # localStorage 封装 + bootstrap/reset/export
│   ├── idGenerator.js               # 工单号 TKT-YYYYMMDD-xxxx + 短 id
│   ├── summaryGenerator.js          # 自动生成工单总结
│   ├── fileUtils.js                 # 附件转 base64 / 类型校验
│   └── format.js                    # 日期、排序工具
├── components/
│   ├── Layout/AppLayout.jsx         # Sider + Header + Content 三栏布局
│   ├── TicketList/
│   │   ├── TicketTable.jsx          # 通用表格
│   │   └── DataActionBar.jsx        # 初始化/导出 按钮组
│   ├── TicketDetail/
│   │   ├── TicketInfoCard.jsx       # 基本信息 + 轨迹 + 摘要
│   │   ├── MessageBoard.jsx         # 留言区(倒序+附件)
│   │   ├── RequesterActions.jsx     # 提单人: 验证是/否 + 满意度
│   │   ├── L1Actions.jsx            # 一线: 受理/打标/关联/总结/同步/复核
│   │   ├── L2Actions.jsx            # 二线: 排查结论/提交
│   │   ├── DefectTagModal.jsx       # 打标弹窗
│   │   ├── LinkDefectPanel.jsx      # 关联/创建缺陷
│   │   └── SatisfactionModal.jsx    # 1-5 星满意度
│   └── common/
│       ├── StatusTag.jsx            # 状态彩色 Tag
│       ├── FileUploader.jsx         # Upload 封装
│       └── AttachmentList.jsx       # 已有附件列表(支持下载)
└── pages/
    ├── Login/index.jsx              # 登录页
    ├── TicketSubmit/index.jsx       # 工单提交
    ├── TicketList/index.jsx         # 工单列表(按角色渲染)
    ├── TicketDetail/index.jsx       # 工单处理页
    ├── StateMachine/index.jsx       # 工单流转规则可视化
    └── NotFound.jsx
```

## 四、工单流转状态机

状态列表(`STATUS`)：

| Key | 中文 | 角色观感 |
| --- | --- | --- |
| `PENDING` | 待受理 | 一线可见、可受理 |
| `PROCESSING` | 处理中 | 一线处理中 |
| `INVESTIGATING` | 待排查 | 二线排查中 |
| `REVIEWING` | 待复核 | 一线复核/总结 |
| `VERIFYING` | 待验证 | 提单人验证中 |
| `CLOSED` | 已办结 | 终态，含满意度 |

转移规则(TRANSITIONS)：

| 从状态 | 事件 | 角色 | 目标状态 | 前置条件(guard) |
| --- | --- | --- | --- | --- |
| (创建) | `SUBMIT` | 提单人 | `PENDING` | - |
| `PENDING` | `ACCEPT` | 一线 | `PROCESSING` | - |
| `PROCESSING` | `TAG_DEFECT_AND_LINK` | 一线 | `INVESTIGATING` | 已打标 + 已关联缺陷 |
| `INVESTIGATING` | `SUBMIT_CONCLUSION` | 二线 | `REVIEWING` | 需填写排查结论 |
| `REVIEWING` | `SUBMIT_REVIEW` | 一线 | `VERIFYING` | 总结非空 + 已同步语料库 |
| `VERIFYING` | `VERIFY_YES` | 提单人 | `CLOSED` | - (配套收集满意度) |
| `VERIFYING` | `VERIFY_NO` | 提单人 | `PROCESSING` | 需填写驳回原因 |

```text
(创建) → 待受理 → 处理中 → 待排查 → 待复核 → 待验证 → 已办结
                               ↑                 │
                               └── 驳回 ←────────┘
```

> 所有流转都通过 `canTransition` / `applyTransition` 两个纯函数完成，
> 保证 UI 按钮与业务规则始终一致，且每次流转自动写入 `timeline` 与 `updatedAt`。

## 五、数据操作

- **初始化数据**：工单列表页顶部/底部均有按钮，点击后会用 `src/mock/initialTickets.json` 与 `src/mock/initialDefects.json` 覆盖 localStorage。
- **导出数据**：点击后将当前 localStorage 中的工单序列化为 JSON 下载（文件名：`itsm-tickets-YYYYMMDD-HHmmss.json`）。
- **首次加载**：若 localStorage 中不存在对应 key，会自动用 mock 数据回填。

## 六、核心交互说明

1. 提单人提交工单 → 状态 `PENDING` → 一线可见。
2. 一线登录 `support1`：
   - 对 `PENDING` 工单点「受理」 → `PROCESSING`。
   - 在「处理中」: 打标为缺陷 + 关联缺陷(或创建新缺陷) → 「流转至二线排查」 → `INVESTIGATING`。
   - 非缺陷类也支持 「直接进入待复核」 快捷操作。
3. 二线登录 `ops1`：对 `INVESTIGATING` 工单填写排查结论 → `REVIEWING`。
4. 一线在 `REVIEWING`：点击「生成工单总结」→ 可修改 → 「同步语料库」 → 「提交复核」→ `VERIFYING`。
5. 提单人在 `VERIFYING`：
   - 「验证解决(是)」 → 弹出满意度评价 → `CLOSED`。
   - 「验证未解决(否)」 → 强制填写驳回原因 → 回到 `PROCESSING`，一线继续处理。

所有角色均可在任意状态下于「留言区」互动（文本 + PDF/图片 附件）。

## 七、技术细节

- Ant Design `App` 组件提供静态 `message` API（`AntdApp.useApp()`）。
- 附件通过 `FileReader.readAsDataURL` 转为 base64 直接入库，便于 localStorage 持久化与回显下载。
- 菜单 / 列表 / 操作按钮 均基于 `user.role` 动态渲染，未登录自动跳转 `/login`。

## 八、License

仅用于原型演示与学习。

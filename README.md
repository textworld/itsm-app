# ITSM 工单系统 (itsm-app-nextjs)

一个基于 **Next.js + React 18 + Ant Design 5 + SQLite** 的 ITSM 工单管理系统，
完整还原提单人、一线技术支持、二线运维 3 类角色的工单流转闭环，支持：

- 工单提交 / 受理 / 打标缺陷 / 关联缺陷 / 二线排查 / 一线复核 / 提单人验证 / 满意度评价 全流程
- 信息补充阶段支持修改工单描述，并保留历史版本与版本差异对比
- 未受理工单支持提单人撤回至草稿箱
- 基于状态机 (`src/state-machine/ticketStateMachine.js`) 的规则驱动流转
- SQLite 持久化 + "初始化数据" / "导出数据" 能力
- 角色感知的菜单、列表视图、操作按钮权限

## 一、启动方式

```bash
pnpm install
pnpm dev
# 默认地址：http://localhost:3000
```

生产构建：

```bash
pnpm build
pnpm start
```

大模型智能解答需要在本地 `.env` 或部署环境中配置：

```bash
OPENAI_API_KEY=你的服务端密钥
OPENAI_BASE_URL=https://api.codexzh.com/v1
OPENAI_MODEL=gpt-5.4
```

> 首次启动时会自动初始化 `data/itsm.sqlite`，并将 `src/mock` 下的初始用户、工单、缺陷写入数据库。

## 二、测试账号（密码均为 `123456`）

| 角色 | 账号 | 说明 |
| --- | --- | --- |
| 提单人 | `test_user` | 可提交/查看自己工单/验证/评价 |
| 一线技术支持 | `support1` | 受理/打标/关联缺陷/复核/同步语料库 |
| 二线运维 | `ops1` | 接收缺陷类工单并输出排查结论 |

登录页已提供"一键填充"按钮，可快速切换账号体验。

## 三、目录结构

```text
app/
├── (protected)/                    # 受保护页面
├── api/                            # Next Route Handlers
├── layout.jsx                      # 根布局
└── page.jsx                        # 首页重定向到 /tickets
data/
└── itsm.sqlite                     # 运行期 SQLite 数据库
src/
├── index.css
├── context/
│   ├── AuthContext.jsx              # Cookie 会话 + 当前登录用户
│   └── TicketContext.jsx            # 工单/缺陷 CRUD + API 调用
├── constants/
│   ├── roles.js                     # REQUESTER / L1 / L2
│   ├── ticketStatus.js              # 6 状态枚举 + 中文 + 颜色
│   └── toolTypes.js                 # 权限申请 / 数据提取 / 其他
├── server/
│   ├── db.js                        # SQLite 初始化 / 建表 / seed
│   ├── store.js                     # 数据读写仓储
│   └── session.js                   # 登录 Cookie 会话
├── state-machine/
│   └── ticketStateMachine.js        # 状态、事件、转移表、canTransition、applyTransition
├── mock/
│   ├── initialTickets.json          # 初始 4 条不同状态工单
│   ├── initialUsers.json            # 3 个测试账号
│   └── initialDefects.json          # 项目管理系统缺陷池
├── utils/
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
└── views/
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
| `DRAFT` | 草稿 | 提单人撤回后保存在草稿箱 |
| `PENDING` | 待受理 | 一线可见、可受理 |
| `PROCESSING` | 处理中 | 一线处理中 |
| `INVESTIGATING` | 待排查 | 二线排查中 |
| `REVIEWING` | 待复核 | 一线复核/总结 |
| `VERIFYING` | 待验证 | 提单人验证中 |
| `CLOSED` | 已办结 | 终态，含满意度 |

转移规则(TRANSITIONS)：

| 从状态 | 事件 | 角色 | 目标状态 | 前置条件(guard) |
| --- | --- | --- | --- | --- |
| (创建) | `CREATE_DRAFT` | 提单人 | `DRAFT` | 提交后先进入智能解答 |
| `DRAFT` | `AI_RESOLVE` | 提单人 | `CLOSED` | 用户确认大模型已解决 |
| `DRAFT` | `SUBMIT` | 提单人 | `PENDING` | 用户选择人工处理 |
| `PENDING` | `WITHDRAW` | 提单人 | `DRAFT` | - |
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

- **初始化数据**：工单列表页顶部/底部均有按钮，点击后会用 `src/mock/initialTickets.json` 与 `src/mock/initialDefects.json` 重置 SQLite。
- **导出数据**：点击后将当前 SQLite 中的工单序列化为 JSON 下载（文件名：`itsm-tickets-YYYYMMDD-HHmmss.json`）。
- **首次加载**：若数据库为空，会自动用 mock 数据回填。

## 六、核心交互说明

1. 提单人提交工单 → 先保存为 `DRAFT` 并弹出大模型解答抽屉；点击「问题已解决」→ `CLOSED`，点击「人工处理」→ `PENDING`。
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
- 附件通过 `FileReader.readAsDataURL` 转为 base64，最终存入 SQLite，便于回显下载。
- 登录通过 Next Route Handler 校验测试账号，并使用 HttpOnly Cookie 维持会话。
- 菜单 / 列表 / 操作按钮 均基于 `user.role` 动态渲染，未登录自动跳转 `/login`。

## 八、生产服务器部署

以下示例以 Linux 服务器为例，使用 `pnpm build` 生成 Next.js 生产构建，并通过 PM2 常驻运行。项目使用 SQLite，运行期数据默认写入项目根目录下的 `data/itsm.sqlite` 和 `data/uploads/`，生产环境必须持久化并备份该目录。

### 1. 服务器环境准备

建议使用 Node.js 20 LTS 或 22 LTS。项目依赖 `better-sqlite3`，需要 native 模块支持；不要使用过新的非 LTS Node 版本部署。

```bash
# 安装 Node.js 后启用 pnpm
corepack enable
corepack prepare pnpm@10.27.0 --activate

# 可选：安装 PM2
pnpm add -g pm2
```

如果服务器需要从源码编译 `better-sqlite3`，还需要安装编译工具：

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y build-essential python3 make g++
```

### 2. 上传代码并安装依赖

```bash
cd /opt
git clone <你的仓库地址> itsm-app-nextjs
cd /opt/itsm-app-nextjs

pnpm install --frozen-lockfile
```

如果不是通过 Git 发布，也可以将项目目录上传到服务器，但需要包含 `package.json`、`pnpm-lock.yaml`、`app/`、`src/`、`public/`（如存在）、`next.config.mjs` 等源码和配置文件。

### 3. 配置环境变量

在项目根目录创建 `.env.production`：

```bash
OPENAI_API_KEY=你的服务端密钥
OPENAI_BASE_URL=https://api.codexzh.com/v1
OPENAI_MODEL=gpt-5.4
```

如果暂时不使用大模型能力，可以不配置 `OPENAI_API_KEY`，但访问智能解答接口时会返回未配置提示。

### 4. 构建生产产物

```bash
pnpm build
```

构建成功后会生成 `.next/` 目录。生产启动命令：

```bash
pnpm start
```

默认监听 `3000` 端口。如需指定端口：

```bash
PORT=3001 pnpm start
```

### 5. 使用 PM2 常驻运行

```bash
cd /opt/itsm-app-nextjs

pm2 start pnpm --name itsm-app-nextjs -- start
pm2 save
pm2 startup
```

如果需要指定端口：

```bash
PORT=3001 pm2 start pnpm --name itsm-app-nextjs -- start
```

常用运维命令：

```bash
pm2 status
pm2 logs itsm-app-nextjs
pm2 restart itsm-app-nextjs
pm2 stop itsm-app-nextjs
```

### 6. 配置 Nginx 反向代理

示例配置：

```nginx
server {
    listen 80;
    server_name your-domain.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

启用配置后检查并重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

生产环境建议再使用 Certbot 或云厂商证书配置 HTTPS。

### 7. 数据持久化与备份

生产数据位于：

```text
data/itsm.sqlite
data/itsm.sqlite-wal
data/itsm.sqlite-shm
data/uploads/
```

部署新版本时不要删除 `data/` 目录。建议定时备份整个 `data/` 目录：

```bash
mkdir -p /opt/backups/itsm
tar -czf /opt/backups/itsm/data-$(date +%Y%m%d-%H%M%S).tar.gz -C /opt/itsm-app-nextjs data
```

如果使用容器、CI/CD 或重新拉取代码发布，请将 `data/` 挂载到独立磁盘或宿主机目录，避免发布时覆盖数据库和附件。

### 8. 更新发布流程

```bash
cd /opt/itsm-app-nextjs
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart itsm-app-nextjs
```

更新前建议先备份 `data/` 目录；如果依赖版本发生变化，确认 `pnpm install` 没有 native 模块编译失败。

## 九、License

仅用于原型演示与学习。


固定方案编码
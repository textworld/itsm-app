# Ticket Submit Reference Layout Design

**Goal**
- Rework the ticket submission page so it matches the provided reference layout and supports the requested business fields.

**Visual Direction**
- Use a plain enterprise form layout instead of card-style grouping.
- Keep horizontal label/value alignment, subtle borders, wide whitespace, and a large rich text description area.
- Preserve the reference image feel while adapting the right-side fields to the requested business inputs.

**Requested Fields**
- Ticket type: 4 fixed choices
  - 生产系统数据提取
  - 生产系统数据修正
  - 账号及权限申请
  - 应用系统常规咨询
- 标题
- 优先级
- 系统名称（可搜索下拉，先用 mock 数据）
- 手机号码
- 邮箱（非必填）
- 是否替他人上报
  - if yes: 上报人姓名、上报人手机号码
- 描述（富文本，支持图片插入）
- 附件（支持多文件与常见办公文件类型）

**Implementation Strategy**
- Keep `src/pages/TicketSubmit/index.jsx` as the main form container.
- Add focused constants for priorities and mocked system options.
- Replace the plain textarea with a lightweight in-repo rich text editor component based on `contentEditable`, avoiding new package installation.
- Expand upload validation so the attachment area accepts common office file types.
- Update ticket detail rendering so the new metadata and rich text description can be viewed after submission.

**Data Handling**
- Store rich text description as HTML.
- Keep attachments stored in the existing base64-based local storage structure.
- Add new ticket fields for priority, system name, contact details, and delegated reporting.

**Validation**
- Required: ticket type, title, priority, system name, mobile phone, description
- Optional with format validation: email
- Conditional required: reported person name and phone when reporting for others


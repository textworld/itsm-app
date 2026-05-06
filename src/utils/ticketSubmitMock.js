export function buildMockTicketFormValues() {
  return {
    title: '【模拟】ERP 订单状态批量修正申请',
    reporterPhone: '13800138000',
    reporterEmail: 'mock.requester@example.com',
    reportForOthers: true,
    reportedUserName: '王五',
    reportedUserPhone: '13900139000',
    descriptionDoc: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '模拟工单问题描述' }]
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'ERP 核心系统中部分订单在夜间批处理后状态未同步，影响业务侧对账和后续发货。'
            }
          ]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '复现步骤：查询订单列表，筛选状态为“待同步”，可看到多笔订单停留在旧状态。' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '期望处理：请协助核查批处理结果，并将受影响订单状态修正为最新状态。' }]
        }
      ]
    }
  };
}

export function buildMockTicketDescriptionDoc(description) {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    type: 'doc',
    content: (lines.length ? lines : ['请描述模拟工单的问题现象、影响范围、复现步骤和期望处理结果。']).map((line) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: line }]
    }))
  };
}

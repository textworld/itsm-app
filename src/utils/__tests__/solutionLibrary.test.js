import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SOLUTION_EDIT_PERMISSION,
  SOLUTION_REFERENCE_PERMISSION,
  buildSolutionSnapshot,
  canReferenceSolution,
  filterSolutions,
  mapSolutionToExportRow,
  parseSolutionImportRow,
  validateSolutionInput
} from '../solutionLibrary.js';

const context = {
  systems: [
    { code: 'ERP_CORE', name: 'ERP 核心系统' },
    { code: 'CRM', name: '客户中心' }
  ],
  insuranceTypes: [
    { id: 'ins_life', code: 'LIFE', name: '寿险' },
    { id: 'ins_auto', code: 'AUTO', name: '车险' }
  ],
  problemTypes: [
    { id: 'module_policy', code: 'POLICY', name: '保单模块' },
    { id: 'module_claim', code: 'CLAIM', name: '理赔模块' }
  ]
};

const validInput = {
  code: ' sol-001 ',
  title: '保单状态修正方案',
  description: '处理保单状态异常',
  detailHtml: '<p>修正保单状态</p>',
  insuranceTypeIds: ['ins_life'],
  systemCodes: ['erp_core'],
  problemTypeIds: ['module_policy'],
  ticketTypes: ['INCIDENT'],
  relatedInternalSchemeIds: ['scheme_001'],
  thirdPartyDataFixScheme: {
    id: 'tp_dfs_policy_refresh',
    code: 'TP-DFS-001',
    title: '第三方保单缓存刷新',
    sourceSystem: '第三方数据平台',
    description: '同步保单状态并刷新缓存'
  },
  editPermission: SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS,
  teamRoles: ['L1', 'L2'],
  referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
  groupRoles: ['L2']
};

test('validateSolutionInput normalizes core fields and rich text', () => {
  const result = validateSolutionInput(validInput, context);

  assert.equal(result.ok, true);
  assert.equal(result.value.code, 'SOL-001');
  assert.equal(result.value.title, '保单状态修正方案');
  assert.equal(result.value.description, '处理保单状态异常');
  assert.equal(result.value.detailHtml, '<p>修正保单状态</p>');
  assert.equal(result.value.detailText, '修正保单状态');
  assert.deepEqual(result.value.insuranceTypeIds, ['ins_life']);
  assert.deepEqual(result.value.systemCodes, ['ERP_CORE']);
  assert.deepEqual(result.value.problemTypeIds, ['module_policy']);
  assert.deepEqual(result.value.thirdPartyDataFixScheme, {
    id: 'tp_dfs_policy_refresh',
    code: 'TP-DFS-001',
    title: '第三方保单缓存刷新',
    sourceSystem: '第三方数据平台',
    description: '同步保单状态并刷新缓存'
  });
  assert.equal(result.value.enabled, true);
  assert.deepEqual(result.value.permissions, {
    editPermission: SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS,
    teamRoles: ['L1', 'L2'],
    referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
    groupRoles: ['L2']
  });
});

test('validateSolutionInput accepts empty third-party data-fix association', () => {
  const result = validateSolutionInput({
    ...validInput,
    thirdPartyDataFixScheme: ''
  }, context);

  assert.equal(result.ok, true);
  assert.equal(result.value.thirdPartyDataFixScheme, null);
});

test('validateSolutionInput rejects missing code title description and detail', () => {
  const result = validateSolutionInput(
    {
      code: ' ',
      title: '',
      description: '',
      detailHtml: '<p> </p>'
    },
    context
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((item) => item.message), [
    '请输入方案编码',
    '请输入方案标题',
    '请输入方案描述',
    '请输入详细说明'
  ]);
});

test('validateSolutionInput deduplicates arrays after normalization', () => {
  const result = validateSolutionInput(
    {
      ...validInput,
      systemCodes: ['crm', 'CRM', ' erp_core ', 'ERP_CORE'],
      ticketTypes: ['incident', 'INCIDENT', ' request ', 'REQUEST']
    },
    context
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value.systemCodes, ['CRM', 'ERP_CORE']);
  assert.deepEqual(result.value.ticketTypes, ['INCIDENT', 'REQUEST']);
});

test('validateSolutionInput rejects unknown classifications when supplied context lists are empty', () => {
  const result = validateSolutionInput(
    {
      ...validInput,
      insuranceTypeIds: ['ins_unknown'],
      systemCodes: ['unknown_system'],
      problemTypeIds: ['problem_unknown']
    },
    { systems: [], insuranceTypes: [], problemTypes: [] }
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors.map((item) => item.message), [
    '业务系统不存在',
    '适用险种不存在',
    '问题类型不存在'
  ]);
});

test('canReferenceSolution allows company-wide L1 and L2 only when enabled', () => {
  const solution = {
    enabled: true,
    permissions: { referencePermission: SOLUTION_REFERENCE_PERMISSION.COMPANY }
  };

  assert.equal(canReferenceSolution(solution, { role: 'L1' }), true);
  assert.equal(canReferenceSolution(solution, { role: 'L2' }), true);
  assert.equal(canReferenceSolution(solution, { role: 'REQUESTER' }), false);
  assert.equal(canReferenceSolution({ ...solution, enabled: false }, { role: 'L1' }), false);
});

test('canReferenceSolution honors assigned group roles', () => {
  const solution = {
    enabled: true,
    permissions: {
      referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
      groupRoles: ['L2']
    }
  };

  assert.equal(canReferenceSolution(solution, { role: 'L2' }), true);
  assert.equal(canReferenceSolution(solution, { role: 'L1' }), false);
});

test('filterSolutions searches keyword and classification dimensions', () => {
  const rows = [
    {
      id: 's1',
      code: 'SOL-001',
      title: '保单状态修正方案',
      description: '处理保单状态异常',
      detailText: '修正保单状态',
      enabled: true,
      insuranceTypeIds: ['ins_life'],
      systemCodes: ['ERP_CORE'],
      problemTypeIds: ['module_policy'],
      ticketTypes: ['INCIDENT']
    },
    {
      id: 's2',
      code: 'SOL-002',
      title: '理赔重推方案',
      description: '处理理赔回调失败',
      detailText: '重新推送理赔结果',
      enabled: false,
      insuranceTypeIds: ['ins_auto'],
      systemCodes: ['CRM'],
      problemTypeIds: ['module_claim'],
      ticketTypes: ['REQUEST']
    }
  ];

  assert.deepEqual(filterSolutions(rows, { keyword: '修正保单' }).map((item) => item.id), ['s1']);
  assert.deepEqual(filterSolutions(rows, { enabled: true }).map((item) => item.id), ['s1']);
  assert.deepEqual(filterSolutions(rows, { insuranceTypeId: 'ins_auto' }).map((item) => item.id), ['s2']);
  assert.deepEqual(filterSolutions(rows, { systemCode: 'erp_core' }).map((item) => item.id), ['s1']);
  assert.deepEqual(filterSolutions(rows, { problemTypeId: 'module_claim' }).map((item) => item.id), ['s2']);
  assert.deepEqual(filterSolutions(rows, { ticketType: 'INCIDENT' }).map((item) => item.id), ['s1']);
});

test('buildSolutionSnapshot preserves versioned display content', () => {
  const solution = {
    id: 'solution_1',
    code: 'SOL-001',
    title: '保单状态修正方案',
    versionNo: 3,
    enabled: true,
    description: '处理保单状态异常',
    detailHtml: '<p>修正保单状态</p>',
    detailText: '修正保单状态',
    insuranceTypeIds: ['ins_life'],
    relatedInternalSchemeIds: ['scheme_001'],
    ticketTypes: ['INCIDENT'],
    systemCodes: ['ERP_CORE'],
    problemTypeIds: ['module_policy'],
    thirdPartyDataFixScheme: {
      id: 'tp_dfs_policy_refresh',
      code: 'TP-DFS-001',
      title: '第三方保单缓存刷新',
      sourceSystem: '第三方数据平台',
      description: '同步保单状态并刷新缓存'
    },
    permissions: {
      editPermission: SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS,
      teamRoles: ['L1'],
      referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
      groupRoles: ['L2']
    },
    stats: {
      referenceCount: 2,
      lastReferencedAt: '2026-06-10T10:00:00.000Z',
      byChannel: { MESSAGE_REPLY: 2 }
    }
  };

  const snapshot = buildSolutionSnapshot(solution);

  solution.insuranceTypeIds.push('ins_auto');
  solution.permissions.teamRoles.push('L2');
  solution.thirdPartyDataFixScheme.title = '已改名第三方方案';
  solution.stats.referenceCount = 99;
  solution.stats.byChannel.MESSAGE_REPLY = 99;

  assert.deepEqual(snapshot, {
    id: 'solution_1',
    code: 'SOL-001',
    title: '保单状态修正方案',
    versionNo: 3,
    enabled: true,
    description: '处理保单状态异常',
    detailHtml: '<p>修正保单状态</p>',
    detailText: '修正保单状态',
    classification: {
      insuranceTypeIds: ['ins_life'],
      relatedInternalSchemeIds: ['scheme_001'],
      ticketTypes: ['INCIDENT'],
      systemCodes: ['ERP_CORE'],
      problemTypeIds: ['module_policy']
    },
    thirdPartyDataFixScheme: {
      id: 'tp_dfs_policy_refresh',
      code: 'TP-DFS-001',
      title: '第三方保单缓存刷新',
      sourceSystem: '第三方数据平台',
      description: '同步保单状态并刷新缓存'
    },
    permissions: {
      editPermission: SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS,
      teamRoles: ['L1'],
      referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
      groupRoles: ['L2']
    },
    stats: {
      referenceCount: 2,
      lastReferencedAt: '2026-06-10T10:00:00.000Z',
      byChannel: { MESSAGE_REPLY: 2 }
    }
  });
});

test('mapSolutionToExportRow and parseSolutionImportRow round-trip display values', () => {
  const solution = validateSolutionInput(validInput, context).value;
  const row = mapSolutionToExportRow(solution, context);

  assert.deepEqual(row, {
    方案编码: 'SOL-001',
    方案标题: '保单状态修正方案',
    方案描述: '处理保单状态异常',
    详细说明: '修正保单状态',
    启用状态: '启用',
    适用险种: '寿险',
    关联内部方案: 'scheme_001',
    关联第三方数据修正方案: 'TP-DFS-001 第三方保单缓存刷新',
    工单类型: 'INCIDENT',
    业务系统: 'ERP 核心系统',
    问题类型: '保单模块',
    编辑权限: 'ASSIGNED_TEAMS',
    编辑团队: 'L1、L2',
    引用权限: 'ASSIGNED_GROUPS',
    引用处理组: 'L2'
  });

  const parsed = parseSolutionImportRow(
    {
      ...row,
      适用险种: '寿险、AUTO',
      业务系统: 'ERP 核心系统、CRM',
      问题类型: '保单模块、CLAIM'
    },
    context
  );

  assert.deepEqual(parsed, {
    code: 'SOL-001',
    title: '保单状态修正方案',
    description: '处理保单状态异常',
    detail: '修正保单状态',
    enabled: true,
    insuranceTypeIds: ['ins_life', 'ins_auto'],
    relatedInternalSchemeIds: ['scheme_001'],
    thirdPartyDataFixScheme: {
      id: '',
      code: 'TP-DFS-001',
      title: '第三方保单缓存刷新',
      sourceSystem: '',
      description: ''
    },
    ticketTypes: ['INCIDENT'],
    systemCodes: ['ERP_CORE', 'CRM'],
    problemTypeIds: ['module_policy', 'module_claim'],
    editPermission: SOLUTION_EDIT_PERMISSION.ASSIGNED_TEAMS,
    teamRoles: ['L1', 'L2'],
    referencePermission: SOLUTION_REFERENCE_PERMISSION.ASSIGNED_GROUPS,
    groupRoles: ['L2']
  });
});

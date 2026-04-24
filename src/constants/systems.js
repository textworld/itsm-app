export const SYSTEM_OPTIONS = [
  { value: 'ERP_CORE', label: 'ERP 核心系统' },
  { value: 'MES_PORTAL', label: 'MES 制造执行平台' },
  { value: 'CRM_CENTER', label: 'CRM 客户管理系统' },
  { value: 'FINANCE_BI', label: '财务 BI 报表平台' },
  { value: 'OA_CENTER', label: 'OA 协同办公系统' },
  { value: 'HR_MASTER', label: 'HR 人员主数据平台' },
  { value: 'SUPPLY_CHAIN', label: '供应链协同平台' },
  { value: 'OPS_MONITOR', label: '运维监控中心' }
];

export const SYSTEM_LABELS = SYSTEM_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

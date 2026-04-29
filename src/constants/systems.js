export const SYSTEM_CATEGORY = {
  OLD: 'OLD',
  NEW: 'NEW'
};

export const SYSTEM_CATEGORY_OPTIONS = [
  { value: SYSTEM_CATEGORY.OLD, label: '老系统' },
  { value: SYSTEM_CATEGORY.NEW, label: '新系统' }
];

export const SYSTEM_OPTIONS = [
  { value: 'ERP_CORE', label: 'ERP 核心系统', category: SYSTEM_CATEGORY.OLD },
  { value: 'MES_PORTAL', label: 'MES 制造执行平台', category: SYSTEM_CATEGORY.NEW },
  { value: 'CRM_CENTER', label: 'CRM 客户管理系统', category: SYSTEM_CATEGORY.NEW },
  { value: 'FINANCE_BI', label: '财务 BI 报表平台', category: SYSTEM_CATEGORY.OLD },
  { value: 'OA_CENTER', label: 'OA 协同办公系统', category: SYSTEM_CATEGORY.OLD },
  { value: 'HR_MASTER', label: 'HR 人员主数据平台', category: SYSTEM_CATEGORY.OLD },
  { value: 'SUPPLY_CHAIN', label: '供应链协同平台', category: SYSTEM_CATEGORY.OLD },
  { value: 'OPS_MONITOR', label: '运维监控中心', category: SYSTEM_CATEGORY.NEW }
];

export const SYSTEM_LABELS = SYSTEM_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export const SYSTEM_CATEGORY_LABELS = SYSTEM_CATEGORY_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export function getSystemOptionsByCategory(category) {
  return SYSTEM_OPTIONS.filter((option) => option.category === category);
}

export function getSystemCategoryByCode(systemCode) {
  return SYSTEM_OPTIONS.find((option) => option.value === systemCode)?.category || SYSTEM_CATEGORY.OLD;
}

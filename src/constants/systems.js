export const SYSTEM_CATEGORY = {
  OLD: 'OLD',
  NEW: 'NEW'
};

export const SYSTEM_CATEGORY_OPTIONS = [
  { value: SYSTEM_CATEGORY.OLD, label: '老系统' },
  { value: SYSTEM_CATEGORY.NEW, label: '新系统' }
];

export const SYSTEM_CATEGORY_LABELS = SYSTEM_CATEGORY_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.value] = option.label;
  return accumulator;
}, {});

export function normalizeSystemCode(value) {
  return String(value || '').trim().toUpperCase();
}

export function normalizeSystemOption(system = {}) {
  const code = normalizeSystemCode(system.code || system.value);
  const name = String(system.name || system.label || code).trim();
  return {
    ...system,
    id: String(system.id || code || '').trim(),
    code,
    name,
    value: code,
    label: name,
    category: Object.values(SYSTEM_CATEGORY).includes(system.category) ? system.category : SYSTEM_CATEGORY.OLD,
    visibleInSubmit: system.visibleInSubmit !== false
  };
}

export function normalizeSystemOptions(systems = []) {
  return (Array.isArray(systems) ? systems : [])
    .map(normalizeSystemOption)
    .filter((system) => system.code && system.name);
}

export function getSystemOptionsByCategory(systems = [], category = SYSTEM_CATEGORY.OLD) {
  return normalizeSystemOptions(systems).filter((option) => option.category === category);
}

export function buildSystemLabels(systems = []) {
  return normalizeSystemOptions(systems).reduce((accumulator, option) => {
    accumulator[option.code] = option.name;
    return accumulator;
  }, {});
}

export function getSystemCategoryByCode(systems = [], systemCode) {
  const code = normalizeSystemCode(systemCode);
  return normalizeSystemOptions(systems).find((option) => option.code === code)?.category || SYSTEM_CATEGORY.OLD;
}

export function resolveSelectedSystem(systems = [], systemCode) {
  const code = normalizeSystemCode(systemCode);
  return normalizeSystemOptions(systems).find((option) => option.code === code) || null;
}

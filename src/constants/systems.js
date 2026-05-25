export const SYSTEM_CATEGORY = {
  OLD: 'OLD',
  NEW: 'NEW'
};

export const TICKET_CLASSIFICATION_DICTIONARY_TYPES = {
  INSURANCE_TYPE: 'INSURANCE_TYPE',
  SYSTEM_MODULE: 'SYSTEM_MODULE'
};

export const TICKET_CLASSIFICATION_DICTIONARY_TYPE_OPTIONS = [
  { type: TICKET_CLASSIFICATION_DICTIONARY_TYPES.INSURANCE_TYPE, value: TICKET_CLASSIFICATION_DICTIONARY_TYPES.INSURANCE_TYPE, name: '险种词典', label: '险种词典' },
  { type: TICKET_CLASSIFICATION_DICTIONARY_TYPES.SYSTEM_MODULE, value: TICKET_CLASSIFICATION_DICTIONARY_TYPES.SYSTEM_MODULE, name: '模块词典', label: '模块词典' }
];

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
  const ticketClassification = normalizeTicketClassificationConfig(system.ticketClassification);
  return {
    ...system,
    id: String(system.id || code || '').trim(),
    code,
    name,
    value: code,
    label: name,
    category: Object.values(SYSTEM_CATEGORY).includes(system.category) ? system.category : SYSTEM_CATEGORY.OLD,
    visibleInSubmit: system.visibleInSubmit !== false,
    ticketClassification: ticketClassification || undefined
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

export function normalizeTicketClassificationConfig(config = {}) {
  const fieldLabel = String(config?.fieldLabel || '').trim();
  const dictionaryType = String(config?.dictionaryType || '').trim().toUpperCase();
  if (!fieldLabel || !dictionaryType) return null;
  return { fieldLabel, dictionaryType };
}

export function getTicketClassificationDictionaryTypeName(dictionaryType) {
  const type = String(dictionaryType || '').trim().toUpperCase();
  return TICKET_CLASSIFICATION_DICTIONARY_TYPE_OPTIONS.find((item) => item.type === type)?.name || type;
}

export function isKnownTicketClassificationDictionaryType(dictionaryType) {
  const type = String(dictionaryType || '').trim().toUpperCase();
  return TICKET_CLASSIFICATION_DICTIONARY_TYPE_OPTIONS.some((item) => item.type === type);
}

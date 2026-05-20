import { ROLES } from '../constants/roles.js';
import { SYSTEM_OPTIONS } from '../constants/systems.js';
import { shortId } from '../utils/idGenerator.js';
import {
  DATA_FIX_SCHEME_CONFIG_KEY,
  INSURANCE_DICTIONARY_TYPE,
  SCHEDULE_CONFIG_KEY,
  SUPPORT_REST_CONFIG_KEY,
  buildUpcomingSupportRestDays,
  validateInsuranceTypeInput,
  validateDataFixSchemeConfig,
  validateScheduleConfig,
  validateSupportRestConfig
} from '../utils/adminConfigValidation.js';
import {
  buildPersonalQuickPhrasesConfigKey,
  validateQuickPhraseConfig
} from '../utils/quickPhrases.js';
import { getDb } from './db.js';

function parseRow(row) {
  return row ? JSON.parse(row.data) : null;
}

function nowIso() {
  return new Date().toISOString();
}

function actorFromUser(user) {
  return user ? { id: user.id, name: user.name } : null;
}

function upsertDictionaryItem(item) {
  const db = getDb();
  db.prepare(`
    INSERT INTO dictionary_items (id, type, code, name, enabled, updated_at, data)
    VALUES (@id, @type, @code, @name, @enabled, @updated_at, @data)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      code = excluded.code,
      name = excluded.name,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    id: item.id,
    type: item.type,
    code: item.code,
    name: item.name,
    enabled: item.enabled ? 1 : 0,
    updated_at: item.updatedAt,
    data: JSON.stringify(item)
  });

  return item;
}

function getDictionaryItemById(id) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM dictionary_items WHERE id = ?').get(id);
  return parseRow(row);
}

export function listInsuranceTypes() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM dictionary_items WHERE type = ? ORDER BY updated_at DESC, code ASC')
    .all(INSURANCE_DICTIONARY_TYPE)
    .map(parseRow);
}

export function createInsuranceType(input, user) {
  const validation = validateInsuranceTypeInput(input, listInsuranceTypes());
  if (!validation.ok) {
    return { ok: false, reason: '险种词典校验失败', errors: validation.errors };
  }

  const now = nowIso();
  const item = {
    id: shortId('ins'),
    type: INSURANCE_DICTIONARY_TYPE,
    ...validation.value,
    createdAt: now,
    updatedAt: now,
    updatedBy: actorFromUser(user)
  };

  return { ok: true, item: upsertDictionaryItem(item) };
}

export function updateInsuranceType(id, input, user) {
  const current = getDictionaryItemById(id);
  if (!current) {
    return { ok: false, reason: '险种不存在' };
  }

  const validation = validateInsuranceTypeInput(input, listInsuranceTypes(), id);
  if (!validation.ok) {
    return { ok: false, reason: '险种词典校验失败', errors: validation.errors };
  }

  const item = {
    ...current,
    ...validation.value,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  return { ok: true, item: upsertDictionaryItem(item) };
}

export function setInsuranceTypeEnabled(id, enabled, user) {
  const current = getDictionaryItemById(id);
  if (!current) {
    return { ok: false, reason: '险种不存在' };
  }

  const item = {
    ...current,
    enabled: enabled === true,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  return { ok: true, item: upsertDictionaryItem(item) };
}

export function listL1Users() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .filter((user) => user?.role === ROLES.L1)
    .map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    }));
}

export function getScheduleConfig() {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(SCHEDULE_CONFIG_KEY);
  return parseRow(row) || {
    groups: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function saveScheduleConfig(input, user) {
  const validation = validateScheduleConfig(input, {
    systems: SYSTEM_OPTIONS,
    enabledInsuranceTypes: listInsuranceTypes().filter((item) => item.enabled),
    assignableUsers: listL1Users()
  });

  if (!validation.ok) {
    return {
      ok: false,
      reason: '排班配置校验失败',
      errors: validation.errors
    };
  }

  const config = {
    ...validation.value,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO app_configs (key, updated_at, data)
    VALUES (@key, @updated_at, @data)
    ON CONFLICT(key) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    key: SCHEDULE_CONFIG_KEY,
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return { ok: true, config };
}

export function getSupportRestConfig() {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(SUPPORT_REST_CONFIG_KEY);
  return parseRow(row) || {
    restPeriods: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function saveSupportRestConfig(input, user) {
  const validation = validateSupportRestConfig(input, {
    assignableUsers: listL1Users()
  });

  if (!validation.ok) {
    return {
      ok: false,
      reason: '休息时间配置校验失败',
      errors: validation.errors
    };
  }

  const config = {
    ...validation.value,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO app_configs (key, updated_at, data)
    VALUES (@key, @updated_at, @data)
    ON CONFLICT(key) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    key: SUPPORT_REST_CONFIG_KEY,
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return { ok: true, config };
}

export function getUpcomingSupportRestDays(options = {}) {
  const users = listL1Users();
  return buildUpcomingSupportRestDays(getSupportRestConfig(), users, options);
}

export function getDataFixSchemeConfig() {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(DATA_FIX_SCHEME_CONFIG_KEY);
  return parseRow(row) || {
    schemes: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function saveDataFixSchemeConfig(input, user) {
  const validation = validateDataFixSchemeConfig(input);

  if (!validation.ok) {
    return {
      ok: false,
      reason: '数据修正方案配置校验失败',
      errors: validation.errors
    };
  }

  const config = {
    ...validation.value,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO app_configs (key, updated_at, data)
    VALUES (@key, @updated_at, @data)
    ON CONFLICT(key) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    key: DATA_FIX_SCHEME_CONFIG_KEY,
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return { ok: true, config };
}

export function getPersonalQuickPhrasesConfig(userId) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(buildPersonalQuickPhrasesConfigKey(userId));
  return parseRow(row) || {
    phrases: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function savePersonalQuickPhrasesConfig(userId, input, user) {
  const validation = validateQuickPhraseConfig(input);

  if (!validation.ok) {
    return {
      ok: false,
      reason: '常用话术配置校验失败',
      errors: validation.errors
    };
  }

  const config = {
    ...validation.value,
    updatedAt: nowIso(),
    updatedBy: actorFromUser(user)
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO app_configs (key, updated_at, data)
    VALUES (@key, @updated_at, @data)
    ON CONFLICT(key) DO UPDATE SET
      updated_at = excluded.updated_at,
      data = excluded.data
  `).run({
    key: buildPersonalQuickPhrasesConfigKey(userId),
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return { ok: true, config };
}

import { ROLES } from '../constants/roles.js';
import {
  TICKET_CLASSIFICATION_DICTIONARY_TYPE_OPTIONS,
  getTicketClassificationDictionaryTypeName,
  normalizeSystemOptions
} from '../constants/systems.js';
import { shortId } from '../utils/idGenerator.js';
import {
  DATA_FIX_SCHEME_CONFIG_KEY,
  INSURANCE_DICTIONARY_TYPE,
  SCHEDULE_CONFIG_KEY,
  SYSTEM_CONFIG_KEY,
  SUPPORT_REST_CONFIG_KEY,
  buildUpcomingSupportRestDays,
  validateInsuranceTypeInput,
  validateDataFixSchemeConfig,
  validateScheduleConfig,
  validateSystemConfig,
  validateSupportRestConfig
} from '../utils/adminConfigValidation.js';
import {
  buildPersonalQuickPhrasesConfigKey,
  validateQuickPhraseConfig
} from '../utils/quickPhrases.js';
import {
  ANNOUNCEMENT_CONFIG_KEY,
  filterAnnouncements,
  getActiveAnnouncements
} from '../utils/announcements.js';
import {
  approveAnnouncement,
  createAnnouncement,
  rejectAnnouncement,
  submitAnnouncement,
  toggleAnnouncementPinned,
  updateAnnouncement,
  withdrawAnnouncement
} from './announcementService.js';
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

function sanitizeConfigUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department
  };
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
  return listDictionaryItemsByType(INSURANCE_DICTIONARY_TYPE);
}

export function listDictionaryItemsByType(type) {
  const dictionaryType = String(type || '').trim().toUpperCase();
  if (!dictionaryType) return [];
  const db = getDb();
  return db
    .prepare('SELECT data FROM dictionary_items WHERE type = ? ORDER BY updated_at DESC, code ASC')
    .all(dictionaryType)
    .map(parseRow);
}

export function listEnabledDictionaryOptions(type) {
  return listDictionaryItemsByType(type)
    .filter((item) => item?.enabled !== false)
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      label: item.name,
      value: item.id,
      type: item.type,
      dictionaryType: item.type
    }));
}

export function listTicketClassificationDictionaryTypes() {
  return TICKET_CLASSIFICATION_DICTIONARY_TYPE_OPTIONS.map(({ type, name }) => ({ type, name }));
}

export function getTicketClassificationDictionaryName(type) {
  return getTicketClassificationDictionaryTypeName(type);
}

export function findEnabledDictionaryOption(type, optionId) {
  const id = String(optionId || '').trim();
  if (!id) return null;
  return listDictionaryItemsByType(type).find((item) => item.id === id && item.enabled !== false) || null;
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
    .map(sanitizeConfigUser);
}

export function listAdminUsers() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .filter((user) => user?.role === ROLES.ADMIN)
    .map(sanitizeConfigUser);
}

export function listAnnouncementHandlerUsers() {
  const db = getDb();
  return db
    .prepare('SELECT data FROM users ORDER BY username ASC')
    .all()
    .map(parseRow)
    .filter((user) => user?.role === ROLES.L1 || user?.role === ROLES.L2)
    .map(sanitizeConfigUser);
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
    systems: getSystemConfig({ visibleOnly: true }).systems,
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

export function getSystemConfig(options = {}) {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(SYSTEM_CONFIG_KEY);
  const config = parseRow(row) || {
    systems: [],
    updatedAt: null,
    updatedBy: null
  };
  const systems = normalizeSystemOptions(config.systems || []);

  return {
    ...config,
    systems: options.visibleOnly
      ? systems.filter((system) => system.visibleInSubmit !== false)
      : systems
  };
}

export function saveSystemConfig(input, user) {
  const validation = validateSystemConfig(input);

  if (!validation.ok) {
    return {
      ok: false,
      reason: '系统配置校验失败',
      errors: validation.errors
    };
  }

  const config = {
    ...validation.value,
    systems: normalizeSystemOptions(validation.value.systems),
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
    key: SYSTEM_CONFIG_KEY,
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return { ok: true, config };
}

export function getAnnouncementConfig() {
  const db = getDb();
  const row = db.prepare('SELECT data FROM app_configs WHERE key = ?').get(ANNOUNCEMENT_CONFIG_KEY);
  return parseRow(row) || {
    announcements: [],
    updatedAt: null,
    updatedBy: null
  };
}

export function listAnnouncementOptions() {
  return {
    systems: getSystemConfig({ visibleOnly: true }).systems,
    adminUsers: listAdminUsers(),
    supportUsers: listAnnouncementHandlerUsers()
  };
}

export function listFilteredAnnouncements(filters = {}) {
  return filterAnnouncements(getAnnouncementConfig().announcements, filters);
}

export function listActiveAnnouncements(now) {
  return getActiveAnnouncements(getAnnouncementConfig().announcements, now);
}

export function listActiveAnnouncementDtos(now) {
  return listActiveAnnouncements(now).map(toActiveAnnouncementDto);
}

function toActiveAnnouncementDto(announcement) {
  const snapshot = announcement.activeSnapshot || announcement.publishedSnapshot || {};
  return {
    id: announcement.id,
    status: announcement.status,
    publishedAt: announcement.publishedAt || null,
    activeSnapshot: {
      title: snapshot.title || '',
      affectedSystems: cloneSimpleArray(snapshot.affectedSystems),
      faultDescriptionHtml: snapshot.faultDescriptionHtml || '',
      faultDescriptionText: snapshot.faultDescriptionText || '',
      progressHtml: snapshot.progressHtml || '',
      progressText: snapshot.progressText || '',
      estimatedRecoveryAt: snapshot.estimatedRecoveryAt || null,
      display: { ...(snapshot.display || {}) }
    }
  };
}

function cloneSimpleArray(value) {
  return Array.isArray(value) ? value.map((item) => ({ ...item })) : [];
}

export function createAnnouncementConfig(input, user) {
  return persistAnnouncementResult(
    createAnnouncement(getAnnouncementConfig(), input, user, listAnnouncementOptions()),
    user
  );
}

export function updateAnnouncementConfig(id, input, user) {
  return persistAnnouncementResult(
    updateAnnouncement(getAnnouncementConfig(), id, input, user, listAnnouncementOptions()),
    user
  );
}

export function submitAnnouncementConfig(id, user) {
  return persistAnnouncementResult(
    submitAnnouncement(getAnnouncementConfig(), id, user),
    user
  );
}

export function approveAnnouncementConfig(id, user, opinion = '') {
  return persistAnnouncementResult(
    approveAnnouncement(getAnnouncementConfig(), id, user, opinion),
    user
  );
}

export function rejectAnnouncementConfig(id, user, opinion = '') {
  return persistAnnouncementResult(
    rejectAnnouncement(getAnnouncementConfig(), id, user, opinion),
    user
  );
}

export function withdrawAnnouncementConfig(id, user, reason = '') {
  return persistAnnouncementResult(
    withdrawAnnouncement(getAnnouncementConfig(), id, user, reason),
    user
  );
}

export function toggleAnnouncementPinnedConfig(id, user, pinned) {
  return persistAnnouncementResult(
    toggleAnnouncementPinned(getAnnouncementConfig(), id, user, pinned),
    user
  );
}

function persistAnnouncementResult(result, user) {
  if (!result.ok) return result;

  const config = persistAnnouncementConfig(result.config, user);
  const announcement = config.announcements.find((item) => item.id === result.announcement?.id)
    || result.announcement;

  return { ...result, config, announcement };
}

function persistAnnouncementConfig(input, user) {
  const config = {
    announcements: Array.isArray(input?.announcements) ? input.announcements : [],
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
    key: ANNOUNCEMENT_CONFIG_KEY,
    updated_at: config.updatedAt,
    data: JSON.stringify(config)
  });

  return config;
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

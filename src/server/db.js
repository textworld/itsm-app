import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { withDualStatuses } from '../constants/ticketStatus.js';
import { DATA_FIX_SCHEME_CONFIG_KEY, SYSTEM_CONFIG_KEY } from '../utils/adminConfigValidation.js';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'itsm.sqlite');
const jsonDbPath = path.join(dataDir, 'itsm-fallback.json');
const mockDir = path.join(process.cwd(), 'src', 'mock');
const INSURANCE_DICTIONARY_TYPE = 'INSURANCE_TYPE';
const SYSTEM_MODULE_DICTIONARY_TYPE = 'SYSTEM_MODULE';

const DEFAULT_INSURANCE_TYPES = [
  { id: 'ins_medical', code: 'MEDICAL', name: '医疗险', enabled: true },
  { id: 'ins_life', code: 'LIFE', name: '寿险', enabled: true },
  { id: 'ins_accident', code: 'ACCIDENT', name: '意外险', enabled: true }
];

const DEFAULT_SYSTEM_MODULES = [
  { id: 'module_policy', code: 'POLICY', name: '保单模块', enabled: true },
  { id: 'module_claim', code: 'CLAIM', name: '理赔模块', enabled: true },
  { id: 'module_customer', code: 'CUSTOMER', name: '客户模块', enabled: true }
];

const DEFAULT_SYSTEMS = [
  { id: 'sys_erp_core', code: 'ERP_CORE', name: 'ERP 核心系统', category: 'OLD', visibleInSubmit: true },
  { id: 'sys_mes_portal', code: 'MES_PORTAL', name: 'MES 制造执行平台', category: 'NEW', visibleInSubmit: true },
  { id: 'sys_crm_center', code: 'CRM_CENTER', name: 'CRM 客户管理系统', category: 'NEW', visibleInSubmit: true },
  { id: 'sys_finance_bi', code: 'FINANCE_BI', name: '财务 BI 报表平台', category: 'OLD', visibleInSubmit: true },
  { id: 'sys_oa_center', code: 'OA_CENTER', name: 'OA 协同办公系统', category: 'OLD', visibleInSubmit: true },
  { id: 'sys_hr_master', code: 'HR_MASTER', name: 'HR 人员主数据平台', category: 'OLD', visibleInSubmit: true },
  { id: 'sys_supply_chain', code: 'SUPPLY_CHAIN', name: '供应链协同平台', category: 'OLD', visibleInSubmit: true },
  { id: 'sys_ops_monitor', code: 'OPS_MONITOR', name: '运维监控中心', category: 'NEW', visibleInSubmit: true }
];

const DEFAULT_DATA_FIX_SCHEMES = [
  {
    id: 'scheme_customer_profile_sync',
    title: '客户资料同步修正',
    description: '用于修正客户主数据在 CRM、保单、理赔等系统间同步不一致的问题，核对客户编号、证件号和联系方式后执行同步补偿。'
  },
  {
    id: 'scheme_policy_status_repair',
    title: '保单状态修正',
    description: '用于修正保单状态展示与实际业务状态不一致的问题，确认承保、退保、失效或复效记录后刷新保单状态。'
  },
  {
    id: 'scheme_premium_payment_match',
    title: '缴费记录匹配',
    description: '用于处理缴费流水已到账但业务系统未匹配的问题，核验支付流水、保单号和缴费期次后补做缴费匹配。'
  },
  {
    id: 'scheme_claim_amount_recalculate',
    title: '理赔金额重算',
    description: '用于修正理赔金额计算异常的问题，基于责任、免赔额、赔付比例和历史赔付记录重新计算并更新结果。'
  },
  {
    id: 'scheme_invoice_status_refresh',
    title: '发票状态刷新',
    description: '用于修正发票开具、红冲或作废状态不同步的问题，核对发票平台结果后刷新业务系统发票状态。'
  },
  {
    id: 'scheme_endorsement_data_rebuild',
    title: '批改数据重建',
    description: '用于处理批改完成后保单附属信息未正确更新的问题，根据批改单记录重建受影响字段。'
  },
  {
    id: 'scheme_commission_settlement_fix',
    title: '佣金结算修正',
    description: '用于修正代理人佣金结算数据异常的问题，核对结算周期、保费、佣金比例和扣回规则后重新生成结算数据。'
  },
  {
    id: 'scheme_renewal_notice_regenerate',
    title: '续保通知重生成',
    description: '用于处理续保通知缺失或内容错误的问题，确认续保规则和客户触达信息后重新生成通知记录。'
  },
  {
    id: 'scheme_underwriting_result_sync',
    title: '核保结果同步',
    description: '用于修正核保结果未同步到出单或销售系统的问题，核验核保结论后重新同步业务结果。'
  },
  {
    id: 'scheme_surrender_value_repair',
    title: '退保金额修正',
    description: '用于修正退保试算或退保入账金额异常的问题，按产品规则、现金价值和费用扣减重新计算并更新。'
  },
  {
    id: 'scheme_beneficiary_info_fix',
    title: '受益人信息修正',
    description: '用于修正受益人姓名、证件号、比例或顺序展示异常的问题，按最新有效申请记录更新受益人信息。'
  },
  {
    id: 'scheme_group_policy_member_sync',
    title: '团单成员同步',
    description: '用于处理团体保单成员增减员结果未同步的问题，核对成员清单和生效日期后补齐成员关系。'
  },
  {
    id: 'scheme_account_binding_repair',
    title: '账户绑定修正',
    description: '用于修正银行卡、扣款账户或收款账户绑定异常的问题，核验账户合法性和授权记录后更新绑定关系。'
  },
  {
    id: 'scheme_product_liability_refresh',
    title: '产品责任刷新',
    description: '用于处理产品责任、险种计划或保障项目展示异常的问题，按产品配置重新刷新保单责任数据。'
  },
  {
    id: 'scheme_channel_attribution_fix',
    title: '渠道归属修正',
    description: '用于修正工单、保单或客户渠道归属错误的问题，按销售渠道、机构和人员归属规则重新写入。'
  },
  {
    id: 'scheme_batch_import_rollback',
    title: '批量导入回滚',
    description: '用于处理批量导入产生错误数据的问题，按导入批次识别影响范围并回滚或覆盖修正相关记录。'
  },
  {
    id: 'scheme_duplicate_record_merge',
    title: '重复记录合并',
    description: '用于合并重复客户、保单扩展或业务附属记录，确认主记录后迁移关联关系并标记重复记录失效。'
  },
  {
    id: 'scheme_month_end_summary_rebuild',
    title: '月结汇总重建',
    description: '用于修正月结报表或汇总表数据不一致的问题，按指定月份和业务范围重新生成汇总数据。'
  },
  {
    id: 'scheme_permission_data_refresh',
    title: '权限数据刷新',
    description: '用于处理岗位、机构或数据权限变更后业务数据可见范围异常的问题，重新刷新权限缓存和授权数据。'
  },
  {
    id: 'scheme_external_interface_resend',
    title: '外部接口补发',
    description: '用于处理对接银行、税控、监管或第三方平台接口发送失败的问题，确认幂等键后补发受影响数据。'
  }
];

function readMockJson(filename) {
  return JSON.parse(fs.readFileSync(path.join(mockDir, filename), 'utf8'));
}

function createDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });

  let db;
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  } catch (error) {
    console.warn(
      `SQLite native binding unavailable, using JSON fallback store: ${String(error.message).split('\n')[0]}`
    );
    db = new JsonFallbackDatabase(jsonDbPath);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS defects (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      user_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY (user_id, ticket_id)
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      stored_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      uploader_id TEXT,
      uploader_name TEXT
    );

    CREATE TABLE IF NOT EXISTS dictionary_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL,
      UNIQUE(type, code)
    );

    CREATE TABLE IF NOT EXISTS app_configs (
      key TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solutions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      version_no INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solution_versions (
      id TEXT PRIMARY KEY,
      solution_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS solution_references (
      id TEXT PRIMARY KEY,
      solution_id TEXT NOT NULL,
      ticket_id TEXT NOT NULL,
      version_no INTEGER NOT NULL,
      quoted_at TEXT NOT NULL,
      data TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_solution_versions_solution_id ON solution_versions(solution_id, version_no DESC);
    CREATE INDEX IF NOT EXISTS idx_solution_references_solution_id ON solution_references(solution_id, quoted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_solution_references_ticket_id ON solution_references(ticket_id, quoted_at DESC);
  `);

  seedDatabase(db);
  return db;
}

function seedDatabase(db, { force = false } = {}) {
  const shouldSeed =
    force ||
    db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0 ||
    db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count === 0 ||
    db.prepare('SELECT COUNT(*) AS count FROM defects').get().count === 0;
  const shouldSeedInsuranceTypes =
    force ||
    db.prepare('SELECT COUNT(*) AS count FROM dictionary_items WHERE type = ?').get(INSURANCE_DICTIONARY_TYPE).count === 0;
  const shouldSeedSystemModules =
    force ||
    db.prepare('SELECT COUNT(*) AS count FROM dictionary_items WHERE type = ?').get(SYSTEM_MODULE_DICTIONARY_TYPE).count === 0;
  const shouldSeedDataFixSchemes =
    force ||
    !db.prepare('SELECT data FROM app_configs WHERE key = ?').get(DATA_FIX_SCHEME_CONFIG_KEY);
  const shouldSeedSystems =
    force ||
    !db.prepare('SELECT data FROM app_configs WHERE key = ?').get(SYSTEM_CONFIG_KEY);

  if (!shouldSeed && !shouldSeedInsuranceTypes && !shouldSeedSystemModules && !shouldSeedDataFixSchemes && !shouldSeedSystems) {
    return;
  }

  const reset = db.transaction(() => {
    if (shouldSeed) {
      const initialUsers = readMockJson('initialUsers.json');
      const initialTickets = readMockJson('initialTickets.json');
      const initialDefects = readMockJson('initialDefects.json');

      db.prepare('DELETE FROM users').run();
      db.prepare('DELETE FROM tickets').run();
      db.prepare('DELETE FROM defects').run();
      db.prepare('DELETE FROM message_reads').run();
      db.prepare('DELETE FROM uploads').run();
      db.prepare('DELETE FROM solutions').run();
      db.prepare('DELETE FROM solution_versions').run();
      db.prepare('DELETE FROM solution_references').run();

      const insertUser = db.prepare(`
        INSERT INTO users (id, username, password, data)
        VALUES (@id, @username, @password, @data)
      `);
      const insertTicket = db.prepare(`
        INSERT INTO tickets (id, updated_at, data)
        VALUES (@id, @updated_at, @data)
      `);
      const insertDefect = db.prepare(`
        INSERT INTO defects (id, updated_at, data)
        VALUES (@id, @updated_at, @data)
      `);

      for (const user of initialUsers) {
        insertUser.run({
          id: user.id,
          username: user.username,
          password: user.password,
          data: JSON.stringify(user)
        });
      }

      for (const ticket of initialTickets.map(withDualStatuses)) {
        insertTicket.run({
          id: ticket.id,
          updated_at: ticket.updatedAt || ticket.createdAt || new Date().toISOString(),
          data: JSON.stringify(ticket)
        });
      }

      for (const defect of initialDefects) {
        insertDefect.run({
          id: defect.defectId,
          updated_at: defect.updatedAt || defect.createdAt || new Date().toISOString(),
          data: JSON.stringify(defect)
        });
      }
    }

    if (force) {
      db.prepare('DELETE FROM app_configs').run();
    }

    if (shouldSeedInsuranceTypes) {
      seedDictionaryItems(db, INSURANCE_DICTIONARY_TYPE, DEFAULT_INSURANCE_TYPES);
    }

    if (shouldSeedSystemModules) {
      seedDictionaryItems(db, SYSTEM_MODULE_DICTIONARY_TYPE, DEFAULT_SYSTEM_MODULES);
    }

    if (shouldSeedDataFixSchemes) {
      const now = new Date().toISOString();
      const config = {
        schemes: DEFAULT_DATA_FIX_SCHEMES,
        updatedAt: now,
        updatedBy: null
      };
      db.prepare(`
        INSERT INTO app_configs (key, updated_at, data)
        VALUES (@key, @updated_at, @data)
        ON CONFLICT(key) DO UPDATE SET
          updated_at = excluded.updated_at,
          data = excluded.data
      `).run({
        key: DATA_FIX_SCHEME_CONFIG_KEY,
        updated_at: now,
        data: JSON.stringify(config)
      });
    }

    if (shouldSeedSystems) {
      const now = new Date().toISOString();
      const config = {
        systems: DEFAULT_SYSTEMS,
        updatedAt: now,
        updatedBy: null
      };
      db.prepare(`
        INSERT INTO app_configs (key, updated_at, data)
        VALUES (@key, @updated_at, @data)
        ON CONFLICT(key) DO UPDATE SET
          updated_at = excluded.updated_at,
          data = excluded.data
      `).run({
        key: SYSTEM_CONFIG_KEY,
        updated_at: now,
        data: JSON.stringify(config)
      });
    }
  });

  reset();
}

export function getDb() {
  if (!globalThis.__itsmDb) {
    globalThis.__itsmDb = createDatabase();
  }
  return globalThis.__itsmDb;
}

export function reseedDb() {
  seedDatabase(getDb(), { force: true });
}

export { dbPath };

function seedDictionaryItems(db, type, items) {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM dictionary_items WHERE type = ?').run(type);
  const insertDictionaryItem = db.prepare(`
    INSERT INTO dictionary_items (id, type, code, name, enabled, updated_at, data)
    VALUES (@id, @type, @code, @name, @enabled, @updated_at, @data)
  `);

  for (const item of items) {
    const data = {
      ...item,
      type,
      createdAt: now,
      updatedAt: now,
      updatedBy: null
    };
    insertDictionaryItem.run({
      id: item.id,
      type,
      code: item.code,
      name: item.name,
      enabled: item.enabled ? 1 : 0,
      updated_at: now,
      data: JSON.stringify(data)
    });
  }
}

class JsonFallbackDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.tables = this.load();
  }

  pragma() {}

  exec() {}

  transaction(fn) {
    return (...args) => fn(...args);
  }

  prepare(sql) {
    return new JsonFallbackStatement(this, normalizeSql(sql));
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      const raw = fs.readFileSync(this.filePath, 'utf8').trim();
      if (!raw) {
        return createEmptyTables();
      }
      try {
        return {
          ...createEmptyTables(),
          ...JSON.parse(raw)
        };
      } catch (error) {
        console.warn(`Ignoring unreadable JSON fallback store: ${error.message}`);
        return createEmptyTables();
      }
    }
    return createEmptyTables();
  }

  persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.tables, null, 2));
  }
}

class JsonFallbackStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
  }

  get(...args) {
    if (this.sql.includes('select count(*) as count from users')) {
      return {
        count: this.db.tables.users.length
      };
    }
    if (this.sql.includes('select count(*) as count from tickets')) {
      return { count: this.db.tables.tickets.length };
    }
    if (this.sql.includes('select count(*) as count from defects')) {
      return { count: this.db.tables.defects.length };
    }
    if (this.sql.includes('select count(*) as count from dictionary_items where type = ?')) {
      return { count: this.db.tables.dictionary_items.filter((row) => row.type === args[0]).length };
    }
    if (this.sql.includes('select data from tickets where id = ?')) {
      return this.db.tables.tickets.find((row) => row.id === args[0]) || undefined;
    }
    if (
      this.sql.includes('select data from users where username = ?') &&
      this.sql.includes('password = ?')
    ) {
      const [username, password, role] = args;
      return this.db.tables.users.find((row) => {
        const user = JSON.parse(row.data);
        return row.username === username && row.password === password && user.role === role;
      }) || undefined;
    }
    if (this.sql.includes('select data from users where id = ?')) {
      return this.db.tables.users.find((row) => row.id === args[0]) || undefined;
    }
    if (this.sql.includes('select data from dictionary_items where id = ?')) {
      return this.db.tables.dictionary_items.find((row) => row.id === args[0]) || undefined;
    }
    if (this.sql.includes('select data from app_configs where key = ?')) {
      return this.db.tables.app_configs.find((row) => row.key === args[0]) || undefined;
    }
    if (this.sql.includes('select data from solutions where id = ?')) {
      return this.db.tables.solutions.find((row) => row.id === args[0]) || undefined;
    }
    if (this.sql.includes('select data from solutions where code = ?')) {
      return this.db.tables.solutions.find((row) => row.code === args[0]) || undefined;
    }
    if (this.sql.includes('select data from solution_versions where solution_id = ? and version_no = ?')) {
      return this.db.tables.solution_versions.find(
        (row) => row.solution_id === args[0] && row.version_no === args[1]
      ) || undefined;
    }
    if (this.sql.includes('from uploads') && this.sql.includes('where id = ?')) {
      return this.db.tables.uploads.find((row) => row.id === args[0]) || undefined;
    }
    return undefined;
  }

  all(...args) {
    if (this.sql.includes('select data from tickets order by updated_at desc')) {
      return [...this.db.tables.tickets].sort(compareUpdatedRows);
    }
    if (this.sql.includes('select data from defects order by updated_at desc')) {
      return [...this.db.tables.defects].sort(compareUpdatedRows);
    }
    if (this.sql.includes('select data from users')) {
      return [...this.db.tables.users];
    }
    if (this.sql.includes('select data from dictionary_items where type = ?')) {
      return this.db.tables.dictionary_items
        .filter((row) => row.type === args[0])
        .sort(compareUpdatedRows);
    }
    if (this.sql.includes('select data from solutions order by updated_at desc')) {
      return [...this.db.tables.solutions].sort(compareUpdatedRows);
    }
    if (this.sql.includes('select data from solution_versions where solution_id = ? order by version_no desc')) {
      return this.db.tables.solution_versions
        .filter((row) => row.solution_id === args[0])
        .sort(compareVersionRows);
    }
    if (this.sql.includes('select data from solution_references where solution_id = ? order by quoted_at desc')) {
      return this.db.tables.solution_references
        .filter((row) => row.solution_id === args[0])
        .sort(compareQuotedRows);
    }
    if (this.sql.includes('select data from solution_references where ticket_id = ? order by quoted_at desc')) {
      return this.db.tables.solution_references
        .filter((row) => row.ticket_id === args[0])
        .sort(compareQuotedRows);
    }
    if (this.sql.includes('select ticket_id, read_at from message_reads where user_id = ?')) {
      return this.db.tables.message_reads
        .filter((row) => row.user_id === args[0])
        .map((row) => ({ ticket_id: row.ticket_id, read_at: row.read_at }));
    }
    return [];
  }

  run(params = {}) {
    if (this.sql.startsWith('delete from users')) {
      this.db.tables.users = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from tickets where id = ?')) {
      const ticketId = params;
      this.db.tables.tickets = this.db.tables.tickets.filter((row) => row.id !== ticketId);
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from tickets')) {
      this.db.tables.tickets = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from defects')) {
      this.db.tables.defects = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from message_reads')) {
      this.db.tables.message_reads = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from uploads')) {
      this.db.tables.uploads = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from dictionary_items where type = ?')) {
      this.db.tables.dictionary_items = this.db.tables.dictionary_items.filter((row) => row.type !== params);
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from app_configs')) {
      this.db.tables.app_configs = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from solutions where id = ?')) {
      this.db.tables.solutions = this.db.tables.solutions.filter((row) => row.id !== params);
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from solutions')) {
      this.db.tables.solutions = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from solution_versions')) {
      this.db.tables.solution_versions = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('delete from solution_references')) {
      this.db.tables.solution_references = [];
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into users')) {
      upsertById(this.db.tables.users, {
        id: params.id,
        username: params.username,
        password: params.password,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.startsWith('update users set data = @data where id = @id')) {
      const index = this.db.tables.users.findIndex((row) => row.id === params.id);
      if (index < 0) {
        return { changes: 0 };
      }
      this.db.tables.users[index] = {
        ...this.db.tables.users[index],
        data: params.data
      };
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into tickets')) {
      upsertById(this.db.tables.tickets, {
        id: params.id,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into defects')) {
      upsertById(this.db.tables.defects, {
        id: params.id,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into message_reads')) {
      const nextRow = {
        user_id: params.user_id,
        ticket_id: params.ticket_id,
        read_at: params.read_at
      };
      const index = this.db.tables.message_reads.findIndex(
        (row) => row.user_id === nextRow.user_id && row.ticket_id === nextRow.ticket_id
      );
      if (index >= 0) {
        this.db.tables.message_reads[index] = nextRow;
      } else {
        this.db.tables.message_reads.push(nextRow);
      }
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into dictionary_items')) {
      upsertById(this.db.tables.dictionary_items, {
        id: params.id,
        type: params.type,
        code: params.code,
        name: params.name,
        enabled: params.enabled,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into app_configs')) {
      upsertByKey(this.db.tables.app_configs, {
        key: params.key,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into solutions')) {
      upsertById(this.db.tables.solutions, {
        id: params.id,
        code: params.code,
        title: params.title,
        enabled: params.enabled,
        version_no: params.version_no,
        updated_at: params.updated_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into solution_versions')) {
      upsertById(this.db.tables.solution_versions, {
        id: params.id,
        solution_id: params.solution_id,
        version_no: params.version_no,
        change_type: params.change_type,
        created_at: params.created_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into solution_references')) {
      upsertById(this.db.tables.solution_references, {
        id: params.id,
        solution_id: params.solution_id,
        ticket_id: params.ticket_id,
        version_no: params.version_no,
        quoted_at: params.quoted_at,
        data: params.data
      });
      this.db.persist();
      return { changes: 1 };
    }
    if (this.sql.includes('insert into uploads')) {
      upsertById(this.db.tables.uploads, {
        id: params.id,
        stored_name: params.stored_name,
        original_name: params.original_name,
        mime_type: params.mime_type,
        size: params.size,
        created_at: params.created_at,
        uploader_id: params.uploader_id,
        uploader_name: params.uploader_name
      });
      this.db.persist();
      return { changes: 1 };
    }
    return { changes: 0 };
  }
}

function createEmptyTables() {
  return {
    users: [],
    tickets: [],
    defects: [],
    message_reads: [],
    uploads: [],
    dictionary_items: [],
    app_configs: [],
    solutions: [],
    solution_versions: [],
    solution_references: []
  };
}

function normalizeSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function upsertById(rows, nextRow) {
  const index = rows.findIndex((row) => row.id === nextRow.id);
  if (index >= 0) {
    rows[index] = nextRow;
  } else {
    rows.push(nextRow);
  }
}

function upsertByKey(rows, nextRow) {
  const index = rows.findIndex((row) => row.key === nextRow.key);
  if (index >= 0) {
    rows[index] = nextRow;
  } else {
    rows.push(nextRow);
  }
}

function compareUpdatedRows(left, right) {
  const updatedDiff =
    new Date(right.updated_at || right.created_at || 0).getTime() -
    new Date(left.updated_at || left.created_at || 0).getTime();
  if (updatedDiff !== 0) return updatedDiff;
  return String(right.id || '').localeCompare(String(left.id || ''));
}

function compareVersionRows(left, right) {
  const versionDiff = Number(right.version_no || 0) - Number(left.version_no || 0);
  if (versionDiff !== 0) return versionDiff;
  return String(right.id || '').localeCompare(String(left.id || ''));
}

function compareQuotedRows(left, right) {
  const quotedDiff =
    new Date(right.quoted_at || 0).getTime() -
    new Date(left.quoted_at || 0).getTime();
  if (quotedDiff !== 0) return quotedDiff;
  return String(right.id || '').localeCompare(String(left.id || ''));
}

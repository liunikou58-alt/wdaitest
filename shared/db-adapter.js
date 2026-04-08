/**
 * 共用資料庫介面層 (Adapter Pattern)
 * 
 * 支援：
 *  - SQLite（預設，支援多人並發）
 *  - JSON 檔案（備用）
 * 
 * 用法：
 *   const db = createAdapter({ type: 'sqlite', dataDir: './data', collections: {...} });
 */
const fs = require('fs');
const path = require('path');

// ============================================================
// SQLite Adapter（並發安全，支援多人同時讀寫）
// ============================================================
class SqliteAdapter {
  constructor(dataDir, collections = {}) {
    this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });

    const Database = require('better-sqlite3');
    this.dbFile = path.join(dataDir, 'app.db');
    this.db = new Database(this.dbFile);

    // 啟用 WAL 模式（允許同時讀寫）
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    // 為每個 collection 建立表
    this.collections = Object.keys(collections);
    for (const col of this.collections) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS "${col}" (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at TEXT,
          updated_at TEXT
        )
      `);
    }

    // 從舊 JSON 遷移資料（如果存在）
    this._migrateFromJson(collections);

    console.log(`[DB] ✅ SQLite 已啟用 (WAL mode) — ${this.dbFile}`);
  }

  _migrateFromJson(defaultCollections) {
    const jsonFile = path.join(this.dataDir, 'db.json');
    if (!fs.existsSync(jsonFile)) return;

    try {
      const jsonData = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      let migrated = 0;

      for (const [col, rows] of Object.entries(jsonData)) {
        if (!Array.isArray(rows) || rows.length === 0) continue;

        // 確保表存在
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS "${col}" (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            created_at TEXT,
            updated_at TEXT
          )
        `);

        // 檢查是否已有資料
        const existing = this.db.prepare(`SELECT COUNT(*) as c FROM "${col}"`).get();
        if (existing.c > 0) continue;

        const insert = this.db.prepare(`INSERT OR IGNORE INTO "${col}" (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`);
        const tx = this.db.transaction((items) => {
          for (const item of items) {
            const id = item.id || require('uuid').v4();
            insert.run(id, JSON.stringify(item), item.created_at || null, item.updated_at || null);
            migrated++;
          }
        });
        tx(rows);
      }

      if (migrated > 0) {
        // 備份舊 JSON 檔案
        const backupFile = path.join(this.dataDir, `db_backup_${Date.now()}.json`);
        fs.renameSync(jsonFile, backupFile);
        console.log(`[DB] 📦 已遷移 ${migrated} 筆資料從 JSON → SQLite (備份: ${path.basename(backupFile)})`);
      }
    } catch (e) {
      console.error('[DB] JSON 遷移失敗:', e.message);
    }
  }

  getAll(col, opts = {}) {
    // 確保表存在
    this._ensureTable(col);

    let rows = this.db.prepare(`SELECT data FROM "${col}"`).all().map(r => JSON.parse(r.data));

    // 搜尋
    if (opts.search && opts.searchFields) {
      const q = opts.search.toLowerCase();
      rows = rows.filter(r => opts.searchFields.some(f => (r[f] || '').toLowerCase().includes(q)));
    }
    // 篩選
    if (opts.where) {
      Object.entries(opts.where).forEach(([k, v]) => {
        if (v !== undefined && v !== '') rows = rows.filter(r => r[k] === v);
      });
    }
    // 排序
    if (opts.sortBy) {
      const dir = opts.sortDir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[opts.sortBy] || '', bv = b[opts.sortBy] || '';
        return typeof av === 'number' ? (av - bv) * dir : String(av).localeCompare(String(bv)) * dir;
      });
    }
    // 分頁
    const total = rows.length;
    if (opts.page && opts.limit) {
      const offset = (opts.page - 1) * opts.limit;
      rows = rows.slice(offset, offset + opts.limit);
      return { data: rows, total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) };
    }
    return opts.paginated ? { data: rows, total } : rows;
  }

  getById(col, id) {
    this._ensureTable(col);
    const row = this.db.prepare(`SELECT data FROM "${col}" WHERE id = ?`).get(id);
    return row ? JSON.parse(row.data) : null;
  }

  find(col, fn) {
    return this.getAll(col).filter(fn);
  }

  findOne(col, fn) {
    return this.getAll(col).find(fn) || null;
  }

  count(col, fn) {
    return fn ? this.find(col, fn).length : this.db.prepare(`SELECT COUNT(*) as c FROM "${col}"`).get()?.c || 0;
  }

  insert(col, rec) {
    this._ensureTable(col);
    rec.created_at = rec.created_at || new Date().toISOString();
    const id = rec.id || require('uuid').v4();
    rec.id = id;
    this.db.prepare(`INSERT OR REPLACE INTO "${col}" (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(id, JSON.stringify(rec), rec.created_at, rec.updated_at || null);
    return rec;
  }

  insertMany(col, recs) {
    this._ensureTable(col);
    const now = new Date().toISOString();
    const insert = this.db.prepare(`INSERT OR REPLACE INTO "${col}" (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`);
    const tx = this.db.transaction((items) => {
      for (const rec of items) {
        rec.created_at = rec.created_at || now;
        rec.id = rec.id || require('uuid').v4();
        insert.run(rec.id, JSON.stringify(rec), rec.created_at, rec.updated_at || null);
      }
    });
    tx(recs);
    return recs;
  }

  update(col, id, updates) {
    this._ensureTable(col);
    const row = this.db.prepare(`SELECT data FROM "${col}" WHERE id = ?`).get(id);
    if (!row) return null;
    const existing = JSON.parse(row.data);
    const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
    this.db.prepare(`UPDATE "${col}" SET data = ?, updated_at = ? WHERE id = ?`)
      .run(JSON.stringify(merged), merged.updated_at, id);
    return merged;
  }

  upsert(col, id, rec) {
    const existing = this.getById(col, id);
    return existing ? this.update(col, id, rec) : this.insert(col, { id, ...rec });
  }

  remove(col, id) {
    this._ensureTable(col);
    const result = this.db.prepare(`DELETE FROM "${col}" WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  removeWhere(col, fn) {
    this._ensureTable(col);
    const toRemove = this.find(col, fn);
    if (toRemove.length === 0) return 0;
    const del = this.db.prepare(`DELETE FROM "${col}" WHERE id = ?`);
    const tx = this.db.transaction((ids) => {
      for (const id of ids) del.run(id);
    });
    tx(toRemove.map(r => r.id));
    return toRemove.length;
  }

  async transaction(fn) {
    const sqliteTx = this.db.transaction(() => fn(this));
    return sqliteTx();
  }

  _ensureTable(col) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS "${col}" (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created_at TEXT,
        updated_at TEXT
      )
    `);
  }
}

// ============================================================
// JSON Adapter（備用，向後相容）
// ============================================================
class JsonAdapter {
  constructor(dataDir, collections = {}) {
    this.dataDir = dataDir;
    this.dbFile = path.join(dataDir, 'db.json');
    this.defaultCollections = collections;
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
  }

  _load() {
    try {
      if (fs.existsSync(this.dbFile)) {
        const stored = JSON.parse(fs.readFileSync(this.dbFile, 'utf-8'));
        return { ...JSON.parse(JSON.stringify(this.defaultCollections)), ...stored };
      }
    } catch (e) {
      console.error('[DB] 讀取失敗:', e.message);
    }
    return JSON.parse(JSON.stringify(this.defaultCollections));
  }

  _save(data) {
    fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  getAll(col, opts = {}) {
    let rows = this._load()[col] || [];
    if (opts.search && opts.searchFields) {
      const q = opts.search.toLowerCase();
      rows = rows.filter(r => opts.searchFields.some(f => (r[f] || '').toLowerCase().includes(q)));
    }
    if (opts.where) {
      Object.entries(opts.where).forEach(([k, v]) => {
        if (v !== undefined && v !== '') rows = rows.filter(r => r[k] === v);
      });
    }
    if (opts.sortBy) {
      const dir = opts.sortDir === 'asc' ? 1 : -1;
      rows.sort((a, b) => {
        const av = a[opts.sortBy] || '', bv = b[opts.sortBy] || '';
        return typeof av === 'number' ? (av - bv) * dir : String(av).localeCompare(String(bv)) * dir;
      });
    }
    const total = rows.length;
    if (opts.page && opts.limit) {
      const offset = (opts.page - 1) * opts.limit;
      rows = rows.slice(offset, offset + opts.limit);
      return { data: rows, total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit) };
    }
    return opts.paginated ? { data: rows, total } : rows;
  }

  getById(col, id) {
    return (this._load()[col] || []).find(r => r.id === id) || null;
  }

  find(col, fn) { return (this._load()[col] || []).filter(fn); }
  findOne(col, fn) { return (this._load()[col] || []).find(fn) || null; }
  count(col, fn) { return fn ? this.find(col, fn).length : this.getAll(col).length; }

  insert(col, rec) {
    const data = this._load();
    if (!data[col]) data[col] = [];
    rec.created_at = rec.created_at || new Date().toISOString();
    data[col].push(rec);
    this._save(data);
    return rec;
  }

  insertMany(col, recs) {
    const data = this._load();
    if (!data[col]) data[col] = [];
    const now = new Date().toISOString();
    recs.forEach(r => { r.created_at = r.created_at || now; data[col].push(r); });
    this._save(data);
    return recs;
  }

  update(col, id, updates) {
    const data = this._load();
    if (!data[col]) return null;
    const idx = data[col].findIndex(r => r.id === id);
    if (idx === -1) return null;
    data[col][idx] = { ...data[col][idx], ...updates, updated_at: new Date().toISOString() };
    this._save(data);
    return data[col][idx];
  }

  upsert(col, id, rec) {
    const existing = this.getById(col, id);
    return existing ? this.update(col, id, rec) : this.insert(col, { id, ...rec });
  }

  remove(col, id) {
    const data = this._load();
    if (!data[col]) return false;
    const idx = data[col].findIndex(r => r.id === id);
    if (idx === -1) return false;
    data[col].splice(idx, 1);
    this._save(data);
    return true;
  }

  removeWhere(col, fn) {
    const data = this._load();
    if (!data[col]) return 0;
    const before = data[col].length;
    data[col] = data[col].filter(r => !fn(r));
    this._save(data);
    return before - data[col].length;
  }

  async transaction(fn) {
    try { return await fn(this); }
    catch (e) { throw e; }
  }
}

// 工廠函數
function createAdapter(config = {}) {
  // 預設使用 SQLite
  const type = config.type || 'sqlite';
  if (type === 'json') {
    return new JsonAdapter(config.dataDir || path.join(__dirname, '..', 'data'), config.collections || {});
  }
  return new SqliteAdapter(config.dataDir || path.join(__dirname, '..', 'data'), config.collections || {});
}

module.exports = { JsonAdapter, SqliteAdapter, createAdapter };

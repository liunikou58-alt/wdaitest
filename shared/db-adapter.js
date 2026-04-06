/**
 * 共用資料庫介面層 (Adapter Pattern)
 * 
 * 開發期：使用 JSON 檔案存儲
 * 正式環境：切換為 PostgreSQL（只需改 adapter）
 * 
 * 用法：
 *   const db = require('../shared/db-adapter');
 *   // 兩套系統共用同一個介面
 */
const fs = require('fs');
const path = require('path');

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

  // 交易模擬（JSON 模式下用 try/catch 包裝）
  async transaction(fn) {
    try { return await fn(this); }
    catch (e) { throw e; }
  }
}

/**
 * PostgreSQL Adapter（骨架，正式環境啟用）
 * 介面完全相同，只需切換 adapter
 */
class PgAdapter {
  constructor(connectionString) {
    this.connStr = connectionString;
    // const { Pool } = require('pg');
    // this.pool = new Pool({ connectionString });
    console.log('[DB] PostgreSQL adapter 已準備（尚未啟用）');
  }

  // TODO: 實作所有相同介面
  // getAll, getById, find, findOne, insert, update, remove...
  // 使用 SQL 查詢替代 JSON 操作
}

// 工廠函數
function createAdapter(config = {}) {
  if (config.type === 'pg' && config.connectionString) {
    return new PgAdapter(config.connectionString);
  }
  return new JsonAdapter(config.dataDir || path.join(__dirname, '..', 'data'), config.collections || {});
}

module.exports = { JsonAdapter, PgAdapter, createAdapter };

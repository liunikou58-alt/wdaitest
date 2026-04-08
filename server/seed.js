/**
 * ProposalFlow AI — 種子資料（6 用戶版）
 * 每位用戶有獨立的 Gemini API Key
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const { DEPARTMENT_MAP } = require('../shared/permissions');

function seed() {
  // 建立部門（使用共用定義）
  if (db.getAll('departments').length === 0) {
    Object.entries(DEPARTMENT_MAP).forEach(([key, val]) => {
      db.insert('departments', { id: uuidv4(), key, name: val.name, icon: val.icon, sort_order: val.sort });
    });
    console.log(`[Seed] 已建立 ${Object.keys(DEPARTMENT_MAP).length} 個部門`);
  }

  // 建立 6 位用戶帳號（每人綁定一組 Gemini Key）
  if (db.getAll('users').length === 0) {
    const getDeptId = (key) => {
      const d = db.findOne('departments', d => d.key === key || d.name === DEPARTMENT_MAP[key]?.name);
      return d?.id || null;
    };

    const defaultUsers = [
      { username: 'mei',    password: 'mei2026',     display_name: 'Mei',    role: 'manager', dept: 'planning', email: 'mei@wdmc.com',    gemini_key_index: 1 },
      { username: 'Conny',  password: 'Conny2026',   display_name: 'Conny',  role: 'senior',  dept: 'planning', email: 'conny@wdmc.com',  gemini_key_index: 2 },
      { username: 'Andrea', password: 'Andrea2026',  display_name: 'Andrea', role: 'senior',  dept: 'design',   email: 'andrea@wdmc.com', gemini_key_index: 3 },
      { username: 'Alice',  password: 'Alice226',    display_name: 'Alice',  role: 'staff',   dept: 'planning', email: 'alice@wdmc.com',  gemini_key_index: 4 },
      { username: 'ceo',    password: 'wdmcceo2026', display_name: '執行長', role: 'ceo',     dept: 'management', email: 'ceo@wdmc.com',  gemini_key_index: 5 },
      { username: 'test',   password: 'test2026',    display_name: '測試帳號', role: 'manager', dept: 'planning', email: 'test@wdmc.com', gemini_key_index: 6 },
    ];

    const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#ec4899'];
    defaultUsers.forEach((u, i) => {
      db.insert('users', {
        id: uuidv4(), username: u.username, password_hash: bcrypt.hashSync(u.password, 10),
        display_name: u.display_name, email: u.email,
        role: u.role, department_id: getDeptId(u.dept), is_active: true,
        avatar_color: colors[i % colors.length],
        gemini_key_index: u.gemini_key_index,
      });
    });
    console.log(`[Seed] 已建立 ${defaultUsers.length} 個用戶帳號（各自綁定獨立 Gemini Key）`);
  }
}

module.exports = seed;

/**
 * ProposalFlow AI — 種子資料（升級版 6 角色）
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

  // 建立預設帳號
  if (db.getAll('users').length === 0) {
    const pw = bcrypt.hashSync('wdmc2026', 10);
    const getDeptId = (key) => {
      const d = db.findOne('departments', d => d.key === key || d.name === DEPARTMENT_MAP[key]?.name);
      return d?.id || null;
    };

    const defaultUsers = [
      { username: 'ceo', password: 'wdmc2026', display_name: '執行長', role: 'ceo', dept: 'management', email: 'ceo@wdmc.com' },
      { username: 'director', password: 'wdmc2026', display_name: '總監', role: 'director', dept: 'management', email: 'director@wdmc.com' },
      { username: 'admin00', password: 'wdmc00', display_name: '企畫主管', role: 'manager', dept: 'planning', email: 'pm@wdmc.com' },
      { username: 'admin01', password: 'wdmc01', display_name: '資深設計師', role: 'senior', dept: 'design', email: 'design@wdmc.com' },
      { username: 'admin02', password: 'wdmc02', display_name: '企畫專員', role: 'staff', dept: 'planning', email: 'planner@wdmc.com' },
      { username: 'admin03', password: 'wdmc03', display_name: '企畫助理', role: 'assistant', dept: 'planning', email: 'assist@wdmc.com' },
    ];

    const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#14b8a6'];
    defaultUsers.forEach((u, i) => {
      db.insert('users', {
        id: uuidv4(), username: u.username, password_hash: bcrypt.hashSync(u.password, 10),
        display_name: u.display_name, email: u.email,
        role: u.role, department_id: getDeptId(u.dept), is_active: true,
        avatar_color: colors[i % colors.length],
      });
    });
    console.log(`[Seed] 已建立 ${defaultUsers.length} 個預設帳號`);
  }
}

module.exports = seed;

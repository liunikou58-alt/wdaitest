/**
 * ProposalFlow AI Auth Routes（升級版 RBAC）
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware, JWT_SECRET, requirePermission, requireMinRole } = require('../middleware/auth');
const { ROLE_LABELS, ROLE_LEVELS, hasRoleLevel, PF_PERMISSIONS, hasPermission } = require('../../shared/permissions');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號密碼' });
  const user = db.findOne('users', u => u.username === username && u.is_active);
  if (!user) return res.status(401).json({ error: '帳號不存在或已停用' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: '密碼錯誤' });

  const dept = user.department_id ? db.getById('departments', user.department_id) : null;
  const token = jwt.sign({
    id: user.id, username: user.username, role: user.role,
    display_name: user.display_name, department_id: user.department_id,
    department_name: dept?.name || null
  }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token, user: {
      id: user.id, username: user.username, display_name: user.display_name,
      role: user.role, role_label: ROLE_LABELS[user.role] || user.role,
      department_name: dept?.name || null,
    }
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    ...req.user,
    role_label: ROLE_LABELS[req.user.role] || req.user.role,
    role_level: ROLE_LEVELS[req.user.role] || 0,
  });
});

// GET /api/auth/roles
router.get('/roles', authMiddleware, (req, res) => {
  const myLevel = ROLE_LEVELS[req.user.role] || 0;
  const roles = Object.entries(ROLE_LABELS)
    .map(([id, label]) => ({ id, label, level: ROLE_LEVELS[id] }))
    .filter(r => r.level <= myLevel);
  res.json(roles);
});

// GET /api/auth/permissions
router.get('/permissions', authMiddleware, (req, res) => {
  const perms = {};
  for (const [mod, actions] of Object.entries(PF_PERMISSIONS)) {
    perms[mod] = {};
    for (const action of Object.keys(actions)) {
      perms[mod][action] = hasPermission(req.user, mod, action, PF_PERMISSIONS);
    }
  }
  res.json(perms);
});

// === 使用者管理 ===
router.get('/users', authMiddleware, requireMinRole('director'), (req, res) => {
  const users = db.getAll('users').map(u => {
    const dept = u.department_id ? db.getById('departments', u.department_id) : null;
    return { ...u, password_hash: undefined, department_name: dept?.name || null, role_label: ROLE_LABELS[u.role] || u.role };
  });
  res.json(users);
});

router.post('/users', authMiddleware, requireMinRole('ceo'), (req, res) => {
  const { username, password, display_name, role, department_id, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: '缺少帳號或密碼' });
  if (db.findOne('users', u => u.username === username)) return res.status(409).json({ error: '帳號已存在' });
  if (ROLE_LEVELS[role] > ROLE_LEVELS[req.user.role]) return res.status(403).json({ error: '無法建立更高權限帳號' });

  const user = db.insert('users', {
    id: uuidv4(), username, password_hash: bcrypt.hashSync(password, 10),
    display_name: display_name || username, email: email || '',
    role: role || 'staff', department_id: department_id || null, is_active: true,
  });
  res.status(201).json({ ...user, password_hash: undefined });
});

router.put('/users/:id', authMiddleware, requireMinRole('director'), (req, res) => {
  const target = db.getById('users', req.params.id);
  if (!target) return res.status(404).json({ error: '使用者不存在' });
  if (req.user.role !== 'ceo' && ROLE_LEVELS[target.role] >= ROLE_LEVELS[req.user.role]) {
    return res.status(403).json({ error: '無法編輯同級或更高權限帳號' });
  }
  const updates = { ...req.body };
  if (updates.password) { updates.password_hash = bcrypt.hashSync(updates.password, 10); delete updates.password; }
  if (updates.role && ROLE_LEVELS[updates.role] > ROLE_LEVELS[req.user.role]) {
    return res.status(403).json({ error: '無法提升角色超過自己' });
  }
  const updated = db.update('users', req.params.id, updates);
  res.json({ ...updated, password_hash: undefined });
});

// === 部門管理 ===
router.get('/departments', authMiddleware, (req, res) => {
  res.json(db.getAll('departments').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
});

router.post('/departments', authMiddleware, requireMinRole('ceo'), (req, res) => {
  const { name, icon } = req.body;
  const dept = db.insert('departments', { id: uuidv4(), name, icon: icon || '🏢', sort_order: 99 });
  res.status(201).json(dept);
});

module.exports = router;

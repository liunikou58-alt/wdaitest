const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/members
router.get('/', authMiddleware, (req, res) => {
  const members = db.find('project_members', m => m.project_id === req.params.projectId);
  const enriched = members.map(m => {
    const user = db.getById('users', m.user_id);
    return { ...m, display_name: user?.display_name || '未知', username: user?.username || '', role: user?.role || '' };
  });
  res.json(enriched);
});

// POST /api/projects/:projectId/members — 加入成員
router.post('/', authMiddleware, (req, res) => {
  const { user_id, project_role } = req.body;
  const existing = db.findOne('project_members', m => m.project_id === req.params.projectId && m.user_id === user_id);
  if (existing) return res.status(409).json({ error: '已是專案成員' });
  const member = db.insert('project_members', {
    id: uuidv4(), project_id: req.params.projectId,
    user_id, project_role: project_role || 'member'
  });
  // 紀錄操作
  const adder = db.getById('users', req.user.id);
  const added = db.getById('users', user_id);
  db.insert('activity_logs', {
    id: uuidv4(), project_id: req.params.projectId, user_id: req.user.id,
    action: 'add_member', detail: `${adder?.display_name} 加入 ${added?.display_name} 為專案成員`
  });
  res.status(201).json(member);
});

// DELETE /api/projects/:projectId/members/:memberId
router.delete('/:memberId', authMiddleware, (req, res) => {
  db.remove('project_members', req.params.memberId);
  res.json({ success: true });
});

// === 操作紀錄 ===

// GET /api/projects/:projectId/activities
router.get('/activities', authMiddleware, (req, res) => {
  const logs = db.find('activity_logs', l => l.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 50);
  const enriched = logs.map(l => {
    const user = db.getById('users', l.user_id);
    return { ...l, display_name: user?.display_name || '系統' };
  });
  res.json(enriched);
});

// === 評論系統 ===

// GET /api/projects/:projectId/comments?step=analysis
router.get('/comments', authMiddleware, (req, res) => {
  const { step } = req.query;
  let comments = db.find('comments', c => c.project_id === req.params.projectId);
  if (step) comments = comments.filter(c => c.step === step);
  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const enriched = comments.map(c => {
    const user = db.getById('users', c.user_id);
    return { ...c, display_name: user?.display_name || '匿名', avatar: user?.display_name?.[0] || '?' };
  });
  res.json(enriched);
});

// POST /api/projects/:projectId/comments
router.post('/comments', authMiddleware, (req, res) => {
  const { step, content } = req.body;
  const comment = db.insert('comments', {
    id: uuidv4(), project_id: req.params.projectId,
    step: step || 'general', user_id: req.user.id, content
  });
  const user = db.getById('users', req.user.id);
  res.status(201).json({ ...comment, display_name: user?.display_name || '匿名' });
});

module.exports = router;

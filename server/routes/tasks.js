const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/tasks
router.get('/', authMiddleware, (req, res) => {
  const { department_id, status } = req.query;
  let tasks = db.find('tasks', t => t.project_id === req.params.projectId);
  if (department_id) tasks = tasks.filter(t => t.department_id === department_id);
  if (status) tasks = tasks.filter(t => t.status === status);
  tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const enriched = tasks.map(t => {
    const dept = t.department_id ? db.getById('departments', t.department_id) : null;
    const assignee = t.assignee_id ? db.getById('users', t.assignee_id) : null;
    return { ...t, department_name: dept?.name || '', department_icon: dept?.icon || '', assignee_name: assignee?.display_name || '' };
  });
  res.json(enriched);
});

// POST /api/projects/:projectId/tasks
router.post('/', authMiddleware, (req, res) => {
  const { title, description, department_id, assignee_id, parent_task_id, priority, due_date } = req.body;
  const task = db.insert('tasks', {
    id: uuidv4(), project_id: req.params.projectId,
    title: title || '', description: description || '',
    department_id: department_id || null, assignee_id: assignee_id || null,
    parent_task_id: parent_task_id || null,
    priority: priority || 'medium', status: 'todo',
    due_date: due_date || '', completed_at: null, sort_order: 99
  });
  // 操作紀錄
  db.insert('activity_logs', {
    id: uuidv4(), project_id: req.params.projectId, user_id: req.user.id,
    action: 'create_task', detail: `建立任務：${title}`
  });
  res.status(201).json(task);
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authMiddleware, (req, res) => {
  const updates = { ...req.body };
  if (updates.status === 'done' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  const updated = db.update('tasks', req.params.taskId, updates);
  if (!updated) return res.status(404).json({ error: '任務不存在' });

  // 操作紀錄
  if (req.body.status) {
    const statusLabels = { todo: '待辦', in_progress: '進行中', review: '待審核', done: '已完成' };
    db.insert('activity_logs', {
      id: uuidv4(), project_id: req.params.projectId, user_id: req.user.id,
      action: 'update_task', detail: `更新「${updated.title}」→ ${statusLabels[updated.status] || updated.status}`
    });
  }
  res.json(updated);
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authMiddleware, (req, res) => {
  const task = db.getById('tasks', req.params.taskId);
  db.remove('tasks', req.params.taskId);
  // 刪除子任務
  db.removeWhere('tasks', t => t.parent_task_id === req.params.taskId);
  if (task) {
    db.insert('activity_logs', {
      id: uuidv4(), project_id: req.params.projectId, user_id: req.user.id,
      action: 'delete_task', detail: `刪除任務：${task.title}`
    });
  }
  res.json({ success: true });
});

// PUT /api/projects/:projectId/tasks/reorder
router.put('/batch/reorder', authMiddleware, (req, res) => {
  const { tasks } = req.body; // [{ id, status, sort_order }]
  if (!tasks) return res.status(400).json({ error: '缺少 tasks 參數' });
  tasks.forEach(({ id, status, sort_order }) => {
    const updates = { sort_order };
    if (status) updates.status = status;
    if (status === 'done') updates.completed_at = new Date().toISOString();
    db.update('tasks', id, updates);
  });
  res.json({ success: true });
});

module.exports = router;

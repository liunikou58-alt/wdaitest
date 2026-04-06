/**
 * ProposalFlow AI — 評選標準與配分 CRUD API
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/evaluation-criteria
router.get('/', authMiddleware, (req, res) => {
  const criteria = db.find('evaluation_criteria', c => c.project_id === req.params.projectId)
    .sort((a, b) => (a.seq || 0) - (b.seq || 0));
  res.json(criteria);
});

// POST /api/projects/:projectId/evaluation-criteria
router.post('/', authMiddleware, (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: '需提供 items 陣列' });
  }

  // 先清掉舊的
  db.removeWhere('evaluation_criteria', c => c.project_id === req.params.projectId);

  // 新增所有項目
  const saved = items.map((item, i) => {
    return db.insert('evaluation_criteria', {
      id: uuidv4(),
      project_id: req.params.projectId,
      seq: i + 1,
      item_name: item.item_name || '',
      description: item.description || '',
      weight: Number(item.weight) || 0,
      source: item.source || 'manual', // manual | ai
    });
  });

  res.json(saved);
});

// DELETE /api/projects/:projectId/evaluation-criteria
router.delete('/', authMiddleware, (req, res) => {
  db.removeWhere('evaluation_criteria', c => c.project_id === req.params.projectId);
  res.json({ success: true });
});

module.exports = router;

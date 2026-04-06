const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/bid
router.get('/', (req, res) => {
  const record = db.findOne('bid_records', b => b.project_id === req.params.projectId);
  res.json(record || null);
});

// POST /api/projects/:projectId/bid
router.post('/', (req, res) => {
  const { bid_date, result, review_notes, presentation_date, presentation_notes } = req.body;
  // 若已存在則更新
  const existing = db.findOne('bid_records', b => b.project_id === req.params.projectId);
  if (existing) {
    const updated = db.update('bid_records', existing.id, req.body);
    return res.json(updated);
  }
  const record = db.insert('bid_records', {
    id: uuidv4(), project_id: req.params.projectId,
    bid_date: bid_date || '', result: result || '',
    review_notes: review_notes || '',
    presentation_date: presentation_date || '',
    presentation_notes: presentation_notes || ''
  });
  // 更新專案狀態
  if (result === 'won') db.update('projects', req.params.projectId, { status: 'won' });
  if (result === 'lost') db.update('projects', req.params.projectId, { status: 'lost' });
  if (!result) db.update('projects', req.params.projectId, { status: 'bidding' });
  res.status(201).json(record);
});

// PUT /api/projects/:projectId/bid
router.put('/', (req, res) => {
  const existing = db.findOne('bid_records', b => b.project_id === req.params.projectId);
  if (!existing) return res.status(404).json({ error: '無投標紀錄' });
  const updated = db.update('bid_records', existing.id, req.body);
  if (req.body.result === 'won') db.update('projects', req.params.projectId, { status: 'won' });
  if (req.body.result === 'lost') db.update('projects', req.params.projectId, { status: 'lost' });
  res.json(updated);
});

module.exports = router;

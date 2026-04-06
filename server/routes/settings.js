const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// === 風格關鍵詞（全域設定） ===

// GET /api/settings/style-keywords
router.get('/style-keywords', (req, res) => {
  const keywords = db.getAll('style_keywords')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  res.json(keywords);
});

// POST /api/settings/style-keywords
router.post('/style-keywords', (req, res) => {
  const { keyword } = req.body;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: '請輸入關鍵字' });
  }
  // 檢查是否已存在
  const exists = db.find('style_keywords', k => k.keyword === keyword.trim());
  if (exists.length > 0) {
    return res.status(400).json({ error: '此關鍵字已存在' });
  }
  const kw = db.insert('style_keywords', {
    id: uuidv4(),
    keyword: keyword.trim(),
    created_at: new Date().toISOString()
  });
  res.status(201).json(kw);
});

// DELETE /api/settings/style-keywords/:id
router.delete('/style-keywords/:id', (req, res) => {
  const success = db.remove('style_keywords', req.params.id);
  if (!success) return res.status(404).json({ error: '關鍵字不存在' });
  res.json({ success: true });
});

module.exports = router;

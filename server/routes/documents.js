const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router({ mergeParams: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'data', 'uploads', req.params.projectId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // 修正中文檔名亂碼：multer 預設使用 latin1 編碼
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.xlsx', '.xls'];
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// GET /api/projects/:projectId/documents
router.get('/', (req, res) => {
  const docs = db.find('documents', d => d.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.uploaded_at || b.created_at) - new Date(a.uploaded_at || a.created_at));
  res.json(docs);
});

// POST /api/projects/:projectId/documents — 多檔上傳
router.post('/', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '請選擇至少一個檔案' });
  }
  const defaultCategory = req.body.category || 'other';
  const inserted = req.files.map(file => {
    // 修正中文檔名亂碼
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase().replace('.', '');

    // 智能分類：根據檔名自動修正分類（後端保險機制）
    let category = defaultCategory;
    const nameLower = originalName.toLowerCase();
    if (nameLower.includes('評審') || nameLower.includes('審查') || nameLower.includes('評選') || nameLower.includes('須知')) {
      category = 'evaluation';
    } else if (nameLower.includes('標價') || nameLower.includes('預算') || nameLower.includes('報價') || nameLower.includes('經費') || nameLower.includes('價格')) {
      category = 'budget_sheet';
    } else if (nameLower.includes('契約') || nameLower.includes('合約')) {
      category = 'contract';
    }
    // 如果檔名沒有匹配到特殊關鍵字，保持前端傳來的分類

    return db.insert('documents', {
      id: uuidv4(),
      project_id: req.params.projectId,
      filename: originalName,
      file_path: file.path,
      file_size: file.size,
      file_type: ext,
      category,
      uploaded_at: new Date().toISOString()
    });
  });
  res.status(201).json(inserted);
});

// DELETE /api/documents/:docId
router.delete('/:docId', (req, res) => {
  const doc = db.getById('documents', req.params.docId);
  if (!doc) return res.status(404).json({ error: '文件不存在' });
  if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  db.remove('documents', req.params.docId);
  res.json({ success: true });
});

// === 文字需求 API（商業案件用） ===

// GET /api/projects/:projectId/text-requirements
router.get('/text-requirements', (req, res) => {
  const reqs = db.find('text_requirements', t => t.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(reqs);
});

// POST /api/projects/:projectId/text-requirements
router.post('/text-requirements', (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: '請輸入文字內容' });
  }
  const textReq = db.insert('text_requirements', {
    id: uuidv4(),
    project_id: req.params.projectId,
    content: content.trim(),
    created_at: new Date().toISOString()
  });
  res.status(201).json(textReq);
});

// DELETE /api/projects/:projectId/text-requirements/:id
router.delete('/text-requirements/:id', (req, res) => {
  const success = db.remove('text_requirements', req.params.id);
  if (!success) return res.status(404).json({ error: '紀錄不存在' });
  res.json({ success: true });
});

module.exports = router;

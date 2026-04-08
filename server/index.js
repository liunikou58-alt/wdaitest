require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');

// 初始化資料庫（自動建表）
require('./db');

// 種子資料（預設管理員 + 部門）
require('./seed')();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// 全域 userId + keyIndex 提取（不強制驗證，僅用於 AI Key 分配）
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'proposalflow-secret-key-2026';
const { runWithContext } = require('./ai-provider');
app.use((req, res, next) => {
  let userId = null;
  let keyIndex = null;
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
      userId = decoded.id;
      keyIndex = decoded.gemini_key_index || null;
      req.userId = userId;
      req.keyIndex = keyIndex;
    }
  } catch { /* ignore */ }
  // 注入 AsyncLocalStorage，讓 ai-provider.js 自動取得
  runWithContext({ userId, keyIndex }, () => next());
});

// 靜態檔案（上傳的文件）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Auth Routes（不需要 JWT）
app.use('/api/auth', require('./routes/auth'));

// API Routes
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects/:projectId/documents', require('./routes/documents'));
app.use('/api/projects/:projectId/analyze', require('./routes/analysis'));
app.use('/api/projects/:projectId/costs', require('./routes/costs'));
app.use('/api/projects/:projectId/themes', require('./routes/themes'));
app.use('/api/projects/:projectId/highlights', require('./routes/highlights'));
app.use('/api/projects/:projectId/proposal', require('./routes/proposal'));
app.use('/api/projects/:projectId/bid', require('./routes/bid'));
app.use('/api/projects/:projectId/bid-prep', require('./routes/bid-prep'));
app.use('/api/projects/:projectId/presentation', require('./routes/presentation'));
app.use('/api/projects/:projectId/plan-summary', require('./routes/plan-summary'));
app.use('/api/projects/:projectId/proposal-writing', require('./routes/proposal-writing'));
app.use('/api/projects/:projectId/collab', require('./routes/collaboration'));
app.use('/api/projects/:projectId/tasks', require('./routes/tasks'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/intel', require('./routes/intel'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/projects/:projectId/evaluation-criteria', require('./routes/evaluation-criteria'));
app.use('/api/projects/:projectId/ai-chat', require('./routes/ai-chat'));
app.use('/api/projects/:projectId/generate-image', require('./routes/image-gen'));
app.use('/api/ai', require('./routes/ai'));

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend build (for production / tunnel access)
const fs = require('fs');
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(clientBuild, 'index.html'));
    }
  });
}

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || '伺服器內部錯誤' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 WDAITEST 後端伺服器已啟動`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api/health\n`);
});

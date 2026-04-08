/**
 * ProposalFlow AI — AI 逐項追問對話 API
 * 支援針對特定子活動/項目的深度追問
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const aiEngine = require('../services/ai-engine');

const router = express.Router({ mergeParams: true });

// POST /api/projects/:projectId/ai-chat
router.post('/', authMiddleware, async (req, res) => {
  const { context, subActivityName, question, history } = req.body;

  if (!question) {
    return res.status(400).json({ error: '請提供追問問題' });
  }

  const project = db.getById('projects', req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: '專案不存在' });
  }

  try {
    // 組裝上下文
    const projectContext = `
專案名稱：${project.name}
案件類型：${project.case_type === 'commercial' ? '商案' : '標案'}
機關/公司：${project.agency || project.company || '未指定'}
活動類型：${project.event_type || '未指定'}
預算：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未設定'}
活動日期：${project.event_date || '未設定'}
`;

    const subContext = subActivityName
      ? `\n目前討論的子活動：${subActivityName}\n詳細背景：${context || ''}`
      : `\n討論背景：${context || ''}`;

    // 建構對話歷史
    const messages = [];
    if (Array.isArray(history)) {
      history.forEach(h => {
        messages.push({ role: h.role, content: h.content });
      });
    }

    const systemPrompt = `你是 WDMC AI 活動企劃助手。以下是專案資訊：
${projectContext}
${subContext}

用戶正在針對此活動項目向你追問更多細節。請根據上下文提供精準、實用、具體的回答。
- 如果被問到推薦的廠商/片單/攤販/資源，請提供具體名稱和估價
- 如果被問到執行細節，請提供完整的規劃說明
- 回覆使用繁體中文，保持專業但友善的語氣
- 回覆不要太長，200-400字左右即可除非內容確實需要更長`;

    const result = await aiEngine.chat(systemPrompt, question, messages, req.user?.id, req.user?.gemini_key_index);

    res.json({
      answer: result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AI Chat Error]', err);
    res.status(500).json({ error: 'AI 回覆失敗: ' + (err.message || '未知錯誤') });
  }
});

module.exports = router;

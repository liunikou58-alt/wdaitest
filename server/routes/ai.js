const express = require('express');
const router = express.Router();
const { callAI, autoRoute, getAvailableModels, getUsageStats } = require('../services/ai-engine');

// GET /api/ai/models — 取得可用 AI 模型
router.get('/models', (req, res) => {
  res.json(getAvailableModels());
});

// GET /api/ai/usage — 取得使用量統計
router.get('/usage', (req, res) => {
  res.json(getUsageStats());
});

// POST /api/ai/chat — 與 AI 對話
router.post('/chat', async (req, res) => {
  try {
    const { message, model, taskType, systemPrompt } = req.body;
    if (!message) return res.status(400).json({ error: '請輸入訊息' });

    // 選擇模型
    const channel = model || autoRoute(taskType || 'chat');
    if (!channel) return res.status(503).json({ error: '沒有可用的 AI 模型，請設定 GROQ_API_KEY 或 OPENAI_API_KEY' });

    const defaultSystem = `你是 WDMC AI 助手，專精於政府標案、活動企劃、行銷策略。
你的能力：
1. 標案搜尋與匹配分析
2. 競爭對手追蹤與趨勢分析
3. 企劃書撰寫與預算編列
4. 投標策略建議

請用繁體中文回答，結構清晰，善用 markdown 格式。
回答要具體、專業、有數據支撐。`;

    const result = await callAI(message, {
      model: channel,
      systemPrompt: systemPrompt || defaultSystem,
      temperature: taskType === 'proposal' ? 0.7 : 0.3,
      maxTokens: taskType === 'proposal' ? 4000 : 2000,
    });

    res.json({
      content: result.content,
      model: result.model,
      modelName: getAvailableModels().find(m => m.id === result.model)?.name || result.model,
      tokens: result.tokens,
      layer: getAvailableModels().find(m => m.id === result.model)?.layer || 1,
    });
  } catch (err) {
    console.error('[AI Chat]', err.message);
    res.status(500).json({ error: 'AI 回應失敗：' + err.message });
  }
});

// POST /api/ai/generate — 企劃書生成（強制使用高階模型）
router.post('/generate', async (req, res) => {
  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: '請輸入提示' });

    const channel = autoRoute(type || 'proposal');
    if (!channel) return res.status(503).json({ error: '無可用模型' });

    const result = await callAI(prompt, {
      model: channel,
      temperature: 0.7,
      maxTokens: 4000,
      systemPrompt: `你是專業的活動企劃師，擅長撰寫政府標案企劃書。
請產生完整、專業、格式嚴謹的內容。使用繁體中文。
善用 markdown 格式，包含標題、列表、表格等。`,
    });

    res.json({
      content: result.content,
      model: result.model,
      tokens: result.tokens,
    });
  } catch (err) {
    res.status(500).json({ error: '生成失敗：' + err.message });
  }
});

module.exports = router;

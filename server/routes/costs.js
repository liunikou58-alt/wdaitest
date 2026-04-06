const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');
const { buildProjectContext } = require('../utils/prompt-context');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/costs
router.get('/', (req, res) => {
  const items = db.find('cost_estimates', c => c.project_id === req.params.projectId);
  res.json(items);
});

// POST /api/projects/:projectId/costs
router.post('/', (req, res) => {
  const { category, item_name, unit, quantity, unit_price, notes } = req.body;
  const item = db.insert('cost_estimates', {
    id: uuidv4(),
    project_id: req.params.projectId,
    category: category || '其他',
    item_name: item_name || '',
    unit: unit || '式',
    quantity: quantity || 1,
    unit_price: unit_price || 0,
    subtotal: (quantity || 1) * (unit_price || 0),
    notes: notes || ''
  });
  res.status(201).json(item);
});

// PUT /api/costs/:costId
router.put('/:costId', (req, res) => {
  const updates = { ...req.body };
  if (updates.quantity !== undefined && updates.unit_price !== undefined) {
    updates.subtotal = updates.quantity * updates.unit_price;
  }
  const updated = db.update('cost_estimates', req.params.costId, updates);
  if (!updated) return res.status(404).json({ error: '項目不存在' });
  res.json(updated);
});

// DELETE /api/costs/:costId
router.delete('/:costId', (req, res) => {
  db.remove('cost_estimates', req.params.costId);
  res.json({ success: true });
});

// POST /api/projects/:projectId/costs/ai-suggest — AI 成本建議
router.post('/ai-suggest', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (analyses.length === 0) {
      return res.status(400).json({ error: '請先進行 AI 需求分析' });
    }

    const analysis = JSON.parse(analyses[0].analysis_json);

    // 注入完整專案上下文
    const projectContext = buildProjectContext(projectId, {
      include: ['intel', 'analysis', 'themes', 'highlights', 'activities'],
      maxChars: 6000,
    });

    const prompt = `你是一位資深活動企劃成本估算專家。根據以下標案需求分析結果與專案背景，提出成本估算建議。

【重要】成本項目必須與已確定的主題方案、子活動、和亮點直接對應，不可產生泛用的成本項目。所有單價必須符合台灣 2026 年行情。

需求摘要：
- 預算：${analysis.summary?.budget || '未載明'}
- 期程：${analysis.summary?.duration || '未載明'}
- 地點：${analysis.summary?.location || '未載明'}
- 核心需求：${(analysis.coreRequirements || []).join('、')}

${projectContext ? `專案背景：\n${projectContext}\n` : ''}
請以 JSON 陣列格式輸出建議的成本項目（只輸出純 JSON，不要其他文字）：
[
  { "category": "人事費", "item_name": "項目名稱", "unit": "人/天", "quantity": 5, "unit_price": 3000, "notes": "備註說明" }
]

成本類別包含：人事費、場地費、設備費、設計印刷費、交通住宿費、餐飲費、雜支、管理費`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3 }
    );

    let aiResponse = result.content || '[]';
    let suggestions;
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResponse.trim();
      suggestions = JSON.parse(jsonStr);
    } catch {
      suggestions = [];
    }

    res.json(suggestions);
  } catch (error) {
    console.error('[AI] 成本建議失敗:', error);
    res.status(500).json({ error: '生成失敗', details: error.message });
  }
});

// POST /api/projects/:projectId/costs/import-quotation — 從報價清單匯入
router.post('/import-quotation', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (analyses.length === 0) {
      return res.status(400).json({ error: '請先進行 AI 需求分析' });
    }

    const analysis = JSON.parse(analyses[0].analysis_json);
    const quotationItems = analysis.quotation_items || [];

    if (quotationItems.length === 0) {
      return res.status(400).json({ error: '分析結果中未包含報價清單項目' });
    }

    const created = [];
    for (const item of quotationItems) {
      const costItem = db.insert('cost_estimates', {
        id: uuidv4(),
        project_id: projectId,
        category: '雜支',
        item_name: item.name || '',
        unit: item.unit || '式',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || (Number(item.quantity) || 1) * (Number(item.unit_price) || 0),
        notes: item.note || '從報價清單匯入',
      });
      created.push(costItem);
    }

    res.json({ imported: created.length, items: created });
  } catch (error) {
    console.error('[Costs] 匯入報價清單失敗:', error);
    res.status(500).json({ error: '匯入失敗', details: error.message });
  }
});

// POST /api/projects/:projectId/costs/auto-adjust — AI 自動調整金額使加總等於專案預算
router.post('/auto-adjust', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const budget = Number(project?.budget) || 0;

    if (!budget) {
      return res.status(400).json({ error: '專案未設定預算金額' });
    }

    const items = db.find('cost_estimates', c => c.project_id === projectId);
    if (items.length === 0) {
      return res.status(400).json({ error: '尚無成本項目' });
    }

    const currentTotal = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
    if (currentTotal === 0) {
      return res.status(400).json({ error: '各項小計均為 0，無法自動調整' });
    }

    // 按比例調整每一項
    const ratio = budget / currentTotal;
    const adjusted = [];
    for (const item of items) {
      const newSubtotal = Math.round((Number(item.subtotal) || 0) * ratio);
      const newUnitPrice = item.quantity > 0 ? Math.round(newSubtotal / item.quantity) : newSubtotal;
      const updated = db.update('cost_estimates', item.id, {
        unit_price: newUnitPrice,
        subtotal: item.quantity > 0 ? newUnitPrice * item.quantity : newSubtotal,
      });
      adjusted.push(updated);
    }

    res.json({ adjusted: adjusted.length, targetBudget: budget });
  } catch (error) {
    console.error('[Costs] 自動調整失敗:', error);
    res.status(500).json({ error: '調整失敗', details: error.message });
  }
});

module.exports = router;

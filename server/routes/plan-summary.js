const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');
const { parseAiJson } = require('../utils/parse-ai-json');
const { buildProjectContext } = require('../utils/prompt-context');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/plan-summary
router.get('/', (req, res) => {
  const summaries = db.find('plan_summaries', s => s.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (summaries.length === 0) return res.json(null);
  const summary = summaries[0];
  try {
    summary.suggestions = JSON.parse(summary.suggestions_json || '{}');
  } catch { summary.suggestions = {}; }
  // 確保 confirmed_items 和 criteria_mapping 回傳
  summary.confirmed_items = summary.confirmed_items || '[]';
  summary.criteria_mapping = summary.criteria_mapping || '{}';
  res.json(summary);
});

// POST /api/projects/:projectId/plan-summary/generate — 確認架構
router.post('/generate', (req, res) => {
  const projectId = req.params.projectId;
  const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
  const existing = db.find('plan_summaries', s => s.project_id === projectId);

  const suggestionsJson = existing.length > 0 ? existing[0].suggestions_json : '{}';
  const confirmedItems = existing.length > 0 ? (existing[0].confirmed_items || '[]') : '[]';
  const criteriaMapping = existing.length > 0 ? (existing[0].criteria_mapping || '{}') : '{}';

  db.removeWhere('plan_summaries', s => s.project_id === projectId);

  const summary = db.insert('plan_summaries', {
    id: uuidv4(),
    project_id: projectId,
    items_json: selectedData.length > 0 ? selectedData[0].items_json : '[]',
    suggestions_json: suggestionsJson,
    confirmed_items: confirmedItems,
    criteria_mapping: criteriaMapping,
    confirmed: true,
    created_at: new Date().toISOString()
  });

  res.json(summary);
});

// PUT /api/projects/:projectId/plan-summary/confirmed-items — 儲存逐項確認狀態
router.put('/confirmed-items', (req, res) => {
  const projectId = req.params.projectId;
  const { confirmed_items, criteria_mapping } = req.body;
  const existing = db.find('plan_summaries', s => s.project_id === projectId);
  if (existing.length > 0) {
    const updates = {};
    if (confirmed_items !== undefined) updates.confirmed_items = JSON.stringify(confirmed_items);
    if (criteria_mapping !== undefined) updates.criteria_mapping = JSON.stringify(criteria_mapping);
    db.update('plan_summaries', existing[0].id, updates);
    res.json({ success: true });
  } else {
    const summary = db.insert('plan_summaries', {
      id: uuidv4(),
      project_id: projectId,
      items_json: '[]',
      suggestions_json: '{}',
      confirmed_items: JSON.stringify(confirmed_items || []),
      criteria_mapping: JSON.stringify(criteria_mapping || {}),
      confirmed: false,
      created_at: new Date().toISOString()
    });
    res.json({ success: true, id: summary.id });
  }
});

// POST /api/projects/:projectId/plan-summary/suggestion/:subActivityKey — AI 執行建議
router.post('/suggestion/:subActivityKey', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const subKey = decodeURIComponent(req.params.subActivityKey);
    const project = db.getById('projects', projectId);

    // 從 key 中取得子活動名稱
    const subName = subKey.split('::')[1] || subKey;

    // 取得這個子活動的完整資訊（從 selected_sub_activities）
    let subDescription = '';
    let subEffect = '';
    let subThemeTitle = '';
    const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
    if (selectedData.length > 0) {
      try {
        const items = JSON.parse(selectedData[0].items_json) || [];
        const found = items.find(i => i.key === subKey || i.name === subName);
        if (found) {
          subDescription = found.description || '';
          subEffect = found.effect || '';
          subThemeTitle = found.themeTitle || '';
        }
      } catch {}
    }

    // 取得所有其他子活動（幫助 AI 理解整體活動架構）
    let otherSubNames = [];
    if (selectedData.length > 0) {
      try {
        const items = JSON.parse(selectedData[0].items_json) || [];
        otherSubNames = items.filter(i => i.name !== subName).map(i => i.name);
      } catch {}
    }

    const isTender = project?.case_type !== 'commercial';
    let contextHint = '';
    if (isTender) {
      const parts = [project?.agency, project?.department].filter(Boolean);
      if (parts.length) contextHint = `主辦單位：${parts.join(' ')}`;
    } else {
      const parts = [project?.company, project?.company_industry].filter(Boolean);
      if (parts.length) contextHint = `舉辦公司：${parts.join('（')}${parts.length > 1 ? '）' : ''}`;
    }

    const totalBudget = project?.budget ? Number(project.budget) : 0;
    // 估算這個子活動佔比（簡單平均）
    const subCount = otherSubNames.length + 1;
    const estimatedSubBudget = totalBudget > 0 ? Math.round(totalBudget / subCount) : 0;

    // 注入完整專案上下文（科室情報 + 分析報告 + 主題方案）
    const projectContext = buildProjectContext(projectId, {
      include: ['intel', 'analysis', 'themes', 'highlights'],
      maxChars: 8000,
    });

    const prompt = `你是一位資深活動執行專家與企劃撰寫顧問。請針對以下子活動，提供完整、具體、可直接放入企劃書的執行內容。

【重要】你的建議必須基於需求文件中的具體規格和要求，不可自行發明不存在的需求。

=== 活動基本資訊 ===
活動名稱：${project?.name || ''}
活動類型：${project?.event_type || ''}
${contextHint}
總預算：${totalBudget > 0 ? `${totalBudget.toLocaleString()} 元` : '未指定'}
活動日期：${project?.event_date || '未指定'}
整體架構包含：${[subName, ...otherSubNames].join('、')}

${projectContext ? `=== 專案深度背景 ===\n${projectContext}\n` : ''}
=== 本子活動詳情 ===
子活動名稱：${subName}
來自主題方案：${subThemeTitle}
活動描述：${subDescription}
預期效果：${subEffect}

=== 要求 ===
請以 JSON 格式輸出（只輸出純 JSON），必須包含以下所有欄位：
{
  "execution_direction": "簡要說明執行大方向（50字內）",

  "program_content": {
    "概述": "這個子活動的企劃撰寫方向與目的（80字內）",
    "具體項目": [
      {
        "項目名稱": "例如：海盜尋寶第一關",
        "內容說明": "詳細的執行方式（50字內）",
        "遊戲規則或流程": "具體的參與規則和勝出條件（50字內）",
        "所需設備": "需要的道具、設備清單",
        "人力配置": "需要幾位工作人員、什麼角色"
      }
    ]
  },

  "key_notes": "執行時特別注意事項（安全、法規、天候等，100字內）"
}

重要：
1. program_content.具體項目 至少要有 3-5 個具體的活動內容設計
2. 每個具體項目都要有可執行的詳細說明，不要只是概念描述
3. key_notes 要包含實際執行的注意事項`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.5, max_tokens: 6000 }
    );

    let aiResponse = result.content || '{}';
    let suggestion = parseAiJson(aiResponse, aiResponse);

    // 存入 plan_summaries
    const existing = db.find('plan_summaries', s => s.project_id === projectId);
    if (existing.length > 0) {
      let suggestions = {};
      try { suggestions = JSON.parse(existing[0].suggestions_json || '{}'); } catch {}
      suggestions[subKey] = suggestion;
      db.update('plan_summaries', existing[0].id, {
        suggestions_json: JSON.stringify(suggestions)
      });
    } else {
      const suggestions = { [subKey]: suggestion };
      db.insert('plan_summaries', {
        id: uuidv4(),
        project_id: projectId,
        items_json: '[]',
        suggestions_json: JSON.stringify(suggestions),
        confirmed: false,
        created_at: new Date().toISOString()
      });
    }

    res.json({ suggestion });
  } catch (error) {
    console.error('[AI] 執行建議失敗:', error);
    res.status(500).json({ error: '取得建議失敗', details: error.message });
  }
});

module.exports = router;

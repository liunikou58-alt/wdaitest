const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');
const { formatIntelForPrompt } = require('../services/dept-intelligence');
const { parseAiJson } = require('../utils/parse-ai-json');
const { buildProjectContext } = require('../utils/prompt-context');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/proposal-writing — 取得已儲存的企劃書內容
router.get('/', (req, res) => {
  const items = db.find('proposal_writing', pw => pw.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  if (items.length === 0) return res.json(null);
  const item = items[0];
  try { item.chapters = JSON.parse(item.chapters_json || '{}'); } catch { item.chapters = {}; }
  res.json(item);
});

// POST /api/projects/:projectId/proposal-writing/save — 儲存使用者編輯內容
router.post('/save', (req, res) => {
  const projectId = req.params.projectId;
  const { chapters } = req.body;
  db.removeWhere('proposal_writing', pw => pw.project_id === projectId);
  const item = db.insert('proposal_writing', {
    id: uuidv4(),
    project_id: projectId,
    chapters_json: JSON.stringify(chapters || {}),
    updated_at: new Date().toISOString()
  });
  res.json(item);
});

// POST /api/projects/:projectId/proposal-writing/generate/:subKey — AI 深度生成單一子活動企劃內容
router.post('/generate/:subKey', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const subKey = decodeURIComponent(req.params.subKey);
    const project = db.getById('projects', projectId);
    const subName = subKey.split('::')[1] || subKey;

    // 取得子活動完整資訊
    let subDescription = '', subEffect = '', subThemeTitle = '';
    let allSubNames = [];
    const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
    if (selectedData.length > 0) {
      try {
        const items = JSON.parse(selectedData[0].items_json) || [];
        const found = items.find(i => i.key === subKey || i.name === subName);
        if (found) { subDescription = found.description || ''; subEffect = found.effect || ''; subThemeTitle = found.themeTitle || ''; }
        allSubNames = items.map(i => i.name);
      } catch {}
    }

    // 取得分析資訊
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let analysisContext = '';
    if (analyses.length > 0) {
      try {
        const analysis = JSON.parse(analyses[0].analysis_json);
        analysisContext = `核心需求：${(analysis.coreRequirements || []).join('、')}\n預算：${analysis.summary?.budget || '未載明'}\n地點：${analysis.summary?.location || '未載明'}`;
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
    const subCount = allSubNames.length || 1;
    const estimatedSubBudget = totalBudget > 0 ? Math.round(totalBudget / subCount) : 0;

    // 注入完整專案上下文（科室情報 + 分析 + 主題 + 亮點）
    const projectContext = buildProjectContext(projectId, {
      include: ['intel', 'analysis', 'themes', 'highlights', 'evaluation'],
      maxChars: 12000,
    });

    const prompt = `你是一位頂尖的${isTender ? '政府標案' : '企業活動'}企劃撰寫專家。請針對以下子活動，撰寫完整的企劃書章節內容，格式必須可直接放入正式企劃書中。

【最重要】你的內容必須呼應需求文件中的具體規格，不可自行發明不存在的需求。所有設備、人力、獨具規格都必須單數合理、符合台灣行情。

=== 活動基本資訊 ===
活動名稱：${project?.name || ''}
活動類型：${project?.event_type || ''}
${contextHint}
總預算：${totalBudget > 0 ? `${totalBudget.toLocaleString()} 元` : '未指定'}
活動日期：${project?.event_date || '未指定'}
整體架構包含子活動：${allSubNames.join('、')}
${analysisContext}

${projectContext ? `=== 專案深度背景（科室情報 + 分析 + 主題 + 亮點） ===\n${projectContext}\n` : ''}

=== 本子活動 ===
名稱：${subName}
來自主題方案：${subThemeTitle}
描述：${subDescription}
預期效果：${subEffect}

=== 要求（以 JSON 格式輸出，只輸出純 JSON）===
{
  "chapter_title": "本章節標題（例如：主題闖關活動）",
  "chapter_intro": "章節導言（80-120字，說明這個活動的定位、目的與特色）",

  "activity_items": [
    {
      "item_name": "四字以內的項目名稱（例如：幸福敲敲樂）",
      "description": "執行方式描述（40-60字）",
      "rules": "具體的參與規則與過關條件（40-60字）",
      "props_list": ["道具1 × 數量", "道具2 × 數量"],
      "core_message": "傳達理念（一句話，10-15字，例如：學習接納各種情緒）",
      "space_requirement": "所需空間（例如：3m×3m 帳篷區）",
      "staff": "人力配置（例如：關主1人+助理1人）"
    }
  ],

  "suggested_timeline": [
    { "time": "時段（例如：14:00-14:20）", "content": "活動內容", "note": "備註" }
  ],

  "reward_plan": {
    "participation_rule": "參與規則（例如：每完成一關蓋章，集滿3章可兌換獎品）",
    "rewards": [
      { "item_name": "獎品名稱", "material": "材質", "size": "尺寸", "quantity": "數量", "estimated_price": "NT$xxx" }
    ]
  },

  "hardware_list": [
    { "item": "設備名稱", "spec": "規格", "quantity": "數量", "purpose": "用途" }
  ],

  "staff_plan": [
    { "role": "角色名稱", "count": "人數", "duty": "職責說明" }
  ],

  "recommended_vendors": [
    { "category": "類別", "vendor_type": "廠商類型", "search_keyword": "Google搜尋關鍵字", "price_range": "行情價" }
  ],

  "reference_cases": [
    { "case_name": "案例名稱", "organizer": "舉辦單位", "highlight": "值得參考的亮點", "search_keyword": "搜尋關鍵字" }
  ],

  "budget_detail": [
    { "item": "費用項目", "unit": "單位", "quantity": "數量", "unit_price": "單價", "subtotal": "小計" }
  ],

  "risk_notes": "注意事項（安全、法規、天候等，80字內）",
  "weather_backup": "雨備方案（50字內）"
}

重要規則：
1. activity_items 至少 3-5 個具體項目，每個都要有 core_message（傳達理念）
2. props_list 要列出具體道具名稱和數量
3. suggested_timeline 建議 6-10 個時段
4. hardware_list 至少 5 項實際需要的設備
5. budget_detail 至少 6 項費用明細，${estimatedSubBudget > 0 ? `控制在 ${estimatedSubBudget.toLocaleString()} 元以內` : '按合理行情估算'}
6. reward_plan 的 rewards 至少 3 種不同獎品
7. 所有內容必須呼應活動主題，語氣專業、適合放入正式企劃書`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.5, max_tokens: 16384 }
    );

    let aiResponse = result.content || '{}';
    let chapter = parseAiJson(aiResponse, { raw: aiResponse });

    // 儲存到 proposal_writing
    const existing = db.find('proposal_writing', pw => pw.project_id === projectId);
    if (existing.length > 0) {
      let chapters = {};
      try { chapters = JSON.parse(existing[0].chapters_json || '{}'); } catch {}
      chapters[subKey] = chapter;
      db.update('proposal_writing', existing[0].id, {
        chapters_json: JSON.stringify(chapters),
        updated_at: new Date().toISOString()
      });
    } else {
      const chapters = { [subKey]: chapter };
      db.insert('proposal_writing', {
        id: uuidv4(), project_id: projectId,
        chapters_json: JSON.stringify(chapters),
        updated_at: new Date().toISOString()
      });
    }

    res.json({ chapter });
  } catch (error) {
    console.error('[AI] 企劃書撰寫失敗:', error);
    res.status(500).json({ error: '生成失敗', details: error.message });
  }
});

// POST /api/projects/:projectId/proposal-writing/generate-all — 一鍵全部生成
router.post('/generate-all', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
    if (!selectedData.length) return res.status(400).json({ error: '尚未選取子活動' });

    const items = JSON.parse(selectedData[0].items_json || '[]');
    res.json({ total: items.length, message: '請逐一呼叫 generate/:subKey 以避免超時' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

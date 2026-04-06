const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');

const router = express.Router({ mergeParams: true });

// POST /api/projects/:projectId/proposal/generate — 生成企劃書結構
router.post('/generate', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const analyses = db.find('analyses', a => a.project_id === projectId);
    const selectedTheme = db.findOne('theme_proposals', t => t.project_id === projectId && t.is_selected === 1);
    const highlights = db.find('highlights', h => h.project_id === projectId && h.is_selected === 1)
      .sort((a, b) => a.sort_order - b.sort_order);
    const costs = db.find('cost_estimates', c => c.project_id === projectId);

    const analysis = analyses.length ? JSON.parse(analyses[0].analysis_json) : {};

    const prompt = `你是一位資深政府標案企劃書撰寫專家。根據以下資料，為每個章節生成企劃書的完整內容段落。

專案名稱：${project?.name || ''}
招標機關：${project?.agency || ''}
主題名稱：${selectedTheme?.title || '未選定'}
Slogan：${selectedTheme?.slogan || ''}
主題概念：${selectedTheme?.concept || ''}
核心需求：${(analysis.coreRequirements || []).join('、')}
企劃亮點：${highlights.map(h => h.title).join('、')}

請產出一份結構化的企劃書內容，以 JSON 格式輸出（只輸出純 JSON）：
{
  "cover": { "title": "封面標題", "subtitle": "副標題" },
  "chapters": [
    {
      "number": 1,
      "title": "章節標題",
      "content": "完整的章節內容段落（300-500字，可用 \\n 換行）"
    }
  ]
}

必須包含以下章節：
1. 專案理解與回應（展現對需求的深入理解）
2. 企劃主題與核心概念（闡述活動主軸）
3. 執行計畫與細部設計（具體活動內容）
4. 企劃亮點與創新特色（差異化競爭力）
5. 執行團隊與組織架構（組織能力）
6. 經費預估說明
7. 預期效益與社會影響`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4 }
    );

    let aiResponse = result.content || '';
    let proposal;
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResponse.trim();
      proposal = JSON.parse(jsonStr);
    } catch {
      proposal = { rawResponse: aiResponse };
    }

    db.update('projects', projectId, { status: 'layouting' });
    res.json(proposal);
  } catch (error) {
    console.error('[AI] 企劃書生成失敗:', error);
    res.status(500).json({ error: '生成失敗', details: error.message });
  }
});

module.exports = router;

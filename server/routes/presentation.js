const express = require('express');
const ai = require('../ai-provider');
const db = require('../db');

const router = express.Router({ mergeParams: true });

// POST /api/projects/:projectId/presentation/generate — AI 生成簡報大綱與講稿
router.post('/generate', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const selectedTheme = db.findOne('theme_proposals', t => t.project_id === projectId && t.is_selected === 1);
    const highlights = db.find('highlights', h => h.project_id === projectId && h.is_selected === 1);
    const analyses = db.find('analyses', a => a.project_id === projectId);
    const analysis = analyses.length ? JSON.parse(analyses[0].analysis_json) : {};

    const prompt = `你是一位專業的簡報設計師與演講教練。請根據以下企劃資料，設計一份 15 頁的評選簡報大綱（每頁含重點與講稿）。

專案名稱：${project?.name || ''}
主題名稱：${selectedTheme?.title || ''}
Slogan：${selectedTheme?.slogan || ''}
主題概念：${selectedTheme?.concept || ''}
企劃亮點：${highlights.map(h => `${h.title}：${h.description}`).join('\n')}
評選配分：${(analysis.evaluationCriteria || []).map(c => `${c.item}(${c.weight}%)`).join('、')}

請以 JSON 陣列格式輸出（只輸出純 JSON）：
[
  {
    "page": 1,
    "title": "投影片標題",
    "bullets": ["重點1", "重點2", "重點3"],
    "speaker_notes": "講者口述稿（模擬實際演講語氣，80字內）",
    "duration_seconds": 30
  }
]

簡報流程建議：
1. 封面（公司名稱 + 案名）
2. 專案理解
3-4. 主題概念與策略
5-8. 執行計畫亮點
9-10. 團隊介紹
11. 經費說明
12-13. 預期效益
14. 風險管控
15. 感謝頁`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4 }
    );

    let aiResponse = result.content || '[]';
    let slides;
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResponse.trim();
      slides = JSON.parse(jsonStr);
    } catch {
      slides = [{ raw: aiResponse }];
    }

    res.json(slides);
  } catch (error) {
    console.error('[AI] 簡報生成失敗:', error);
    res.status(500).json({ error: '生成失敗', details: error.message });
  }
});

module.exports = router;

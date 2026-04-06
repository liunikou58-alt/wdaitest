const express = require('express');
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');
const OpenCC = require('opencc-js');
const { formatIntelForPrompt } = require('../services/dept-intelligence');
const { getAnalysisContext } = require('../utils/prompt-context');
const { extractAllProjectText } = require('../utils/extract-text');

const router = express.Router({ mergeParams: true });

// === 共用：簡轉繁 + emoji 清除 ===
function cleanAiResponse(text) {
  let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{20E3}]/gu, '').replace(/[^\S\n]{2,}/g, ' ');
  const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });
  cleaned = s2tConverter(cleaned);
  return cleaned;
}

// === 共用：提取專案文件文字（多格式） ===
async function extractProjectText(projectId) {
  const { allText } = await extractAllProjectText(projectId, db, { maxChars: 30000, withLabels: false });
  return allText;
}

// GET /api/projects/:projectId/highlights
router.get('/', (req, res) => {
  const items = db.find('highlights', h => h.project_id === req.params.projectId)
    .sort((a, b) => a.sort_order - b.sort_order);
  res.json(items);
});

// GET /api/projects/:projectId/highlights/report — 取得 Markdown 報告
router.get('/report', (req, res) => {
  const projectId = req.params.projectId;
  const themes = db.find('theme_proposals', t => t.project_id === projectId);
  const withReport = themes.find(t => t.highlights_report);
  res.json({ report: withReport?.highlights_report || '' });
});

// ============================================
// POST /api/projects/:projectId/highlights/generate
// 雙重輸出：Markdown 深度報告 + JSON 結構化記錄
// ============================================
router.post('/generate', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const isTender = project?.case_type !== 'commercial';

    // 1. 讀取已選子活動
    const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
    let subActivitiesInfo = '';
    let themeInfo = '';

    if (selectedData.length > 0) {
      try {
        const items = JSON.parse(selectedData[0].items_json) || [];
        if (items.length > 0) {
          subActivitiesInfo = items.map(s => `- ${s.name}：${s.description || ''}（預期：${s.effect || ''}）`).join('\n');
          const themeNames = [...new Set(items.map(s => s.themeTitle).filter(Boolean))];
          themeInfo = themeNames.join('、');
        }
      } catch {}
    }

    if (!subActivitiesInfo) {
      return res.status(400).json({ error: '請先在「主題包裝」步驟選取子活動' });
    }

    // 2. 讀取主題報告
    const themes = db.find('theme_proposals', t => t.project_id === projectId);
    const themeReport = themes.find(t => t.report)?.report || '';

    // 3. 讀取分析報告
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let analysisReport = '';
    if (analyses.length > 0) {
      try {
        const parsed = JSON.parse(analyses[0].analysis_json);
        analysisReport = parsed.report || '';
      } catch {}
    }
    const analysis = analyses.length ? JSON.parse(analyses[0].analysis_json) : {};

    // 4. 讀取文件原文（精簡版）
    const docText = await extractProjectText(projectId);

    const contextInfo = isTender
      ? `機關：${project?.agency || '未指定'}\n科室：${project?.department || '未指定'}`
      : `公司：${project?.company || '未指定'}\n產業：${project?.company_industry || '未指定'}`;

    // 注入科室深度情報
    const deptIntelContext = formatIntelForPrompt(projectId);

    // ============================================
    // Prompt — 雙重輸出
    // ============================================
    // === 縮減 context 長度，避免弱模型照抄 ===
    const trimmedThemeReport = themeReport ? themeReport.substring(0, 2000) : '';
    const trimmedAnalysis = analysisReport ? analysisReport.substring(0, 1500) : '';
    const trimmedDocText = docText ? docText.substring(0, 2000) : '';

    const prompt = `你是台灣頂尖的${isTender ? '政府活動' : '企業活動'}企劃「亮點策略顧問」。

## 你的唯一任務

根據下面的子活動清單，發想 6 個「殺手級亮點構想」。

## 絕對禁止（違反即不合格）

1. **禁止**照抄下方「參考資料」區塊的文字。參考資料只是背景，不是你要輸出的內容。
2. **禁止**輸出投標分析報告、需求分析報告、專案摘要等非亮點內容。
3. **禁止**在輸出中出現「詳見招標檔案」「詳見估價單」等語句。
4. 你的輸出必須是 **6 個原創的活動亮點創意**，不是報告分析！

## 專案基本資訊

${contextInfo}
活動名稱：${project?.name || ''}
活動類型：${project?.event_type || ''}
來自主題方案：${themeInfo}

## 已選取的子活動（你要為這些活動發想亮點）

${subActivitiesInfo}

## 輸出格式（嚴格遵守）

先用 2-3 句話說明這 6 個亮點的整體策略邏輯。

---

### 1. 「亮點標題」：副標說明
一句話背景脈絡。
* **創意點**：具體執行方式，包括設備、合作夥伴、現場做法。至少 60 字。
* **亮點**：對${isTender ? '評審' : '客戶'}的殺傷力。至少 30 字。

### 2. 「亮點標題」：副標說明
（同上結構）

### 3. 「亮點標題」：副標說明
（同上結構）

### 4. 「亮點標題」：副標說明
（同上結構）

### 5. 「亮點標題」：副標說明
（同上結構）

### 6. 「亮點標題」：副標說明
（同上結構）

---

### 執行小撇步
2-3 個實戰技巧。

---

===JSON_SEPARATOR===

接著，將 6 個亮點以 JSON 陣列格式輸出：
[
  {
    "title": "亮點標題",
    "subtitle": "副標說明",
    "description": "創意點核心（一句話）",
    "expected_effect": "預期效果",
    "cost_level": "low 或 medium 或 high",
    "mapped_criteria": "對應評選標準（如有）"
  }
]

## 嚴格規則

1. 全程使用台灣繁體中文
2. 不要使用任何 emoji
3. 6 個亮點涵蓋不同面向（互動體驗、視覺、社群、紀念品、科技、公關）
4. 創意點必須具體可執行
5. 每個亮點至少 60 字描述
6. **再次強調：不要照抄下方參考資料，你要產出原創亮點創意！**

---

## 以下是參考資料（僅供理解背景用，不要照抄）

${deptIntelContext ? `【科室情報】\n${deptIntelContext.substring(0, 1000)}\n\n` : ''}${trimmedThemeReport ? `【主題方案摘要（僅供參考，不要照抄）】\n${trimmedThemeReport}\n\n` : ''}${trimmedAnalysis ? `【分析報告摘要（僅供參考，不要照抄）】\n${trimmedAnalysis}\n\n` : ''}${trimmedDocText ? `【文件原文摘要（僅供參考，不要照抄）】\n${trimmedDocText}` : ''}`;

    console.log(`[Highlight] 生成亮點報告 for ${projectId}`);
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 24576, timeout: 300000 }
    );

    let aiResponse = cleanAiResponse(result.content || '');
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 分離 Markdown 報告和 JSON
    let markdownReport = '';
    let jsonStr = '';

    if (aiResponse.includes('===JSON_SEPARATOR===')) {
      const parts = aiResponse.split('===JSON_SEPARATOR===');
      markdownReport = parts[0].trim();
      jsonStr = parts[1]?.trim() || '';
    } else {
      // 加強 Fallback: 嘗試多種分離方式
      // 1. 找最後一個完整的 JSON array
      const jsonArrayMatch = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]\s*$/m);
      if (jsonArrayMatch) {
        const matchIdx = aiResponse.lastIndexOf(jsonArrayMatch[0]);
        if (matchIdx > aiResponse.length * 0.3) {
          markdownReport = aiResponse.substring(0, matchIdx).trim();
          jsonStr = jsonArrayMatch[0];
        } else {
          markdownReport = aiResponse;
        }
      } else {
        // 2. 舊的 fallback 邏輯
        const lastJsonStart = aiResponse.lastIndexOf('[');
        const lastJsonEnd = aiResponse.lastIndexOf(']');
        if (lastJsonStart > aiResponse.length * 0.4 && lastJsonEnd > lastJsonStart) {
          markdownReport = aiResponse.substring(0, lastJsonStart).trim();
          jsonStr = aiResponse.substring(lastJsonStart, lastJsonEnd + 1);
        } else {
          markdownReport = aiResponse;
        }
      }
    }

    // 解析 JSON
    let highlights = [];
    try {
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      const cleanJson = jsonMatch ? jsonMatch[1].trim() : jsonStr.trim();
      const start = cleanJson.indexOf('[');
      const end = cleanJson.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        highlights = JSON.parse(cleanJson.substring(start, end + 1));
      }
    } catch (e) {
      console.warn('[Highlight] JSON 解析失敗，嘗試從報告中提取:', e.message);
      // Fallback: 從 Markdown 標題中提取基本結構
      const titleMatches = markdownReport.matchAll(/###\s*\d+\.\s*「(.+?)」[：:]\s*(.+)/g);
      for (const m of titleMatches) {
        highlights.push({
          title: `「${m[1]}」`,
          subtitle: m[2].trim(),
          description: m[2].trim(),
          expected_effect: '',
          cost_level: 'medium',
          mapped_criteria: '',
        });
      }
    }

    // 儲存 Markdown 報告到 theme_proposals
    const themeRecord = db.find('theme_proposals', t => t.project_id === projectId);
    if (themeRecord.length > 0) {
      db.update('theme_proposals', themeRecord[0].id, {
        highlights_report: markdownReport,
      });
    }

    // 清除舊 AI 亮點，保留手動新增
    db.removeWhere('highlights', h => h.project_id === projectId && h.source === 'ai');

    // 存入結構化亮點
    const inserted = highlights.map((h, i) => db.insert('highlights', {
      id: uuidv4(),
      project_id: projectId,
      title: h.title || '',
      description: h.description || h.subtitle || '',
      expected_effect: h.expected_effect || '',
      cost_level: h.cost_level || 'medium',
      mapped_criteria: h.mapped_criteria || '',
      is_selected: 1,
      sort_order: i,
      source: 'ai',
    }));

    console.log(`[Highlight] 完成: 報告 ${markdownReport.length} 字元, ${inserted.length} 個結構化亮點`);
    res.json({ report: markdownReport, items: inserted });
  } catch (error) {
    console.error('[Highlight] 生成失敗:', error);
    res.status(500).json({ error: '亮點生成失敗', details: error.message });
  }
});

// POST /api/projects/:projectId/highlights — 手動新增亮點
router.post('/', (req, res) => {
  const { title, description, expected_effect, cost_level, mapped_criteria } = req.body;
  const item = db.insert('highlights', {
    id: uuidv4(), project_id: req.params.projectId,
    title: title || '', description: description || '',
    expected_effect: expected_effect || '', cost_level: cost_level || 'medium',
    mapped_criteria: mapped_criteria || '', is_selected: 1,
    sort_order: 99, source: 'manual'
  });
  res.status(201).json(item);
});

// PUT /api/highlights/:id
router.put('/:highlightId', (req, res) => {
  const updated = db.update('highlights', req.params.highlightId, req.body);
  if (!updated) return res.status(404).json({ error: '亮點不存在' });
  res.json(updated);
});

// PUT /api/projects/:projectId/highlights/reorder
router.put('/reorder', (req, res) => {
  const { order } = req.body;
  if (!order) return res.status(400).json({ error: '缺少 order 參數' });
  order.forEach(({ id, sort_order }) => db.update('highlights', id, { sort_order }));
  res.json({ success: true });
});

// DELETE /api/highlights/:id
router.delete('/:highlightId', (req, res) => {
  db.remove('highlights', req.params.highlightId);
  res.json({ success: true });
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const ai = require('../ai-provider');
const db = require('../db');
const OpenCC = require('opencc-js');
const { formatIntelForPrompt } = require('../services/dept-intelligence');
const { parseAiJson, validateAiJson } = require('../utils/parse-ai-json');
const { buildProjectContext, getAnalysisContext } = require('../utils/prompt-context');
const { extractAllProjectText } = require('../utils/extract-text');

const router = express.Router({ mergeParams: true });

// === 共用：提取專案所有文件文字（支援 PDF/DOCX/DOC/XLSX/TXT）===
async function extractProjectText(projectId, maxChars) {
  const { allText } = await extractAllProjectText(projectId, db, { maxChars, withLabels: false });
  return allText;
}

// === 共用：emoji 清除 + 簡轉繁 ===
function cleanAiResponse(text) {
  // 清除 emoji
  let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{20E3}]/gu, '').replace(/[^\S\n]{2,}/g, ' ');
  // 簡轉繁
  const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });
  cleaned = s2tConverter(cleaned);
  return cleaned;
}

// GET /api/projects/:projectId/themes
router.get('/', (req, res) => {
  const themes = db.find('theme_proposals', t => t.project_id === req.params.projectId)
    .sort((a, b) => a.sort_order - b.sort_order);
  res.json(themes);
});

// ============================================
// Phase 1: 定向選擇題
// POST /api/projects/:projectId/themes/direction-questions
// ============================================
router.post('/direction-questions', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const isTender = project?.case_type !== 'commercial';

    const docText = await extractProjectText(projectId);
    if (!docText) {
      return res.status(400).json({ error: '請先上傳需求文件（Step 1）' });
    }

    // 也讀取 Step 2 已完成的分析報告
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let analysisReport = '';
    if (analyses.length > 0) {
      try {
        const parsed = JSON.parse(analyses[0].analysis_json);
        analysisReport = parsed.report || '';
      } catch { }
    }

    const contextInfo = isTender
      ? `機關：${project?.agency || '未指定'}\n科室：${project?.department || '未指定'}`
      : `公司：${project?.company || '未指定'}\n產業：${project?.company_industry || '未指定'}`;

    // 注入科室深度情報
    const deptIntelContext = formatIntelForPrompt(projectId);

    // 注入評選標準（讓問題對齊評審重點）
    const analysisData = getAnalysisContext(projectId, 5000);
    const evalCriteria = analysisData.structured.evaluationCriteria || [];
    const evalHint = evalCriteria.length > 0
      ? `\n\n【評選標準】以下是本案的評選配分（你的問題方向應呼應這些評審重點）：\n${evalCriteria.map(c => `- ${c.item || c.name}（${c.weight || ''}%）`).join('\n')}`
      : '';

    const prompt = `你是台灣的資深${isTender ? '政府活動' : '企業活動'}企劃創意總監。
根據以下需求文件內容以及該單位的深度背景情報，產出 3 組「方向選擇題」，幫助企劃快速定下主題包裝的創意方向。

每個問題必須：
- 問題本身要具體，必須緊扣這個${isTender ? '科室的業務領域和核心議題' : '公司的產業特性和企業文化'}
- 每題提供 4 個選項
- 選項要有差異性，代表不同的創意走向
- 選項的用詞要展現你對該領域的深度理解（使用專業術語、引用真實案例方向）
- 問題方向應對齊評選標準中的加分項目（如果有提供的話）

${contextInfo}
活動類型：${project?.event_type || '未指定'}

${deptIntelContext ? `${deptIntelContext}\n\n` : ''}${evalHint}

嚴格以 JSON 陣列格式輸出（只輸出純 JSON，不要加其他文字）：
[
  {
    "question": "針對這個案子的具體問題（必須與該科室/單位的業務領域直接相關）",
    "options": ["選項A", "選項B", "選項C", "選項D"]
  }
]

以下是需求文件原文：
"""
${docText.substring(0, 30000)}
"""
${analysisReport ? `\n以下是 AI 分析報告摘要：\n"""\n${analysisReport.substring(0, 8000)}\n"""` : ''}`;

    console.log(`[Theme] Phase 1: 產生定向選擇題 for ${projectId}`);
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4, max_tokens: 2048 }
    );

    let aiResponse = cleanAiResponse(result.content || '[]');

    // 穩健解析 JSON — 預設問題動態帶入專案資訊，避免泛用題導致主題跑偏
    const projectLabel = project?.name || project?.agency || '本案';
    const defaultQuestions = [
      { question: `「${projectLabel}」的視覺調性應該偏向？`, options: ['科技/數位感', '自然/文化體驗', '熱血/動感', '文青/質感'] },
      { question: `「${projectLabel}」最希望傳達的核心訊息？`, options: ['專業服務能力', '地方特色亮點', '創新數位手法', '社群影響力'] },
      { question: `活動主題的包裝風格偏好？`, options: ['穩重專業', '活潑年輕', '在地深度', '國際連結'] },
    ];
    let questions = parseAiJson(aiResponse, defaultQuestions);
    if (!Array.isArray(questions) || questions.length === 0) {
      console.warn('[Theme] Phase 1: 使用預設選擇題（已帶入專案名稱）');
      questions = defaultQuestions;
    }

    console.log(`[Theme] Phase 1 完成: ${questions.length} 題`);
    res.json({ questions, provider: result.provider });
  } catch (error) {
    console.error('[Theme] Phase 1 失敗:', error);
    res.status(500).json({ error: '定向選擇題生成失敗', details: error.message });
  }
});

// ============================================
// Phase 2: 深度主題生成（Markdown 報告）
// POST /api/projects/:projectId/themes/generate
// ============================================
router.post('/generate', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { styles, directions } = req.body;
    // directions = [{ question: "...", answer: "..." }, ...]
    const project = db.getById('projects', projectId);
    const isTender = project?.case_type !== 'commercial';

    // 讀取上傳文件原文
    const docText = await extractProjectText(projectId);
    if (!docText) {
      return res.status(400).json({ error: '請先上傳需求文件（Step 1）' });
    }

    // 讀取 Step 2 分析報告
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    let analysisReport = '';
    if (analyses.length > 0) {
      try {
        const parsed = JSON.parse(analyses[0].analysis_json);
        analysisReport = parsed.report || '';
      } catch { }
    }

    const contextInfo = isTender
      ? `機關：${project?.agency || '未指定'}\n科室：${project?.department || '未指定'}`
      : `公司：${project?.company || '未指定'}\n產業：${project?.company_industry || '未指定'}`;

    // 注入科室深度情報
    const deptIntelContext = formatIntelForPrompt(projectId);

    // 組合定向選擇結果
    let directionBrief = '';
    if (directions && directions.length > 0) {
      directionBrief = '\n企劃定向（PM 已選擇的方向）：\n' +
        directions.map((d, i) => `- Q${i + 1}: ${d.question} → 選擇: ${d.answer}`).join('\n');
    }

    const styleHint = styles?.length ? `\n偏好風格關鍵字：${styles.join('、')}` : '';
    const eventType = project?.event_type ? `\n活動類型：${project.event_type}` : '';
    const eventDate = project?.event_date ? `\n活動日期：${project.event_date}` : '';

    const prompt = `【任務】你是台灣頂尖的活動企劃創意總監。你的任務是：為以下活動設計 3 套「主題包裝方案」。

【重要】這不是文件分析！不是文件摘要！你必須發揮創意，設計 3 個有吸引力的「活動主題」。每個主題要有一個酷炫的名字、一句 slogan、完整的創意觸點。

【最最最重要——違反此規則的輸出一律不合格】
本案為：「${project?.name || ''}」
主辦單位：${project?.agency || ''}
主辦科室：${project?.department || ''}
你的所有創意產出（主題名稱、slogan、核心敘事、創意觸點）必須 100% 圍繞這個案名、這個機關、這個科室展開。
絕對禁止：
- 不可自行發明或提及需求文件中未出現的機關/單位/組織名稱
- 不可將主題偏離到與本案主辦單位業務無關的領域
- 如果本案是「觀光」就不可以寫「醫療」，如果是「數位行銷」就不可以寫「健康促進」

${contextInfo}
${eventType}
${eventDate}

${directionBrief ? `\n${directionBrief}\n（注意：以上定向選擇僅作為風格參考，不可改變本案的主題領域和主辦單位）` : ''}
${styleHint}

${analysisReport ? `【Step 2 的 AI 分析報告——這是最權威的參考依據，你的主題必須回應其中提到的具體需求和工作項目】\n${analysisReport.substring(0, 10000)}` : ''}

${deptIntelContext ? `\n${deptIntelContext}\n` : ''}

【需求文件摘要（主題必須呼應文件中提到的具體活動項目和規格，不可脫離原始需求自行發明）】
${docText.substring(0, 12000)}

---

請用以下 Markdown 結構撰寫你的 3 套主題方案：

先用 2-3 句話快速定位這個案子的核心特質，然後說明三個方案各自的差異化策略。

---

### 方案一：「（寫一個吸引人的主題名稱——必須與該科室/單位的業務領域直接呼應）」

**Slogan：** （一句讓人記住的標語——融入該領域的專業語彙）

**核心敘事：** 這個主題想傳達什麼故事？為什麼選這個方向？必須說明如何回應該科室/單位的核心議題。（至少100字）

**命名巧思：** 這個名字有什麼雙關語、諧音、或文化典故？

#### 視覺識別方向
*   **主色調：** 具體色彩建議（例如：科技藍 #2563eb 搭配能量橙 #f97316）
*   **字體風格：** 建議字體類型
*   **視覺意象：** 主視覺的畫面應該長什麼樣子

#### 創意觸點

1.  **${isTender ? '賽事/活動包裝' : '活動流程包裝'}：**
    如何把原本平凡的活動流程，用這個主題重新包裝？具體的做法是什麼？必須呼應該科室/單位的業務特色。（至少60字）

2.  **互動體驗設計：**
    有什麼互動機制可以讓參與者更投入？必須針對該單位的目標受眾量身設計。（至少60字）

3.  **紀念品與周邊設計：**
    獎盃、完賽禮、參加禮、餐盒、文宣品要怎麼融入這個主題和該領域的專業元素？（至少60字）

4.  **傳播與社群亮點：**
    活動中哪個畫面/環節最適合拍照、打卡、上傳社群？如何製造話題？（至少60字）

5.  **跨活動串聯機制：**
    如果有多個子活動（例如球賽和路跑），要怎麼讓它們用同一個主題串起來，而不是各辦各的？（至少60字）

#### 為什麼能贏
*   ${isTender ? '評審' : '客戶'}會覺得這個方案好在哪裡？
*   比起「安全牌」的提案，這個方案的差異化優勢是什麼？

---

### 方案二：「（完全不同方向的主題名稱）」

（使用跟方案一完全相同的結構，但主題方向必須與方案一明顯不同）

---

### 方案三：「（第三個獨特方向的主題名稱）」

（使用跟方案一完全相同的結構，但主題方向必須與前兩個都不同）

---

嚴格規則：
1. 全程使用台灣繁體中文（正體中文），不可使用簡體字
2. 不要使用任何 emoji
3. 三個方案的調性必須有明顯差異
4. 每個創意觸點必須具體可執行，不要泛泛而談
5. 不要做文件分析、不要做需求摘要、不要做執行指南。你的任務是「創意發想」
6. 用粗體標示關鍵亮點
7. 所有主題名稱、slogan、創意觸點都必須展現你對該科室/單位業務領域的深度理解`;

    console.log(`[Theme] Phase 2: 生成主題包裝 for ${projectId}，文件 ${docText.length} 字元`);
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.7, max_tokens: 32768, timeout: 300000 }
    );

    let aiResponse = cleanAiResponse(result.content || '');

    // 移除 think tags
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 清除舊主題
    db.removeWhere('theme_proposals', t => t.project_id === projectId);

    // 存為 Markdown 報告格式
    const themeRecord = db.insert('theme_proposals', {
      id: uuidv4(),
      project_id: projectId,
      title: '主題包裝方案',
      slogan: '',
      concept: '',
      reasoning: '',
      naming_rationale: '',
      key_visual_mood: '',
      touchpoints: '',
      report: aiResponse,  // Markdown 報告
      sub_activities: null,
      is_selected: 0,
      sort_order: 0,
      directions_json: directions ? JSON.stringify(directions) : null,
      created_at: new Date().toISOString(),
    });

    db.update('projects', projectId, { status: 'planning' });

    console.log(`[Theme] Phase 2 完成: ${aiResponse.length} 字元`);
    res.json([themeRecord]);
  } catch (error) {
    console.error('[Theme] Phase 2 失敗:', error);
    res.status(500).json({ error: '主題生成失敗', details: error.message });
  }
});

// ============================================
// Phase 3: 從報告中提取子活動清單（供 Step 4 使用）
// POST /api/projects/:projectId/themes/extract-activities
// ============================================
router.post('/extract-activities', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const themes = db.find('theme_proposals', t => t.project_id === projectId);
    const withReport = themes.find(t => t.report);
    
    if (!withReport?.report) {
      return res.status(400).json({ error: '請先生成主題包裝方案' });
    }

    const prompt = `以下是 3 套活動主題包裝方案的報告。請從每個方案中提取所有具體的子活動/創意項目。

每個子活動需包含：
- name: 子活動名稱（簡短有力）
- description: 一句話說明執行方式
- effect: 預期效果或亮點
- theme: 屬於哪個方案（方案一/方案二/方案三）

嚴格以 JSON 陣列格式輸出（只輸出純 JSON，不要加其他文字）：
[
  { "name": "...", "description": "...", "effect": "...", "theme": "方案一：「XXX」" }
]

請從以下報告中提取（每個方案至少提取 5 個子活動）：

${withReport.report.substring(0, 10000)}`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.2, max_tokens: 8192 }
    );

    let aiResponse = cleanAiResponse(result.content || '[]');

    let activities = parseAiJson(aiResponse, null);
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      console.error('[Theme] Phase 3 JSON 解析失敗，使用 fallback 提取');
      // Fallback: 嘗試從主題報告中用正則抓活動名稱
      const report = withReport.report || '';
      const titleMatches = [...report.matchAll(/\d+\.\s*\*\*(.+?)(?:：|:)\*\*/g)];
      if (titleMatches.length > 0) {
        activities = titleMatches.map(m => ({
          name: m[1].trim(),
          description: '由主題報告自動提取',
          effect: '待深化',
          theme: '自動提取'
        }));
      } else {
        // 最後 fallback: 提供基礎結構
        activities = [
          { name: '主題活動一', description: '依主題方案執行', effect: '待設計', theme: '方案一' },
          { name: '主題活動二', description: '依主題方案執行', effect: '待設計', theme: '方案二' },
          { name: '主題活動三', description: '依主題方案執行', effect: '待設計', theme: '方案三' },
        ];
      }
    }

    console.log(`[Theme] Phase 3 完成: 提取 ${activities.length} 個子活動`);
    res.json({ activities });
  } catch (error) {
    console.error('[Theme] Phase 3 失敗:', error);
    res.status(500).json({ error: '子活動提取失敗', details: error.message });
  }
});

// PUT /api/themes/:themeId/select — 選用主題
router.put('/:themeId/select', (req, res) => {
  const theme = db.getById('theme_proposals', req.params.themeId);
  if (!theme) return res.status(404).json({ error: '主題不存在' });
  db.find('theme_proposals', t => t.project_id === theme.project_id).forEach(t => {
    db.update('theme_proposals', t.id, { is_selected: 0 });
  });
  db.update('theme_proposals', req.params.themeId, { is_selected: 1 });
  res.json({ success: true });
});

// POST /api/themes/:themeId/expand — AI 深化展開（保留相容性）
router.post('/:themeId/expand', async (req, res) => {
  try {
    const theme = db.getById('theme_proposals', req.params.themeId);
    if (!theme) return res.status(404).json({ error: '主題不存在' });

    const project = db.getById('projects', theme.project_id);
    const isTender = project?.case_type !== 'commercial';
    let contextHint = '';
    if (isTender && project?.agency) contextHint = `\n此活動由 ${project.agency} ${project.department || ''} 主辦。`;
    else if (project?.company) contextHint = `\n此活動由 ${project.company}（${project.company_industry || ''}）舉辦。`;

    const prompt = `你是台灣的資深活動企劃師。請針對以下活動主題，設計 5~6 個具體的子活動/項目。
${contextHint}
主題名稱：${theme.title}
Slogan：${theme.slogan}
核心概念：${theme.concept}

嚴格規則：必須全程使用台灣繁體中文，不要使用任何 emoji。

請以 JSON 陣列格式輸出（只輸出純 JSON）：
[
  { "name": "子活動名稱", "description": "一句話描述執行方式", "effect": "預期效果或亮點" }
]`;

    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.5 }
    );

    let aiResponse = cleanAiResponse(result.content || '[]');
    let subActivities = parseAiJson(aiResponse, [{ raw: aiResponse }]);

    db.update('theme_proposals', req.params.themeId, {
      sub_activities: JSON.stringify(subActivities)
    });

    res.json(subActivities);
  } catch (error) {
    console.error('[AI] 深化失敗:', error);
    res.status(500).json({ error: '深化失敗', details: error.message });
  }
});

// === 子活動勾選 API ===

// GET /api/projects/:projectId/themes/selected-activities
router.get('/selected-activities', (req, res) => {
  const saved = db.find('selected_sub_activities', s => s.project_id === req.params.projectId);
  if (saved.length === 0) return res.json({ items: [] });
  try {
    const items = JSON.parse(saved[0].items_json);
    res.json({ items });
  } catch {
    res.json({ items: [] });
  }
});

// POST /api/projects/:projectId/themes/selected-activities
router.post('/selected-activities', (req, res) => {
  const { items } = req.body;
  const projectId = req.params.projectId;
  db.removeWhere('selected_sub_activities', s => s.project_id === projectId);
  const saved = db.insert('selected_sub_activities', {
    id: uuidv4(),
    project_id: projectId,
    items_json: JSON.stringify(items || []),
    updated_at: new Date().toISOString()
  });
  res.json(saved);
});

module.exports = router;

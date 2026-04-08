/**
 * bid-prep.js — 投標準備工具（答詢準備 + 簡報框架）
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { callAI, autoRoute } = require('../services/ai-engine');
const db = require('../db');
const OpenCC = require('opencc-js');
const { buildProjectContext } = require('../utils/prompt-context');
const { formatIntelForPrompt } = require('../services/dept-intelligence');

const router = express.Router({ mergeParams: true });

// 清理 emoji + 簡轉繁
function cleanText(text) {
  let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
  const s2t = OpenCC.Converter({ from: 'cn', to: 'twp' });
  return s2t(cleaned);
}

// POST /api/projects/:projectId/bid-prep/qa — 答詢準備
router.post('/qa', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    // 收集上下文
    const context = buildProjectContext(projectId);
    const intel = formatIntelForPrompt(projectId);

    // 取得分析報告
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const analysis = analyses.length > 0 ? JSON.parse(analyses[0].analysis_json) : null;
    const analysisReport = analysis?.report || '';

    // 取得評選標準
    const evalCriteria = analysis?.meta?.evaluationCriteria || [];

    const prompt = `你是一位台灣政府採購評審委員模擬器。你的任務是模擬評審委員會在評審會議中可能提出的問題。

## 專案資訊
案名：${project.name}
機關：${project.agency || '未指定'}
科室：${project.department || '未指定'}
活動類型：${project.event_type || '未指定'}
預算：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未指定'}

## 科室情報
${intel || '（無）'}

## 評選標準
${evalCriteria.length > 0 ? evalCriteria.map(c => `- ${c.item_name || c.item}：${c.weight}%`).join('\n') : '（無評選標準資料）'}

## AI 分析報告摘要
${analysisReport.substring(0, 8000)}

## 專案上下文
${context.substring(0, 6000)}

---

請產出 **12-15 個** 評審委員在簡報答詢時最可能問的問題。每題按以下 JSON 格式：

\`\`\`json
{
  "qa_items": [
    {
      "category": "技術執行" | "經費預算" | "團隊能力" | "品質管控" | "風險管理" | "創意差異化",
      "question": "委員可能問的問題（具體、有挑戰性）",
      "intent": "委員問這題的真正意圖（2句話）",
      "suggested_answer": "建議的回答策略和要點（3-5個要點，用\\n分隔）",
      "difficulty": "easy" | "medium" | "hard",
      "related_criteria": "對應的評選標準項目名稱（如有）"
    }
  ]
}
\`\`\`

嚴格規則：
1. 問題必須針對此案的具體內容（不可用泛化模板）
2. 每道題必須基於需求書、評選標準或行業常識
3. 建議回答要具體到數字、案例、做法，不可空泛
4. 全程使用台灣繁體中文
5. 直接輸出 JSON，不要加解釋`;

    const modelChannel = autoRoute('analysis');
    const result = await callAI(prompt, {
      model: modelChannel,
      temperature: 0.4,
      maxTokens: 16384,
      systemPrompt: '你是一位資深的台灣政府採購評審委員，擁有豐富的提問經驗。你的問題尖銳但公正，總能問到廠商的痛點。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let content = cleanText(result.content || '');

    // 解析 JSON
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    let qaItems = [];
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      qaItems = parsed.qa_items || parsed;
    } catch {
      // fallback: 從 [ 開始到 ] 結束
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try { qaItems = JSON.parse(arrMatch[0]); } catch {}
      }
    }

    // 存入 DB
    const existing = db.find('bid_qa_prep', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_qa_prep', existing[0].id, { items: JSON.stringify(qaItems), updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_qa_prep', {
        id: uuidv4(),
        project_id: projectId,
        items: JSON.stringify(qaItems),
        created_at: new Date().toISOString(),
      });
    }

    res.json({ items: qaItems });
  } catch (error) {
    console.error('[BidPrep] 答詢生成失敗:', error);
    res.status(500).json({ error: '答詢準備生成失敗', details: error.message });
  }
});

// GET /api/projects/:projectId/bid-prep/qa — 取得已有答詢準備
router.get('/qa', (req, res) => {
  const data = db.find('bid_qa_prep', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json({ items: [] });
  try {
    res.json({ items: JSON.parse(data[0].items) });
  } catch {
    res.json({ items: [] });
  }
});

// POST /api/projects/:projectId/bid-prep/presentation — 簡報框架生成
router.post('/presentation', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    const context = buildProjectContext(projectId);
    const intel = formatIntelForPrompt(projectId);

    // 取得企劃書章節
    const proposalData = db.find('proposal_chapters', c => c.project_id === projectId);
    const chaptersText = proposalData.map(c => {
      try { 
        const parsed = JSON.parse(c.chapters || '[]');
        return parsed.map(ch => `## ${ch.title}\n${ch.content?.substring(0, 500) || ''}`).join('\n');
      } catch { return ''; }
    }).join('\n');

    const prompt = `你是一位台灣標案簡報策略顧問。請根據以下專案資料，設計一份 **15 分鐘** 的簡報大綱。

## 專案資訊
案名：${project.name}
機關：${project.agency || '未指定'}
活動類型：${project.event_type || '未指定'}
預算：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未指定'}

## 科室情報
${intel || '（無）'}

## 企劃書重點
${chaptersText.substring(0, 6000) || context.substring(0, 6000)}

---

請產出一份 15 分鐘簡報的完整框架，用 Markdown 格式：

### 簡報時間分配策略

| 投影片 | 標題 | 分鐘 | 核心訊息 |
|--------|------|------|---------|
| 1 | ... | ... | ... |
（列出 12-15 頁）

### 開場策略（第 1 分鐘）
- 開場白建議
- 破冰關鍵句

### 核心亮點呈現（第 2-10 分鐘）
每頁投影片的：
- 建議標題
- 關鍵內容（3-4 個 bullet point）
- 視覺建議（需要什麼圖表 / 圖片 / 數據）
- 講者筆記（1-2 句口語說明）

### 結尾策略（最後 2 分鐘）
- Summary slide 內容
- 結語金句建議
- Call to action

### 答詢準備提示
- 預期 3 個最可能的委員提問方向
- 建議應對策略

嚴格規則：
1. 總時長嚴格控制 15 分鐘
2. 全程使用台灣繁體中文
3. 每頁投影片必須有具體的內容建議，不可空泛
4. 結合評選標準的配分比重來分配簡報時間
5. 不使用 emoji`;

    const modelChannel = autoRoute('creative');
    const result = await callAI(prompt, {
      model: modelChannel,
      temperature: 0.5,
      maxTokens: 12288,
      systemPrompt: '你是一位頂尖的簡報策略顧問，擅長在 15 分鐘內用最精準的方式傳達企劃書的核心價值。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let report = cleanText(result.content || '');

    // 存入 DB
    const existing = db.find('bid_presentation', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_presentation', existing[0].id, { report, updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_presentation', {
        id: uuidv4(),
        project_id: projectId,
        report,
        created_at: new Date().toISOString(),
      });
    }

    res.json({ report });
  } catch (error) {
    console.error('[BidPrep] 簡報框架生成失敗:', error);
    res.status(500).json({ error: '簡報框架生成失敗', details: error.message });
  }
});

// GET /api/projects/:projectId/bid-prep/presentation — 取得已有簡報框架
router.get('/presentation', (req, res) => {
  const data = db.find('bid_presentation', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json({ report: null });
  res.json({ report: data[0].report });
});

// POST /api/projects/:projectId/bid-prep/budget-strategy — 預算配分策略
router.post('/budget-strategy', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    const context = buildProjectContext(projectId);
    const analyses = db.find('analyses', a => a.project_id === projectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const analysis = analyses.length > 0 ? JSON.parse(analyses[0].analysis_json) : null;
    const evalCriteria = analysis?.meta?.evaluationCriteria || [];

    const prompt = `你是一位資深的台灣標案預算配置策略師。

## 專案資訊
案名：${project.name}
總預算：${project.budget ? `新臺幣 ${Number(project.budget).toLocaleString()} 元（含稅）` : '未指定'}
活動類型：${project.event_type || '未指定'}

## 評選標準配分
${evalCriteria.length > 0 ? evalCriteria.map(c => `- ${c.item_name || c.item}：${c.weight}%`).join('\n') : '（無評選標準）'}

## 專案上下文
${context.substring(0, 6000)}

---

請根據評選標準的配分權重，產出預算配置策略。用以下 JSON 格式：

\`\`\`json
{
  "total_budget": ${project.budget || 0},
  "strategy_summary": "一段話說明整體配置邏輯",
  "allocations": [
    {
      "category": "工作項目名稱",
      "related_criteria": "對應的評選標準",
      "criteria_weight": 25,
      "suggested_ratio": 30,
      "suggested_amount": 300000,
      "reasoning": "為什麼這樣配",
      "key_items": ["細項1", "細項2"],
      "risk_note": "預算風險提示"
    }
  ],
  "reserve": {
    "ratio": 5,
    "amount": 50000,
    "purpose": "預備金用途"
  },
  "optimization_tips": ["省錢技巧1", "省錢技巧2", "省錢技巧3"]
}
\`\`\`

規則：
1. 所有金額加總必須等於總預算含稅
2. 評選標準配分高的項目，建議配置更多預算
3. 全程使用台灣繁體中文
4. 直接輸出 JSON`;

    const modelChannel = autoRoute('analysis');
    const result = await callAI(prompt, {
      model: modelChannel, temperature: 0.3, maxTokens: 8192,
      systemPrompt: '你是一位善於在預算限制下最大化評審分數的策略師。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let content = cleanText(result.content || '');
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    let strategy = {};
    try {
      strategy = JSON.parse(jsonMatch[1].trim());
    } catch {
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) try { strategy = JSON.parse(objMatch[0]); } catch {}
    }

    const existing = db.find('bid_budget_strategy', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_budget_strategy', existing[0].id, { data: JSON.stringify(strategy), updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_budget_strategy', { id: uuidv4(), project_id: projectId, data: JSON.stringify(strategy), created_at: new Date().toISOString() });
    }

    res.json(strategy);
  } catch (error) {
    console.error('[BidPrep] 預算策略失敗:', error);
    res.status(500).json({ error: '預算策略生成失敗', details: error.message });
  }
});

router.get('/budget-strategy', (req, res) => {
  const data = db.find('bid_budget_strategy', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json(null);
  try { res.json(JSON.parse(data[0].data)); } catch { res.json(null); }
});

// POST /api/projects/:projectId/bid-prep/competitor — 競爭者分析
router.post('/competitor', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    const intel = formatIntelForPrompt(projectId);

    const prompt = `你是一位台灣政府採購市場的競爭情報分析師。

## 案件資訊
案名：${project.name}
機關：${project.agency || '未指定'}
活動類型：${project.event_type || '未指定'}
預算規模：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未指定'}

## 機關情報
${intel || '（無）'}

---

請分析此類型標案的市場競爭態勢，用 Markdown 報告格式產出：

### 一、市場概況
- 此類型標案的市場規模和趨勢
- 主要競爭對手類型（大型廣告集團 / 中型公關公司 / 專業顧問公司 / 新創團隊）
- 一般投標廠商數量估計

### 二、常見競爭對手分析

| 公司類型 | 代表性公司舉例 | 優勢 | 劣勢 | 報價策略 |
|---------|--------------|------|------|---------|
| ... | ... | ... | ... | ... |
（列出 4-6 類）

### 三、得標關鍵因素
1. 此類標案通常由什麼類型的公司得標？
2. 過往得標廠商的共同特徵？
3. 評審委員最在意的 3 個要素？

### 四、差異化策略建議
- 5 個具體的差異化方向
- 如何在企劃書中展現優勢
- 簡報中的致勝關鍵

### 五、報價策略
- 此預算規模的合理報價區間
- 各工作項目的行情參考
- 避免的報價陷阱

嚴格規則：全程使用台灣繁體中文，不使用 emoji，分析必須基於台灣政府標案市場實況。`;

    const modelChannel = autoRoute('creative');
    const result = await callAI(prompt, {
      model: modelChannel, temperature: 0.5, maxTokens: 12288,
      systemPrompt: '你是台灣政府採購市場的資深觀察者，對各類型標案的競爭生態瞭若指掌。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let report = cleanText(result.content || '');

    const existing = db.find('bid_competitor', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_competitor', existing[0].id, { report, updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_competitor', { id: uuidv4(), project_id: projectId, report, created_at: new Date().toISOString() });
    }

    res.json({ report });
  } catch (error) {
    console.error('[BidPrep] 競爭者分析失敗:', error);
    res.status(500).json({ error: '競爭者分析失敗', details: error.message });
  }
});

router.get('/competitor', (req, res) => {
  const data = db.find('bid_competitor', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json({ report: null });
  res.json({ report: data[0].report });
});

// POST /api/projects/:projectId/bid-prep/gantt — 甘特圖數據
router.post('/gantt', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    const context = buildProjectContext(projectId);

    const prompt = `你是一位專案管理專家。請根據以下標案資料，產出履約時程甘特圖的數據。

## 專案資訊
案名：${project.name}
履約期間：決標日 ~${project.deadline || '未指定'}
活動類型：${project.event_type || '未指定'}
預算：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未指定'}

## 專案上下文
${context.substring(0, 6000)}

---

用以下 JSON 格式輸出甘特圖數據：

\`\`\`json
{
  "project_name": "案名",
  "start_date": "2026-05-01",
  "end_date": "2026-12-15",
  "milestones": [
    { "name": "里程碑名稱", "date": "2026-06-01", "type": "milestone" }
  ],
  "phases": [
    {
      "name": "階段名稱",
      "start": "2026-05-01",
      "end": "2026-06-30",
      "color": "#6366f1",
      "tasks": [
        { "name": "任務名稱", "start": "2026-05-01", "end": "2026-05-31", "owner": "負責人/團隊" }
      ]
    }
  ],
  "payment_schedule": [
    { "stage": "第一期", "ratio": 30, "trigger": "簽約後", "estimated_date": "2026-05-15" }
  ]
}
\`\`\`

規則：
1. 從決標後開始規劃到結案
2. 必須包含所有主要工作階段（如策劃期、執行期、結案期）
3. 付款節點必須與需求書一致
4. 日期格式 YYYY-MM-DD
5. 全程使用台灣繁體中文
6. 直接輸出 JSON`;

    const modelChannel = autoRoute('analysis');
    const result = await callAI(prompt, {
      model: modelChannel, temperature: 0.3, maxTokens: 8192,
      systemPrompt: '你是一位嚴謹的專案管理師。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let content = cleanText(result.content || '');
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    let gantt = {};
    try {
      gantt = JSON.parse(jsonMatch[1].trim());
    } catch {
      const objMatch = content.match(/\{[\s\S]*\}/);
      if (objMatch) try { gantt = JSON.parse(objMatch[0]); } catch {}
    }

    const existing = db.find('bid_gantt', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_gantt', existing[0].id, { data: JSON.stringify(gantt), updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_gantt', { id: uuidv4(), project_id: projectId, data: JSON.stringify(gantt), created_at: new Date().toISOString() });
    }

    res.json(gantt);
  } catch (error) {
    console.error('[BidPrep] 甘特圖失敗:', error);
    res.status(500).json({ error: '甘特圖生成失敗', details: error.message });
  }
});

router.get('/gantt', (req, res) => {
  const data = db.find('bid_gantt', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json(null);
  try { res.json(JSON.parse(data[0].data)); } catch { res.json(null); }
});

// POST /api/projects/:projectId/bid-prep/sentiment-template — 輿情分析範本
router.post('/sentiment-template', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    if (!project) return res.status(404).json({ error: '專案不存在' });

    const context = buildProjectContext(projectId);
    const intel = formatIntelForPrompt(projectId);

    const prompt = `你是一位資深的台灣數位行銷暨輿情分析專家。

## 專案資訊
案名：${project.name}
機關：${project.agency || '未指定'}
活動類型：${project.event_type || '未指定'}
預算：${project.budget ? `${Number(project.budget).toLocaleString()} 元` : '未指定'}

## 科室情報
${intel || '（無）'}

## 專案上下文
${context.substring(0, 6000)}

---

請產出一份完整的輿情監測與分析執行範本，用 Markdown 格式：

### 一、輿情監測架構

#### 1.1 監測範圍
- 監測平台清單（Facebook、Instagram、Threads、YouTube、PTT、Dcard、新聞媒體等）
- 各平台的監測頻率
- 關鍵字設定建議（品牌詞、議題詞、競品詞）

#### 1.2 關鍵字建議

| 類別 | 關鍵字 | 監測理由 | 優先級 |
|------|--------|---------|--------|
| 品牌詞 | ... | ... | 高 |
| 議題詞 | ... | ... | 中 |
| 競品詞 | ... | ... | 低 |
（至少 15 組）

### 二、KOL 合作策略

#### 2.1 KOL 分級建議

| 等級 | 粉絲數 | 合作形式 | 預算占比 | 推薦數量 |
|------|--------|---------|---------|---------|
| 頭部 KOL | >50萬 | 專題合作 | 40% | 2-3位 |
| 中腰部 KOL | 5-50萬 | 原生貼文 | 35% | 8-10位 |
| 微型 KOL | 1-5萬 | UGC 合作 | 25% | 10-15位 |

#### 2.2 KOL 篩選指標
- 互動率基準值
- 受眾吻合度評估方式
- 內容風格匹配標準

### 三、輿情報告範本

#### 3.1 週報範本結構
- 整體聲量趨勢圖（建議圖表類型）
- 正負面情緒比例
- 熱門議題 Top 5
- 重大議題通報
- 競品對比

#### 3.2 月報範本結構
- 月度聲量 vs 同期比較
- KOL 合作成效（曝光、互動、轉換）
- ROI 分析
- 下月建議

### 四、危機處理 SOP
- 分級制度（一般 / 敏感 / 重大）
- 各等級回應時限
- 通報流程
- 應對話術範本

### 五、成效 KPI 建議

| 指標 | 基準值 | 目標值 | 衡量方式 |
|------|--------|--------|---------|
| 總曝光數 | ... | ... | ... |
| 互動率 | ... | ... | ... |
（至少 8 個 KPI）

嚴格規則：
1. 全程使用台灣繁體中文
2. 數字和基準值必須基於台灣市場行情
3. 不使用 emoji
4. 分析必須切合此案的具體主題（桃園觀光 / 風景區等）`;

    const modelChannel = autoRoute('creative');
    const result = await callAI(prompt, {
      model: modelChannel, temperature: 0.5, maxTokens: 16384,
      systemPrompt: '你是台灣數位行銷與輿情分析領域的頂尖專家，服務過多個政府機關的數位行銷案。',
      userId: req.userId,
      keyIndex: req.keyIndex,
    });

    let report = cleanText(result.content || '');

    const existing = db.find('bid_sentiment', d => d.project_id === projectId);
    if (existing.length > 0) {
      db.update('bid_sentiment', existing[0].id, { report, updated_at: new Date().toISOString() });
    } else {
      db.insert('bid_sentiment', { id: uuidv4(), project_id: projectId, report, created_at: new Date().toISOString() });
    }

    res.json({ report });
  } catch (error) {
    console.error('[BidPrep] 輿情範本失敗:', error);
    res.status(500).json({ error: '輿情範本生成失敗', details: error.message });
  }
});

router.get('/sentiment-template', (req, res) => {
  const data = db.find('bid_sentiment', d => d.project_id === req.params.projectId);
  if (data.length === 0) return res.json({ report: null });
  res.json({ report: data[0].report });
});

module.exports = router;

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { callAI, autoRoute } = require('../services/ai-engine');
const db = require('../db');
const OpenCC = require('opencc-js');
const { extractTextFromFile, extractAllProjectText, CATEGORY_LABELS } = require('../utils/extract-text');

const router = express.Router({ mergeParams: true });

// POST /api/projects/:projectId/analyze
router.post('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const project = db.getById('projects', projectId);
    const isCommercial = project?.case_type === 'commercial';

    // 取得所有文件
    const docs = db.find('documents', d => d.project_id === projectId);

    // 取得文字需求（商案用）
    const textReqs = db.find('text_requirements', t => t.project_id === projectId);

    // 可分析的文件格式
    const analyzableDocs = docs.filter(d => 
      ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt'].includes((d.file_type || '').toLowerCase())
    );

    if (analyzableDocs.length === 0 && textReqs.length === 0) {
      return res.status(400).json({ 
        error: isCommercial 
          ? '請先貼上客戶需求文字或上傳文件' 
          : '找不到可分析的文件（支援 PDF、Word、Excel、TXT）' 
      });
    }

    let allText = '';
    let docStats = { pdf: 0, docx: 0, doc: 0, xlsx: 0, txt: 0 };

    // 全格式文字提取（帶文件分類標籤）
    for (const doc of analyzableDocs) {
      const categoryLabel = CATEGORY_LABELS[doc.category] || CATEGORY_LABELS.other;
      const text = await extractTextFromFile(doc);
      if (text.trim()) {
        // 帶分類標籤，讓 AI 知道每份文件的角色
        allText += `\n\n=== [${categoryLabel}] ${doc.filename} ===\n${text}`;
        const ext = (doc.file_type || '').toLowerCase();
        if (docStats[ext] !== undefined) docStats[ext]++;
      }
    }

    // 文字需求（商案）
    if (textReqs.length > 0) {
      allText += '\n\n=== [客戶需求紀錄] ===\n' + textReqs.map(t => t.content).join('\n---\n');
    }

    if (!allText.trim()) {
      return res.status(400).json({ error: '無法提取任何可分析內容' });
    }

    const totalChars = allText.length;
    const estimatedPages = Math.ceil(totalChars / 1500);
    console.log(`[AI] 分析專案 ${projectId}（${isCommercial ? '商案' : '標案'}），共 ${totalChars} 字元，約 ${estimatedPages} 頁`);
    console.log(`[AI] 文件數: PDF=${docStats.pdf}, DOCX=${docStats.docx}, DOC=${docStats.doc}, XLSX=${docStats.xlsx}, TXT=${docStats.txt}, 文字需求=${textReqs.length}`);

    // 根據案件類型調整 prompt
    const contextInfo = isCommercial
      ? `公司：${project?.company || '未指定'}\n產業：${project?.company_industry || '未指定'}`
      : `機關：${project?.agency || '未指定'}\n科室：${project?.department || '未指定'}`;

    // ============ 建構深度分析 Prompt ============
    // 不截斷文件！Gemini 支援 1M token context
    const docContent = allText;

    const prompt = isCommercial
      ? `你是一位台灣的資深商業活動企劃分析師。

## 最高優先指令

**你必須逐頁、逐段、逐條閱讀下方提供的所有文件內容，不得遺漏任何一頁、任何一個段落。**
本文件約 ${estimatedPages} 頁、${totalChars} 字，你必須完整分析每一頁的內容。如果你的輸出沒有涵蓋文件中的所有重點，就是不合格的分析。

${contextInfo}
活動類型：${project?.event_type || '未指定'}
活動日期：${project?.event_date || '未指定'}

請用 Markdown 格式撰寫一份**鉅細靡遺的完整分析報告**。嚴格遵守以下結構：

---

這份需求主要的核心內容是什麼，用 2-3 句話概述。

### 專案概述與整體分析

*   **活動目的：** 說明此活動的核心目的
*   **目標受眾：** 描述主要參與者或受眾
*   **預算範圍：** 列出所有預算資訊（總預算、各分項預算、上限與下限）
*   **時間地點：** 說明所有活動的時間節點、場地、地點
*   **企劃要求：** 企劃書份數、頁數限制、繳交期限、格式要求等規範
*   **評選規則：** 評分項目、權重比例、資格要求
*   **合約條款：** 履約保證金、違約金罰則、保險要求、驗收標準
*   （依照文件內容，新增所有其他重要的整體項目）

---

### 每個活動需要的內容

根據需求拆分每個獨立的活動區塊或服務項目，每個活動用 #### 加上編號和名稱作為標題。
**必須列出文件中提到的所有活動和子活動，不可省略。**

#### 一、 第一個活動名稱
*   **規模與規格：** 人數、場地大小、活動形式等
*   **硬體與軟體需求：** 舞台、音響、電力、帳篷、系統等，列出所有細節規格
*   **人力配置：** 主持人、工作人員、表演團體等，含數量要求
*   **預期產出：** 照片、影片、報告等交付物，含規格要求
*   **時程規劃：** 進場、演練、正式執行的時間節點
*   （依照文件內容，新增其他所有必要的面向）

#### 二、 第二個活動名稱
*   （同上結構，必須同樣詳盡）

（依此類推，**列出文件中提到的所有活動**，一個都不能少）

---

### 規格需求明細表

將文件中所有提到的具體規格、數量、尺寸、品質標準整理成表格：

| 項目 | 需求規格 | 數量 | 備註 |
|------|----------|------|------|
| ... | ... | ... | ... |

---

### 交付物與時程檢核表

將所有必須交付的文件、報告、系統、影像等整理：

| 交付物 | 規格要求 | 交付期限 | 備註 |
|--------|----------|----------|------|
| ... | ... | ... | ... |

---

### 我該注意的事項（執行雷區）

用 numbered list，每項注意事項用**粗體標題**開頭，後面接具體引用文件內容的說明段落。至少列出 8-10 項。涵蓋但不限於：

1.  **場地限制與復原：** 具體引用文件中的限制...
2.  **時程風險：** 完整說明...
3.  **預算配置建議：** 完整說明...
4.  **法規合規：** 完整說明...
5.  **客戶溝通要點：** 完整說明...
6.  **保險與安全：** 完整說明...
7.  **人力調度風險：** 完整說明...
8.  **天候備案：** 完整說明...

---

### 企劃方向建議
*   針對此案的創意方向與差異化策略建議
*   提供 3-5 個具體可執行的亮點提案方向

---

嚴格規則（違反任何一條都是不合格的輸出）：
1. 必須全程使用台灣繁體中文（正體中文），絕對不可使用簡體字
2. 不要使用任何 emoji 符號或特殊圖示
3. 必須嚴格按照上述章節結構與格式輸出
4. **每一頁的內容都必須被分析到，不可跳過任何段落**
5. 用粗體（**）標示關鍵數字、日期、金額、罰則
6. 所有數字、金額、日期、規格必須完整引用，不可概略帶過
7. 分析深度要像一位有 20 年經驗的顧問寫給執行團隊的內部文件
8. 文件已按類別標記（如 [需求說明書]、[評審須知]、[預算表/標價清單] 等），請根據每份文件的角色進行對應分析

以下是客戶提供的所有文件（共 ${estimatedPages} 頁，${totalChars} 字，你必須全部讀完並分析）：
"""
${docContent}
"""`
      : `你是一位台灣的資深政府標案分析師。

## 最高優先指令

**你必須逐頁、逐段、逐條閱讀下方提供的完整需求說明書，不得遺漏任何一頁、任何一個段落、任何一個條款。**
本文件約 ${estimatedPages} 頁、${totalChars} 字。你必須從第 1 頁讀到最後一頁，每一頁的重點都必須出現在分析報告中。如果你的輸出沒有涵蓋文件中每一頁的關鍵內容，就是不合格的分析。

${contextInfo}
活動類型：${project?.event_type || '未指定'}
活動日期：${project?.event_date || '未指定'}

請用 Markdown 格式撰寫一份**鉅細靡遺的投標分析報告**。嚴格遵守以下結構：

---

這份需求說明書主要的核心內容是什麼，用 2-3 句話概述，例如「這份文件共 ${estimatedPages} 頁，主要將專案拆分為XX和YY兩大核心」。

### 專案大綱與整體重點分析

*   **活動目的：** 說明此專案的核心目的與期望效果
*   **企劃與結案要求：** 企劃書份數、頁數限制、繳交期限、成果報告書格式等
*   **報名系統：** 線上報名系統的語言、功能、通知機制等需求（如果有的話）
*   **總預算區分：** 列出各活動或各大項的預算金額
*   **評選機制：** 評選委員組成、評分項目與配分、資格審查標準
*   **履約條款：** 履約保證金、違約處理、保固期、智慧財產權歸屬
*   **投標資格：** 廠商資格條件、必備文件、押標金規定
*   **保險需求：** 公共意外責任險、勞保、其他保險要求
*   （依照文件內容，新增所有其他重要的整體項目）

---

### 每個活動需要的內容

根據需求書拆分每個獨立活動或工作項目，每個活動用 #### 加上編號和名稱作為標題。
**必須列出需求書中提到的所有活動、子項目、工作項目，一個都不能遺漏。**

#### 一、 第一個活動名稱
*   **時間與地點：** 何時舉辦、場地在哪裡
*   **參賽資格或參與規格：** 誰可以參加、隊伍數量限制、報名規則
*   **硬體與軟體需求：** 器材、設備、系統、場地佈置等具體需求，列出完整規格
*   **人力配置需求：** 裁判、主持人、工作人員、志工等，含具體人數要求
*   **獎勵制度：** 獎項設置、獎金金額、獎盃規格等
*   **醫護與安全規範：** 醫護站、救護車、AED、緊急後送機制等
*   **紀錄與產出要求：** 照片張數與畫素規格、影片長度與格式、公布時限等
*   **預算明細：** 此活動的預算金額（如果文件有列出）
*   （依照文件內容，新增其他所有必要的面向）

#### 二、 第二個活動名稱
*   （同上結構，**必須同樣鉅細靡遺**）

（依此類推，**列出需求書中所有獨立活動和子項目**，一個都不能少）

---

### 規格需求總表

將需求書中所有提到的具體設備規格、數量、尺寸整理成表格：

| 類別 | 項目 | 需求規格 | 數量 | 出處段落 |
|------|------|----------|------|----------|
| ... | ... | ... | ... | ... |

---

### 交付物清單與時程

將所有必須交付的文件、報告、系統、影像整理：

| 交付物 | 規格要求 | 交付期限 | 罰則 |
|--------|----------|----------|------|
| ... | ... | ... | ... |

---

### 我該注意的事項（廠商執行雷區）

用 numbered list，每項注意事項用**粗體標題**開頭，後面接具體引用需求書條文的說明段落。必須從廠商實際執行角度出發，指出真正會踩雷的地方。**至少列出 10 項**。涵蓋但不限於：

1.  **文宣法規嚴格限制：** 引用需求書條文，完整說明文宣品的規範...
2.  **勞動法規與保險必備：** 公共意外責任險、勞工時薪規範、勞保投保...
3.  **場地復原與清潔時效：** 引用需求書中的拆除期限、罰則...
4.  **天氣備案機制：** 雨天備案要求、通報體系...
5.  **合規性標準：** 適用法規...
6.  **履約保證金與違約金：** 金額、條件、計算方式...
7.  **智慧財產權：** 歸屬、授權範圍...
8.  **人力資格要求：** 證照、經歷、學歷要求...
9.  **報告格式與份數：** 結案報告、成果報告的格式要求...
10. **時程管控要點：** 關鍵里程碑、逾期罰則...

（依照文件內容可新增更多注意事項）

---

### 投標策略建議
*   針對此案的得分策略與差異化建議
*   提供 3-5 個具體的企劃亮點方向
*   評選配分的應對策略

---

嚴格規則（違反任何一條都是不合格的輸出）：
1. 必須全程使用台灣繁體中文（正體中文），絕對不可使用簡體字
2. 不要使用任何 emoji 符號或特殊圖示
3. 必須嚴格按照上述章節結構與格式輸出
4. **每一頁的內容都必須被分析到，不可跳過任何頁面或段落**
5. 「注意事項」要從廠商實際執行角度出發，每項都要具體引用需求書中的規範與條文
6. 用粗體（**）標示關鍵數字、日期、金額、罰則
7. 所有數字、金額、日期、規格必須完整引用原文，不可概略帶過或遺漏
8. 分析深度要像一位有 20 年經驗的標案顧問寫給執行團隊的內部戰術文件
9. 文件已按類別標記（如 [需求說明書]、[評審須知]、[預算表/標價清單] 等），請根據每份文件的角色進行對應分析
10. 如果文件中有「服務建議書應載事項」章節，必須在報告最後列出完整的必要章節清單
11. 如果有 [評審須知] 文件，必須完整提取評審項目評分表（項目名稱 + 配分百分比 + 評審重點）
12. 如果有 [預算表/標價清單] 文件，必須完整列出每一個工作項目、細項、單位、數量

---

【最後一步：結構化數據匯出——絕對不可省略】

在你的 Markdown 報告完成後，你必須在報告的最末尾，另起一行，輸出一個 JSON 區塊。這個 JSON 區塊必須用 \`\`\`json 和 \`\`\` 包裹，格式如下：

\`\`\`json
{
  "summary": {
    "budget": "新臺幣 300 萬元整（含稅）",
    "duration": "自簽約日起至 115 年 9 月 30 日",
    "location": "新北市板橋區",
    "event_date": "2026 年 7 月 15 日至 7 月 17 日"
  },
  "evaluationCriteria": [
    { "item_name": "評審項目名稱", "weight": 25, "description": "評審重點說明" }
  ],
  "requiredChapters": ["服務建議書第一章標題", "第二章標題"],
  "priceListItems": [
    { "item": "工作項目名稱", "detail": "細項說明", "unit": "式", "quantity": 1 }
  ]
}
\`\`\`

填寫規則：
- summary：從文件中提取專案摘要資訊，每個欄位都必須填寫
  - budget：採購金額/預算金額，必須寫完整金額（例如「新臺幣 300 萬元整（含稅）」），如果文件沒有寫則填「未載明」
  - duration：專案期程/履約期限（例如「自簽約日起 180 日曆天」或「114年6月至115年3月」），如果文件沒有寫則填「未載明」
  - location：活動地點或機關所在地（例如「新北市板橋區」），如果文件沒有寫則填「未載明」
  - event_date：活動舉辦日期（例如「2026年7月15日至17日」），如果文件沒有寫則填「未載明」
- evaluationCriteria：從 [評審須知] 中提取所有評分項目，weight 必須是數字（百分比），如果沒有評審須知則輸出空陣列 []
- requiredChapters：從「服務建議書應載事項」中提取章節名稱，如果沒有則輸出空陣列 []
- priceListItems：從 [預算表/標價清單] 中提取所有工作項目，如果沒有則輸出空陣列 []
- 即使某個欄位沒有資料，也必須輸出空陣列 []，不可省略整個 JSON 區塊

以下是標案完整文件（共 ${estimatedPages} 頁，${totalChars} 字，你必須從頭到尾全部讀完並分析）：
"""
${docContent}
"""`;

    // 使用 Gemini（1M context） 完整分析全部內容
    const modelChannel = autoRoute('analysis');
    console.log(`[Analysis] 選用模型: ${modelChannel}, 輸入字數: ${docContent.length}`);

    const chatResult = await callAI(prompt, {
      model: modelChannel,
      temperature: 0.2,
      maxTokens: 65536,  // Gemini 支援大量輸出
      systemPrompt: '你是一位資深的台灣標案與活動企劃分析師，專長是鉅細靡遺地分析需求文件，絕不遺漏任何頁面的內容。你的分析報告必須完整涵蓋文件的每一頁。',
    });
    console.log(`[Analysis] AI 回應完成, provider: ${chatResult.model}, 輸出字數: ${(chatResult.content || '').length}`);

    let aiResponse = chatResult.content || '';
    
    // 強制清除所有 emoji 符號（保留換行）
    aiResponse = aiResponse.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{20E3}]/gu, '').replace(/[^\S\n]{2,}/g, ' ');

    // 簡體轉繁體（Qwen3 預設輸出簡體，強制後處理轉換）
    const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });
    aiResponse = s2tConverter(aiResponse);

    let analysisJson;
    try {
      // 新策略：分離 Markdown 報告和尾部 JSON
      // 嘗試多種分隔方式
      let markdownReport = aiResponse;
      let metaJson = {};

      // 方式 1: 尋找最後一個 ```json ... ``` 區塊
      const allJsonBlocks = [...aiResponse.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
      if (allJsonBlocks.length > 0) {
        const lastBlock = allJsonBlocks[allJsonBlocks.length - 1];
        try {
          metaJson = JSON.parse(lastBlock[1].trim());
          // 如果解析成功，報告就是 JSON 區塊之前的部分
          const blockStart = aiResponse.lastIndexOf(lastBlock[0]);
          // 往前找 ---（如果有的話）
          const beforeBlock = aiResponse.substring(0, blockStart);
          const sepIdx = beforeBlock.lastIndexOf('\n---');
          markdownReport = (sepIdx > 0 ? beforeBlock.substring(0, sepIdx) : beforeBlock).trim();
        } catch {
          // JSON 解析失敗，保持整個回應為報告
        }
      } else {
        // 方式 2: 用 --- 分隔
        const separatorIndex = aiResponse.lastIndexOf('\n---');
        if (separatorIndex > 0 && separatorIndex > aiResponse.length * 0.5) {
          markdownReport = aiResponse.substring(0, separatorIndex).trim();
          const tailPart = aiResponse.substring(separatorIndex);
          // 嘗試從尾部提取 JSON（可能沒有 code fence）
          const jsonStart = tailPart.indexOf('{');
          const jsonEnd = tailPart.lastIndexOf('}');
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            try { metaJson = JSON.parse(tailPart.substring(jsonStart, jsonEnd + 1)); } catch {}
          }
        }
      }

      // 如果整個回應就是 JSON（舊模型行為），fallback
      if (!markdownReport || markdownReport.startsWith('{')) {
        try {
          const directJson = JSON.parse(markdownReport.replace(/```(?:json)?\s*/g, '').replace(/```/g, '').trim());
          analysisJson = directJson;
        } catch {
          analysisJson = { report: markdownReport, meta: metaJson };
        }
      } else {
        analysisJson = { report: markdownReport, meta: metaJson };
      }

      // === 確保 summary 欄位存在（從 JSON 或 Markdown 報告中提取） ===
      if (!analysisJson.meta) analysisJson.meta = {};
      const metaSummary = analysisJson.meta.summary || {};
      
      // 如果 AI JSON 沒有 summary，從 Markdown 報告中 regex 提取
      if (!metaSummary.budget || metaSummary.budget === '未載明') {
        const budgetMatch = markdownReport?.match(/預算(?:金額)?(?:為|：|:)?\s*(?:新臺幣|NT\$)?\s*\**([\d,]+(?:\.\d+)?\s*(?:萬|億)?元[^\n。，]*)/i);
        if (budgetMatch) metaSummary.budget = '新臺幣 ' + budgetMatch[1].replace(/\*/g, '');
      }
      if (!metaSummary.duration || metaSummary.duration === '未載明') {
        const durationMatch = markdownReport?.match(/(?:期程|期限|履約)[^\n]*?(?:為|：|:)?\s*\**([^\n。]{5,40}?)\**/i);
        if (durationMatch) metaSummary.duration = durationMatch[1].replace(/\*/g, '').trim();
      }
      if (!metaSummary.location || metaSummary.location === '未載明') {
        // 用 project 的 agency 作為 fallback
        metaSummary.location = metaSummary.location || project?.agency || '未載明';
      }
      if (!metaSummary.event_date || metaSummary.event_date === '未載明') {
        const dateMatch = markdownReport?.match(/活動(?:日期|時間)[^\n]*?(?:為|：|:)?\s*\**([^\n。]{5,30}?)\**/i);
        if (dateMatch) metaSummary.event_date = dateMatch[1].replace(/\*/g, '').trim();
      }
      
      analysisJson.meta.summary = metaSummary;

    } catch {
      analysisJson = { rawResponse: aiResponse };
    }

    const id = uuidv4();
    db.insert('analyses', {
      id, project_id: projectId,
      analysis_json: JSON.stringify(analysisJson),
      raw_text: allText.substring(0, 100000),
      model_used: chatResult.model || 'unknown'
    });

    db.update('projects', projectId, { status: 'analyzing' });
    console.log(`[AI] 分析完成 id=${id}`);
    res.json({ id, analysis: analysisJson });

  } catch (error) {
    console.error('[AI] 分析失敗:', error);
    res.status(500).json({ error: '分析失敗', details: error.message });
  }
});

// GET /api/projects/:projectId/analysis
router.get('/', (req, res) => {
  const analyses = db.find('analyses', a => a.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (analyses.length === 0) return res.status(404).json({ error: '尚未進行分析' });
  const latest = analyses[0];
  res.json({ ...latest, analysis_json: JSON.parse(latest.analysis_json) });
});

// PUT /api/projects/:projectId/analysis
router.put('/', (req, res) => {
  const { analysis_json } = req.body;
  const analyses = db.find('analyses', a => a.project_id === req.params.projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (analyses.length === 0) return res.status(404).json({ error: '尚未進行分析' });
  db.update('analyses', analyses[0].id, { analysis_json: JSON.stringify(analysis_json) });
  res.json({ success: true });
});

module.exports = router;

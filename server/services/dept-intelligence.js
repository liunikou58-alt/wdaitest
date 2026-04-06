/**
 * WDAITEST — 科室深度情境引擎 (Department Intelligence Engine)
 * 
 * 根據「機關 + 科室」自動透過 AI 研究該部門背景，
 * 產出結構化「科室情報卡」注入後續所有 AI 生成的 prompt。
 */
const { v4: uuidv4 } = require('uuid');
const ai = require('../ai-provider');
const db = require('../db');
const OpenCC = require('opencc-js');

// === 簡轉繁 ===
function cleanAiResponse(text) {
  let cleaned = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}\u{200D}\u{20E3}]/gu, '').replace(/[^\S\n]{2,}/g, ' ');
  const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'twp' });
  cleaned = s2tConverter(cleaned);
  return cleaned;
}

/**
 * 產生科室情報卡的 AI prompt
 */
function buildResearchPrompt(agency, department, eventType, extraContext) {
  return `【任務】你是一位台灣政府機關組織研究專家。請根據以下機關與科室資訊，進行深度研究分析，產出一份「科室情報卡」。

你必須基於你的訓練知識中關於台灣政府機關的資訊，推理分析該科室可能的業務職掌、過去活動案例、和創意方向。即使你不確定某些細節，也要根據機關名稱和科室名稱進行合理推理。

機關名稱：${agency}
科室名稱：${department || '(未指定科室，請針對整個機關分析)'}
活動類型：${eventType || '(未指定)'}
${extraContext ? `\n補充資訊：${extraContext}` : ''}

請嚴格以 JSON 格式輸出（只輸出純 JSON，不要加其他文字）：

{
  "mission_summary": "該科室/機關的核心業務職掌摘要（100-150字，具體描述負責什麼政策、什麼服務、服務對象是誰）",

  "core_programs": [
    "該單位推動的核心計畫或政策名稱（至少列 4-6 個，要具體，例如：長照2.0失智社區服務據點推動計畫）"
  ],

  "target_audience": {
    "primary": "主要服務/活動對象（例如：失智症患者家屬與照護者）",
    "secondary": "次要參與對象（例如：社區民眾、醫療從業人員）",
    "decision_makers": "內部決策鏈（例如：科長、處長、局長室）"
  },

  "key_issues": [
    "該領域目前面臨的核心議題/痛點（至少 4 個，要具體，例如：失智症污名化導致民眾不願就醫）"
  ],

  "past_events_reference": [
    "該單位或同類單位過去舉辦過的活動/記者會/宣導案例（至少 4 個，盡量真實具體）"
  ],

  "international_benchmarks": [
    "國際上同領域的標竿做法/案例（至少 3-4 個，含國家名稱和案例名稱）"
  ],

  "evaluation_focus": [
    "這類標案的評審委員通常最看重什麼（至少 4 項，例如：對弱勢族群的關懷與同理心設計）"
  ],

  "creative_directions": [
    "針對這個科室業務，AI 建議的創意發想方向（至少 4 個方向，要具體且有啟發性，例如：用溫暖取代恐懼——重新定義失智者的社會角色）"
  ],

  "sensitive_terms": [
    "這個領域的用詞禁忌/建議（至少 3 個，例如：避免使用「老人癡呆」，應使用「失智症」）"
  ],

  "domain_keywords": [
    "這個領域的專業術語/關鍵詞（至少 6 個，方便後續 AI 在企劃書中使用正確術語）"
  ],

  "budget_reference": {
    "typical_range": "這類活動的常見預算範圍（例如：宣導活動 50-200 萬）",
    "cost_sensitive_items": ["需要特別注意費用的項目（例如：無障礙設施、手語翻譯）"]
  },

  "regulatory_requirements": [
    "該領域相關的法規要求（至少 3 個，例如：大型活動安全管理辦法、公共意外責任險、食安法規）"
  ],

  "success_metrics": [
    "這類活動的常見成功指標（至少 4 個，例如：參與人數、媒體曝光度、滿意度調查分數、社群互動量）"
  ]
}

嚴格規則：
1. 全程使用台灣繁體中文
2. 不要使用任何 emoji
3. 所有內容必須與該機關/科室的實際業務相關，不要產生泛用內容
4. 如果不確定某些資訊，基於機關名稱和科室名稱進行合理推理，但要讓推理結果具體且可用
5. past_events_reference 盡量接近真實案例，如果不確定可以基於該類機關常辦的活動類型推理`;
}

/**
 * 產生公司/產業情報卡的 AI prompt（商案用）
 */
function buildCompanyResearchPrompt(company, industry, eventType, extraContext) {
  return `【任務】你是一位台灣企業研究分析師。請根據以下公司與產業資訊，進行深度研究分析，產出一份「企業情報卡」。

公司名稱：${company}
公司產業：${industry || '(未指定)'}
活動類型：${eventType || '(未指定)'}
${extraContext ? `\n補充資訊：${extraContext}` : ''}

請嚴格以 JSON 格式輸出（只輸出純 JSON，不要加其他文字）：

{
  "mission_summary": "該公司/產業的核心業務與文化特質摘要（100-150字）",

  "core_programs": [
    "該公司或產業常見的企業活動類型（至少 4 個）"
  ],

  "target_audience": {
    "primary": "活動主要參與者（例如：全體員工及眷屬）",
    "secondary": "次要對象（例如：合作廠商、VIP 客戶）",
    "decision_makers": "決策鏈（例如：人資部門、總經理室）"
  },

  "key_issues": [
    "該產業目前面臨的核心議題/員工關注點（至少 4 個）"
  ],

  "past_events_reference": [
    "同產業知名企業舉辦過的標竿活動案例（至少 4 個）"
  ],

  "international_benchmarks": [
    "國際同業的企業活動標竿做法（至少 3 個）"
  ],

  "evaluation_focus": [
    "這類企業活動提案時，客戶決策者通常最看重什麼（至少 4 項）"
  ],

  "creative_directions": [
    "針對這個產業特性的創意活動方向建議（至少 4 個方向）"
  ],

  "sensitive_terms": [
    "與該公司/產業互動的注意事項（至少 3 個）"
  ],

  "domain_keywords": [
    "該產業的專業術語/常用詞彙（至少 6 個）"
  ],

  "budget_reference": {
    "typical_range": "這類企業活動的常見預算範圍",
    "cost_sensitive_items": ["需要特別注意的費用項目"]
  }
}

嚴格規則：
1. 全程使用台灣繁體中文
2. 不要使用任何 emoji
3. 所有內容必須與該公司/產業的實際特性相關`;
}

/**
 * 執行科室/企業深度研究
 * @param {string} projectId
 * @param {Object} projectData - { case_type, agency, department, company, company_industry, event_type }
 * @param {string} extraContext - 使用者手動補充的背景說明
 * @returns {Object} 情報卡資料
 */
async function researchDepartment(projectId, projectData, extraContext = '') {
  const isTender = projectData.case_type !== 'commercial';

  let prompt;
  if (isTender) {
    if (!projectData.agency) throw new Error('標案需要填寫機關名稱');
    prompt = buildResearchPrompt(
      projectData.agency,
      projectData.department,
      projectData.event_type,
      extraContext
    );
  } else {
    if (!projectData.company) throw new Error('商案需要填寫公司名稱');
    prompt = buildCompanyResearchPrompt(
      projectData.company,
      projectData.company_industry,
      projectData.event_type,
      extraContext
    );
  }

  console.log(`[DeptIntel] 開始研究: ${isTender ? projectData.agency + ' / ' + projectData.department : projectData.company}`);

  // 標記研究中
  db.removeWhere('dept_intelligence', d => d.project_id === projectId);
  const placeholder = db.insert('dept_intelligence', {
    id: uuidv4(),
    project_id: projectId,
    status: 'researching',
    intel_json: '{}',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  try {
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { temperature: 0.4, max_tokens: 6144, timeout: 120000 }
    );

    let aiResponse = cleanAiResponse(result.content || '{}');
    aiResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // 解析 JSON
    let intel;
    try {
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResponse.trim();
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        intel = JSON.parse(jsonStr.substring(start, end + 1));
      } else {
        intel = JSON.parse(jsonStr);
      }
    } catch (e) {
      console.error('[DeptIntel] JSON 解析失敗:', e.message);
      intel = { mission_summary: aiResponse.substring(0, 500), parse_error: true };
    }

    // 更新 DB
    db.update('dept_intelligence', placeholder.id, {
      status: 'completed',
      intel_json: JSON.stringify(intel),
      provider: result.provider,
      model: result.model,
      updated_at: new Date().toISOString(),
    });

    console.log(`[DeptIntel] 研究完成: ${Object.keys(intel).length} 個欄位`);
    return { id: placeholder.id, status: 'completed', intel };

  } catch (error) {
    console.error('[DeptIntel] 研究失敗:', error.message);
    db.update('dept_intelligence', placeholder.id, {
      status: 'failed',
      error_message: error.message,
      updated_at: new Date().toISOString(),
    });
    throw error;
  }
}

/**
 * 取得專案的科室情報（已快取）
 * @param {string} projectId
 * @returns {Object|null} 情報卡資料，或 null
 */
function getIntelligence(projectId) {
  const records = db.find('dept_intelligence', d => d.project_id === projectId);
  if (records.length === 0) return null;
  const latest = records.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  try {
    return {
      id: latest.id,
      status: latest.status,
      intel: JSON.parse(latest.intel_json || '{}'),
      provider: latest.provider,
      model: latest.model,
      created_at: latest.created_at,
      updated_at: latest.updated_at,
      error_message: latest.error_message,
    };
  } catch {
    return { id: latest.id, status: latest.status, intel: {}, error_message: 'JSON 解析錯誤' };
  }
}

/**
 * 將科室情報格式化為 prompt 注入字串
 * 用於插入到 themes / highlights / proposal-writing 的 AI prompt 中
 * @param {string} projectId
 * @returns {string} 可直接插入 prompt 的情境脈絡文字
 */
function formatIntelForPrompt(projectId) {
  const data = getIntelligence(projectId);
  if (!data || data.status !== 'completed' || !data.intel) return '';

  const intel = data.intel;
  if (intel.parse_error) return '';

  let sections = [];

  sections.push('=== 科室/單位深度情報 ===');

  if (intel.mission_summary) {
    sections.push(`【單位業務職掌】\n${intel.mission_summary}`);
  }
  if (intel.core_programs?.length) {
    sections.push(`【核心計畫/政策】\n${intel.core_programs.map(p => `- ${p}`).join('\n')}`);
  }
  if (intel.target_audience) {
    sections.push(`【目標受眾】\n- 主要對象：${intel.target_audience.primary || ''}\n- 次要對象：${intel.target_audience.secondary || ''}\n- 決策鏈：${intel.target_audience.decision_makers || ''}`);
  }
  if (intel.key_issues?.length) {
    sections.push(`【領域核心痛點/議題】\n${intel.key_issues.map(i => `- ${i}`).join('\n')}`);
  }
  if (intel.past_events_reference?.length) {
    sections.push(`【過去活動案例參考】\n${intel.past_events_reference.map(e => `- ${e}`).join('\n')}`);
  }
  if (intel.international_benchmarks?.length) {
    sections.push(`【國際標竿做法】\n${intel.international_benchmarks.map(b => `- ${b}`).join('\n')}`);
  }
  if (intel.evaluation_focus?.length) {
    sections.push(`【評審/決策者重視要素】\n${intel.evaluation_focus.map(f => `- ${f}`).join('\n')}`);
  }
  if (intel.creative_directions?.length) {
    sections.push(`【建議創意發想方向】\n${intel.creative_directions.map(d => `- ${d}`).join('\n')}`);
  }
  if (intel.sensitive_terms?.length) {
    sections.push(`【用語注意事項】\n${intel.sensitive_terms.map(t => `- ${t}`).join('\n')}`);
  }
  if (intel.domain_keywords?.length) {
    sections.push(`【領域專業術語】\n${intel.domain_keywords.join('、')}`);
  }
  if (intel.budget_reference) {
    sections.push(`【預算參考】\n常見範圍：${intel.budget_reference.typical_range || ''}\n注意項目：${(intel.budget_reference.cost_sensitive_items || []).join('、')}`);
  }
  if (intel.regulatory_requirements?.length) {
    sections.push(`【相關法規要求】\n${intel.regulatory_requirements.map(r => `- ${r}`).join('\n')}`);
  }
  if (intel.success_metrics?.length) {
    sections.push(`【活動成功指標】\n${intel.success_metrics.map(m => `- ${m}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * 手動更新科室情報卡（使用者修正）
 */
function updateIntelligence(intelId, updates) {
  const existing = db.getById('dept_intelligence', intelId);
  if (!existing) return null;
  
  let intel;
  try {
    intel = JSON.parse(existing.intel_json || '{}');
  } catch {
    intel = {};
  }
  
  // 合併更新
  Object.assign(intel, updates);
  
  return db.update('dept_intelligence', intelId, {
    intel_json: JSON.stringify(intel),
    updated_at: new Date().toISOString(),
  });
}

module.exports = {
  researchDepartment,
  getIntelligence,
  formatIntelForPrompt,
  updateIntelligence,
};

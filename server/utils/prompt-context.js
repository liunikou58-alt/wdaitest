/**
 * 專案上下文收集器 — 統一的 Prompt 注入工具
 * 
 * 從 DB 收集專案的所有既有 AI 產出，組裝為 prompt 注入字串。
 * 讓每一步驟都能讀取前面所有步驟的產出，形成完整的 AI 記憶鏈。
 */
const db = require('../db');
const { formatIntelForPrompt } = require('../services/dept-intelligence');

/**
 * 從 DB 讀取專案的分析報告（Step 2 產出）
 */
function getAnalysisContext(projectId, maxChars = 6000) {
  const analyses = db.find('analyses', a => a.project_id === projectId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  if (analyses.length === 0) return { report: '', structured: {} };
  
  try {
    const parsed = JSON.parse(analyses[0].analysis_json);
    return {
      report: (parsed.report || '').substring(0, maxChars),
      structured: {
        coreRequirements: parsed.coreRequirements || parsed.meta?.coreRequirements || [],
        evaluationCriteria: parsed.evaluationCriteria || parsed.meta?.evaluationCriteria || [],
        summary: parsed.summary || parsed.meta?.summary || {},
        budget: parsed.summary?.budget || parsed.meta?.budget || '',
        location: parsed.summary?.location || parsed.meta?.location || '',
        duration: parsed.summary?.duration || parsed.meta?.duration || '',
      },
    };
  } catch {
    return { report: '', structured: {} };
  }
}

/**
 * 從 DB 讀取主題方案報告（Step 3 產出）
 */
function getThemeContext(projectId, maxChars = 4000) {
  const themes = db.find('theme_proposals', t => t.project_id === projectId);
  const withReport = themes.find(t => t.report);
  return {
    report: (withReport?.report || '').substring(0, maxChars),
    highlightsReport: (withReport?.highlights_report || '').substring(0, maxChars),
    directionsJson: withReport?.directions_json || null,
  };
}

/**
 * 從 DB 讀取已選子活動（Step 3 → Step 4 之間）
 */
function getSelectedActivities(projectId) {
  const selectedData = db.find('selected_sub_activities', s => s.project_id === projectId);
  if (selectedData.length === 0) return [];
  
  try {
    return JSON.parse(selectedData[0].items_json) || [];
  } catch {
    return [];
  }
}

/**
 * 從 DB 讀取亮點報告（Step 4 產出）
 */
function getHighlightsContext(projectId) {
  const highlights = db.find('highlights', h => h.project_id === projectId && h.is_selected);
  return highlights.map(h => ({
    title: h.title,
    description: h.description,
    expectedEffect: h.expected_effect,
    costLevel: h.cost_level,
    mappedCriteria: h.mapped_criteria,
  }));
}

/**
 * 組裝完整的專案上下文 — 供 Prompt 注入
 * 
 * @param {string} projectId
 * @param {Object} options
 * @param {string[]} options.include - 要包含的區塊（預設全部）
 *   可選值: 'intel', 'analysis', 'themes', 'highlights', 'activities', 'evaluation'
 * @param {number} options.maxChars - 總字數上限（預設 20000）
 * @returns {string} 可直接插入 prompt 的情境脈絡文字
 */
function buildProjectContext(projectId, options = {}) {
  const include = options.include || ['intel', 'analysis', 'themes', 'highlights', 'activities', 'evaluation'];
  const maxChars = options.maxChars || 20000;
  
  const sections = [];
  let totalChars = 0;
  
  function addSection(content) {
    if (!content || totalChars >= maxChars) return;
    const trimmed = content.substring(0, maxChars - totalChars);
    sections.push(trimmed);
    totalChars += trimmed.length;
  }
  
  // 1. 科室/企業深度情報
  if (include.includes('intel')) {
    const intel = formatIntelForPrompt(projectId);
    if (intel) addSection(intel);
  }
  
  // 2. 分析報告
  if (include.includes('analysis') || include.includes('evaluation')) {
    const analysis = getAnalysisContext(projectId, Math.min(8000, maxChars / 3));
    
    if (include.includes('evaluation') && analysis.structured.evaluationCriteria?.length > 0) {
      const evalText = '=== 評選標準 ===\n' +
        analysis.structured.evaluationCriteria
          .map(c => `- ${c.item || c.name}：${c.weight || c.score || ''}%${c.description ? ` — ${c.description}` : ''}`)
          .join('\n');
      addSection(evalText);
    }
    
    if (include.includes('analysis') && analysis.report) {
      addSection(`=== AI 分析報告摘要 ===\n${analysis.report}`);
    }
    
    // 結構化資訊
    if (analysis.structured.coreRequirements?.length > 0) {
      addSection(`核心需求：${analysis.structured.coreRequirements.join('、')}`);
    }
    if (analysis.structured.budget) {
      addSection(`預算：${analysis.structured.budget}`);
    }
  }
  
  // 3. 主題方案
  if (include.includes('themes')) {
    const theme = getThemeContext(projectId, Math.min(5000, maxChars / 4));
    if (theme.report) {
      addSection(`=== 主題包裝方案摘要 ===\n${theme.report}`);
    }
  }
  
  // 4. 已選子活動
  if (include.includes('activities')) {
    const activities = getSelectedActivities(projectId);
    if (activities.length > 0) {
      const actText = '=== 已選定的子活動 ===\n' +
        activities.map(a => `- ${a.name}：${a.description || ''}（預期效果：${a.effect || ''}）`).join('\n');
      addSection(actText);
    }
  }

  // 5. 亮點
  if (include.includes('highlights')) {
    const highlights = getHighlightsContext(projectId);
    if (highlights.length > 0) {
      const hlText = '=== 已確認的殺手級亮點 ===\n' +
        highlights.map(h => `- ${h.title}：${h.description}（效果：${h.expectedEffect || ''}）`).join('\n');
      addSection(hlText);
    }
  }
  
  return sections.join('\n\n');
}

module.exports = {
  buildProjectContext,
  getAnalysisContext,
  getThemeContext,
  getSelectedActivities,
  getHighlightsContext,
};

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('pf_token');
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '請求失敗');
  return data;
}

export const api = {
  // 專案
  getProjects: () => request('/projects'),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id) => request(`/projects/${id}`),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  // 文件
  getDocuments: (projectId) => request(`/projects/${projectId}/documents`),
  uploadDocuments: async (projectId, files, category) => {
    const token = getToken();
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (category) formData.append('category', category);
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/projects/${projectId}/documents`, { method: 'POST', body: formData, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上傳失敗');
    return data;
  },
  deleteDocument: (projectId, docId) => request(`/projects/${projectId}/documents/${docId}`, { method: 'DELETE' }),

  // 文字需求（商案用）
  getTextRequirements: (projectId) => request(`/projects/${projectId}/documents/text-requirements`),
  saveTextRequirement: (projectId, content) => request(`/projects/${projectId}/documents/text-requirements`, { method: 'POST', body: JSON.stringify({ content }) }),
  deleteTextRequirement: (projectId, id) => request(`/projects/${projectId}/documents/text-requirements/${id}`, { method: 'DELETE' }),

  // AI 分析
  analyze: (projectId) => request(`/projects/${projectId}/analyze`, { method: 'POST' }),
  getAnalysis: (projectId) => request(`/projects/${projectId}/analyze`),
  updateAnalysis: (projectId, data) => request(`/projects/${projectId}/analyze`, { method: 'PUT', body: JSON.stringify({ analysis_json: data }) }),

  // 成本估算
  getCosts: (projectId) => request(`/projects/${projectId}/costs`),
  addCost: (projectId, data) => request(`/projects/${projectId}/costs`, { method: 'POST', body: JSON.stringify(data) }),
  updateCost: (projectId, costId, data) => request(`/projects/${projectId}/costs/${costId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCost: (projectId, costId) => request(`/projects/${projectId}/costs/${costId}`, { method: 'DELETE' }),
  aiCostSuggest: (projectId) => request(`/projects/${projectId}/costs/ai-suggest`, { method: 'POST' }),
  importQuotation: (projectId) => request(`/projects/${projectId}/costs/import-quotation`, { method: 'POST' }),
  autoAdjustCosts: (projectId) => request(`/projects/${projectId}/costs/auto-adjust`, { method: 'POST' }),

  // 主題
  getThemes: (projectId) => request(`/projects/${projectId}/themes`),
  getDirectionQuestions: (projectId) => request(`/projects/${projectId}/themes/direction-questions`, { method: 'POST' }),
  generateThemes: (projectId, styles, directions) => request(`/projects/${projectId}/themes/generate`, {
    method: 'POST', body: JSON.stringify({ styles, directions })
  }),
  selectTheme: (projectId, themeId) => request(`/projects/${projectId}/themes/${themeId}/select`, { method: 'PUT' }),
  expandTheme: (projectId, themeId) => request(`/projects/${projectId}/themes/${themeId}/expand`, { method: 'POST' }),
  extractActivities: (projectId) => request(`/projects/${projectId}/themes/extract-activities`, { method: 'POST' }),

  // 子活動勾選
  saveSelectedSubActivities: (projectId, items) => request(`/projects/${projectId}/themes/selected-activities`, {
    method: 'POST', body: JSON.stringify({ items })
  }),
  getSelectedSubActivities: (projectId) => request(`/projects/${projectId}/themes/selected-activities`),

  // 亮點
  getHighlights: (projectId) => request(`/projects/${projectId}/highlights`),
  getHighlightsReport: (projectId) => request(`/projects/${projectId}/highlights/report`),
  generateHighlights: (projectId) => request(`/projects/${projectId}/highlights/generate`, { method: 'POST' }),
  addHighlight: (projectId, data) => request(`/projects/${projectId}/highlights`, { method: 'POST', body: JSON.stringify(data) }),
  updateHighlight: (projectId, hId, data) => request(`/projects/${projectId}/highlights/${hId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHighlight: (projectId, hId) => request(`/projects/${projectId}/highlights/${hId}`, { method: 'DELETE' }),

  // 企劃架構總表
  getPlanSummary: (projectId) => request(`/projects/${projectId}/plan-summary`),
  generatePlanSummary: (projectId) => request(`/projects/${projectId}/plan-summary/generate`, { method: 'POST' }),
  getAiSuggestion: (projectId, subActivityId) => request(`/projects/${projectId}/plan-summary/suggestion/${subActivityId}`, { method: 'POST' }),
  saveConfirmedItems: (projectId, confirmedItems, criteriaMapping) => request(`/projects/${projectId}/plan-summary/confirmed-items`, {
    method: 'PUT', body: JSON.stringify({ confirmed_items: confirmedItems, criteria_mapping: criteriaMapping }),
  }),

  // 風格關鍵詞（全域設定）
  getStyleKeywords: () => request('/settings/style-keywords'),
  addStyleKeyword: (keyword) => request('/settings/style-keywords', { method: 'POST', body: JSON.stringify({ keyword }) }),
  deleteStyleKeyword: (id) => request(`/settings/style-keywords/${id}`, { method: 'DELETE' }),

  // 企劃書
  generateProposal: (projectId) => request(`/projects/${projectId}/proposal/generate`, { method: 'POST' }),

  // 投標
  getBid: (projectId) => request(`/projects/${projectId}/bid`),
  saveBid: (projectId, data) => request(`/projects/${projectId}/bid`, { method: 'POST', body: JSON.stringify(data) }),
  updateBid: (projectId, data) => request(`/projects/${projectId}/bid`, { method: 'PUT', body: JSON.stringify(data) }),

  // 投標準備工具
  generateBidQA: (projectId) => request(`/projects/${projectId}/bid-prep/qa`, { method: 'POST' }),
  getBidQA: (projectId) => request(`/projects/${projectId}/bid-prep/qa`),
  generateBidPresentation: (projectId) => request(`/projects/${projectId}/bid-prep/presentation`, { method: 'POST' }),
  getBidPresentation: (projectId) => request(`/projects/${projectId}/bid-prep/presentation`),
  generateBudgetStrategy: (projectId) => request(`/projects/${projectId}/bid-prep/budget-strategy`, { method: 'POST' }),
  getBudgetStrategy: (projectId) => request(`/projects/${projectId}/bid-prep/budget-strategy`),
  generateCompetitorAnalysis: (projectId) => request(`/projects/${projectId}/bid-prep/competitor`, { method: 'POST' }),
  getCompetitorAnalysis: (projectId) => request(`/projects/${projectId}/bid-prep/competitor`),
  generateGantt: (projectId) => request(`/projects/${projectId}/bid-prep/gantt`, { method: 'POST' }),
  getGantt: (projectId) => request(`/projects/${projectId}/bid-prep/gantt`),
  generateSentimentTemplate: (projectId) => request(`/projects/${projectId}/bid-prep/sentiment-template`, { method: 'POST' }),
  getSentimentTemplate: (projectId) => request(`/projects/${projectId}/bid-prep/sentiment-template`),

  // 簡報
  generatePresentation: (projectId) => request(`/projects/${projectId}/presentation/generate`, { method: 'POST' }),

  // 情報中心
  searchBids: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/intel/search?${qs}`);
  },
  getSavedBids: () => request('/intel/saved'),
  saveBid: (bid) => request('/intel/save', { method: 'POST', body: JSON.stringify({ bid }) }),
  removeSavedBid: (id) => request(`/intel/saved/${id}`, { method: 'DELETE' }),
  aiMatchBid: (bid) => request('/intel/match', { method: 'POST', body: JSON.stringify({ bid }) }),

  // 外部帳號管理
  getExternalAccounts: () => request('/intel/accounts'),
  saveExternalAccount: (data) => request('/intel/accounts', { method: 'POST', body: JSON.stringify(data) }),
  deleteExternalAccount: (platform) => request(`/intel/accounts/${platform}`, { method: 'DELETE' }),

  // 追蹤關鍵詞
  getTrackingKeywords: () => request('/intel/keywords'),
  addTrackingKeyword: (keyword) => request('/intel/keywords', { method: 'POST', body: JSON.stringify({ keyword }) }),
  deleteTrackingKeyword: (id) => request(`/intel/keywords/${id}`, { method: 'DELETE' }),

  // 對標公司
  getCompetitors: () => request('/intel/competitors'),
  addCompetitor: (name, notes) => request('/intel/competitors', { method: 'POST', body: JSON.stringify({ name, notes }) }),
  deleteCompetitor: (id) => request(`/intel/competitors/${id}`, { method: 'DELETE' }),

  // 代碼分類查詢
  getCategories: () => request('/intel/categories'),
  searchByCode: (code) => request(`/intel/search-by-code?code=${code}`),

  // 決標查詢 + 趨勢分析
  searchAwards: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/intel/awards?${qs}`);
  },
  analyzeTrend: (awards) => request('/intel/analyze-trend', { method: 'POST', body: JSON.stringify({ awards }) }),

  // 競品資料庫
  getRecords: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/intel/records?${qs}`); },
  addRecord: (data) => request('/intel/records', { method: 'POST', body: JSON.stringify(data) }),
  updateRecord: (id, data) => request(`/intel/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRecord: (id) => request(`/intel/records/${id}`, { method: 'DELETE' }),
  bulkImportRecords: (records) => request('/intel/records/bulk', { method: 'POST', body: JSON.stringify({ records }) }),
  getRecordStats: () => request('/intel/records/stats'),

  // AI 引擎
  getAiModels: () => request('/ai/models'),
  getAiUsage: () => request('/ai/usage'),
  aiChat: (message, model, taskType) => request('/ai/chat', {
    method: 'POST', body: JSON.stringify({ message, model, taskType }),
  }),
  aiGenerate: (prompt, type) => request('/ai/generate', {
    method: 'POST', body: JSON.stringify({ prompt, type }),
  }),

  // 企劃書撰寫
  getProposalWriting: (pid) => request(`/projects/${pid}/proposal-writing`),
  saveProposalWriting: (pid, chapters) => request(`/projects/${pid}/proposal-writing/save`, {
    method: 'POST', body: JSON.stringify({ chapters }),
  }),
  generateProposalChapter: (pid, subKey) => request(`/projects/${pid}/proposal-writing/generate/${subKey}`, {
    method: 'POST',
  }),

  // Dashboard 統計（雙視角）
  getDashboardOverview: () => request('/stats/overview'),
  getPlannerRanking: () => request('/stats/planner-ranking'),
  getMonthlyTrend: () => request('/stats/monthly-trend'),
  getPlanners: () => request('/stats/planners'),

  // 評選標準與配分
  getEvaluationCriteria: (pid) => request(`/projects/${pid}/evaluation-criteria`),
  saveEvaluationCriteria: (pid, items) => request(`/projects/${pid}/evaluation-criteria`, {
    method: 'POST', body: JSON.stringify({ items }),
  }),
  deleteEvaluationCriteria: (pid) => request(`/projects/${pid}/evaluation-criteria`, { method: 'DELETE' }),

  // AI 逐項追問對話
  aiFollowUp: (pid, data) => request(`/projects/${pid}/ai-chat`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  // 活動模擬圖生成
  generateSimImage: (pid, data) => request(`/projects/${pid}/generate-image`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  // 場地佈置模擬
  generateVenueSim: (pid, data) => request(`/projects/${pid}/generate-image/venue-sim`, {
    method: 'POST', body: JSON.stringify(data),
  }),

  // 場地規劃報告
  generateVenuePlan: (pid) => request(`/projects/${pid}/generate-image/venue-plan`, { method: 'POST' }),
  getVenuePlan: (pid) => request(`/projects/${pid}/generate-image/venue-plan`),

  // 科室/企業情報研究
  getDeptIntelligence: (pid) => request(`/projects/${pid}/dept-intelligence`),
  triggerDeptResearch: (pid, extraContext) => request(`/projects/${pid}/dept-intelligence`, {
    method: 'POST', body: JSON.stringify({ extra_context: extraContext }),
  }),
  updateDeptIntelligence: (pid, updates) => request(`/projects/${pid}/dept-intelligence`, {
    method: 'PUT', body: JSON.stringify(updates),
  }),
};


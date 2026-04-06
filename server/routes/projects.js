const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const deptIntel = require('../services/dept-intelligence');

const router = express.Router();

// GET /api/projects
router.get('/', (req, res) => {
  const projects = db.getAll('projects')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(p => {
      const planner = p.lead_planner ? db.getById('users', p.lead_planner) : null;
      const intel = deptIntel.getIntelligence(p.id);
      return {
        ...p,
        doc_count: db.find('documents', d => d.project_id === p.id).length,
        lead_planner_name: planner?.display_name || null,
        dept_intel_status: intel?.status || null,
      };
    });
  res.json(projects);
});

// POST /api/projects
router.post('/', (req, res) => {
  const {
    case_type, name, agency, department, company, company_industry,
    contact_name, contact_phone, contact_email, headcount, venue,
    event_type, budget, deadline, announcement_date, event_date, notes,
    lead_planner, dept_extra_context
  } = req.body;

  if (!name || !event_type) {
    return res.status(400).json({ error: '缺少必填欄位' });
  }
  if (case_type === 'tender' && (!agency || !deadline)) {
    return res.status(400).json({ error: '標案需填寫機關和截止日' });
  }
  if (case_type === 'commercial' && !company) {
    return res.status(400).json({ error: '商案需填寫公司名稱' });
  }

  const project = db.insert('projects', {
    id: uuidv4(),
    case_type: case_type || 'tender',
    name,
    // 標案欄位
    agency: agency || '',
    department: department || '',
    // 商案欄位
    company: company || '',
    company_industry: company_industry || '',
    contact_name: contact_name || '',
    contact_phone: contact_phone || '',
    contact_email: contact_email || '',
    headcount: headcount || null,
    venue: venue || '',
    // 共用欄位
    event_type,
    budget: budget || null,
    deadline: deadline || '',
    announcement_date: announcement_date || '',
    event_date: event_date || '',
    notes: notes || '',
    status: 'draft',
    lead_planner: lead_planner || null,
    // 舊欄位保留相容性
    project_type: event_type,
    tender_number: '',
  });

  // 非同步觸發科室/企業情報研究（不阻塞回應）
  const shouldResearch = (case_type === 'tender' && agency) || 
                         (case_type === 'commercial' && company);
  if (shouldResearch) {
    deptIntel.researchDepartment(project.id, project, dept_extra_context || '')
      .then(() => console.log(`[DeptIntel] 專案 ${project.id} 情報研究完成`))
      .catch(err => console.error(`[DeptIntel] 專案 ${project.id} 情報研究失敗:`, err.message));
  }

  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.getById('projects', req.params.id);
  if (!project) return res.status(404).json({ error: '專案不存在' });
  // 附帶科室情報狀態
  const intel = deptIntel.getIntelligence(req.params.id);
  res.json({ ...project, dept_intel_status: intel?.status || null });
});

// GET /api/projects/:id/dept-intelligence — 取得科室情報卡
router.get('/:id/dept-intelligence', (req, res) => {
  const intel = deptIntel.getIntelligence(req.params.id);
  if (!intel) return res.json({ status: 'none', intel: null });
  res.json(intel);
});

// POST /api/projects/:id/dept-intelligence — 手動觸發研究
router.post('/:id/dept-intelligence', async (req, res) => {
  try {
    const project = db.getById('projects', req.params.id);
    if (!project) return res.status(404).json({ error: '專案不存在' });
    
    const { extra_context } = req.body;
    const result = await deptIntel.researchDepartment(req.params.id, project, extra_context || '');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '情報研究失敗', details: error.message });
  }
});

// PUT /api/projects/:id/dept-intelligence — 手動更新情報卡
router.put('/:id/dept-intelligence', (req, res) => {
  const intel = deptIntel.getIntelligence(req.params.id);
  if (!intel || !intel.id) return res.status(404).json({ error: '情報卡不存在' });
  
  const updated = deptIntel.updateIntelligence(intel.id, req.body);
  if (!updated) return res.status(500).json({ error: '更新失敗' });
  
  res.json(deptIntel.getIntelligence(req.params.id));
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const updated = db.update('projects', req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: '專案不存在' });
  res.json(updated);
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  // 級聯刪除關聯資料
  db.removeWhere('documents', d => d.project_id === req.params.id);
  db.removeWhere('analyses', a => a.project_id === req.params.id);
  db.removeWhere('cost_estimates', c => c.project_id === req.params.id);
  db.removeWhere('theme_proposals', t => t.project_id === req.params.id);
  db.removeWhere('highlights', h => h.project_id === req.params.id);
  db.removeWhere('bid_records', b => b.project_id === req.params.id);
  db.removeWhere('selected_sub_activities', s => s.project_id === req.params.id);
  db.removeWhere('plan_summaries', p => p.project_id === req.params.id);
  db.removeWhere('text_requirements', t => t.project_id === req.params.id);
  db.removeWhere('dept_intelligence', d => d.project_id === req.params.id);
  const success = db.remove('projects', req.params.id);
  if (!success) return res.status(404).json({ error: '專案不存在' });
  res.json({ success: true });
});

module.exports = router;

/**
 * ProposalFlow AI — Dashboard 統計 API
 * 提供雙視角 Dashboard 所需的統計數據
 */
const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { ROLE_LEVELS } = require('../../shared/permissions');

const router = express.Router();

// 判斷是否為管理層（上帝視角）
function isManagement(role) {
  return (ROLE_LEVELS[role] || 0) >= (ROLE_LEVELS['manager'] || 50);
}

// GET /api/stats/overview — Dashboard 概覽數據
router.get('/overview', authMiddleware, (req, res) => {
  const allProjects = db.getAll('projects');
  const isGodView = isManagement(req.user.role);

  // 企劃視角：只看自己負責的
  const projects = isGodView
    ? allProjects
    : allProjects.filter(p => p.lead_planner === req.user.id);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // 本月專案
  const monthlyProjects = projects.filter(p => {
    const created = p.created_at || '';
    return created.startsWith(thisMonth);
  });

  // 按類型分計
  const tenderProjects = projects.filter(p => p.case_type !== 'commercial');
  const commercialProjects = projects.filter(p => p.case_type === 'commercial');

  const active = projects.filter(p => !['won', 'lost'].includes(p.status));
  const won = projects.filter(p => p.status === 'won');
  const wonTender = won.filter(p => p.case_type !== 'commercial');
  const wonCommercial = won.filter(p => p.case_type === 'commercial');

  const monthlyWon = monthlyProjects.filter(p => p.status === 'won');
  const monthlyWonTender = monthlyWon.filter(p => p.case_type !== 'commercial');
  const monthlyWonCommercial = monthlyWon.filter(p => p.case_type === 'commercial');

  const totalBudget = won.reduce((s, p) => s + (Number(p.budget) || 0), 0);
  const monthlyWonAmount = monthlyWon.reduce((s, p) => s + (Number(p.budget) || 0), 0);

  const finished = projects.filter(p => ['won', 'lost'].includes(p.status));
  const winRate = finished.length > 0 ? Math.round((won.length / finished.length) * 100) : 0;

  res.json({
    viewMode: isGodView ? 'management' : 'planner',
    active: active.length,
    totalProjects: projects.length,
    totalBudget,
    winRate,
    monthlyProposals: monthlyProjects.length,
    monthlyWon: monthlyWon.length,
    monthlyWonTender: monthlyWonTender.length,
    monthlyWonCommercial: monthlyWonCommercial.length,
    monthlyWonAmount,
    tenderCount: tenderProjects.length,
    commercialCount: commercialProjects.length,
    wonTenderCount: wonTender.length,
    wonCommercialCount: wonCommercial.length,
  });
});

// GET /api/stats/planner-ranking — 各企劃得標績效排名（管理層用）
router.get('/planner-ranking', authMiddleware, (req, res) => {
  if (!isManagement(req.user.role)) {
    return res.status(403).json({ error: '權限不足' });
  }

  const allProjects = db.getAll('projects');
  const users = db.getAll('users').filter(u => u.is_active);

  // 建立每個企劃的統計
  const ranking = users.map(u => {
    const myProjects = allProjects.filter(p => p.lead_planner === u.id);
    const won = myProjects.filter(p => p.status === 'won');
    const lost = myProjects.filter(p => p.status === 'lost');
    const active = myProjects.filter(p => !['won', 'lost'].includes(p.status));
    const wonAmount = won.reduce((s, p) => s + (Number(p.budget) || 0), 0);

    return {
      user_id: u.id,
      display_name: u.display_name,
      role: u.role,
      avatar_color: u.avatar_color,
      totalProjects: myProjects.length,
      wonCount: won.length,
      lostCount: lost.length,
      activeCount: active.length,
      wonAmount,
      winRate: (won.length + lost.length) > 0
        ? Math.round((won.length / (won.length + lost.length)) * 100)
        : 0,
    };
  }).filter(r => r.totalProjects > 0)
    .sort((a, b) => b.wonCount - a.wonCount);

  res.json(ranking);
});

// GET /api/stats/monthly-trend — 月度趨勢（最近 6 個月）
router.get('/monthly-trend', authMiddleware, (req, res) => {
  const allProjects = db.getAll('projects');
  const isGodView = isManagement(req.user.role);
  const projects = isGodView
    ? allProjects
    : allProjects.filter(p => p.lead_planner === req.user.id);

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${d.getMonth() + 1}月`;
    const monthProjects = projects.filter(p => (p.created_at || '').startsWith(key));
    const won = monthProjects.filter(p => p.status === 'won');
    months.push({
      month: key,
      label,
      proposals: monthProjects.length,
      won: won.length,
      wonAmount: won.reduce((s, p) => s + (Number(p.budget) || 0), 0),
    });
  }

  res.json(months);
});

// GET /api/stats/planners — 取得所有企劃人員列表（用於主寫企劃下拉）
router.get('/planners', authMiddleware, (req, res) => {
  const users = db.getAll('users')
    .filter(u => u.is_active)
    .map(u => ({
      id: u.id,
      display_name: u.display_name,
      role: u.role,
      avatar_color: u.avatar_color,
    }))
    .sort((a, b) => (ROLE_LEVELS[b.role] || 0) - (ROLE_LEVELS[a.role] || 0));

  res.json(users);
});

module.exports = router;

/**
 * ProposalFlow AI — Auth 中介層（升級版）
 * 使用共用 RBAC 模組
 */
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'proposalflow-secret-key-2026';

const { createRBAC } = require('../../shared/rbac-middleware');
const { hasRoleLevel } = require('../../shared/permissions');

// 驗證 JWT Token
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登入' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token 已過期或無效' });
  }
}

// 舊版角色檢查（向後相容）
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // 支援新角色映射：如果要求 admin，ceo 也可以通過
      if (req.user && roles.includes('admin') && hasRoleLevel(req.user.role, 'ceo')) {
        return next();
      }
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

// 新版 RBAC
const { requirePermission, requireMinRole } = createRBAC('pf');

module.exports = {
  authMiddleware, requireRole, JWT_SECRET,
  requirePermission, requireMinRole,
};

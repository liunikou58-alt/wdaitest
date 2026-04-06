/**
 * RBAC 中介層 — 兩系統共用
 * 取代原本的 requireRole('admin') 為 requirePermission('module', 'action')
 */
const { hasPermission, hasRoleLevel, PF_PERMISSIONS, ERP_PERMISSIONS } = require('./permissions');

/**
 * 建立 RBAC 中介層工廠
 * @param {'pf'|'erp'} system - 系統別
 */
function createRBAC(system) {
  const permMatrix = system === 'pf' ? PF_PERMISSIONS : ERP_PERMISSIONS;

  /**
   * requirePermission('projects', 'create')
   * 回傳 Express middleware
   */
  function requirePermission(module, action) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: '未登入' });

      // CEO 有全部權限
      if (req.user.role === 'ceo') return next();

      if (hasPermission(req.user, module, action, permMatrix)) {
        return next();
      }

      return res.status(403).json({
        error: '權限不足',
        required: `${module}.${action}`,
        current_role: req.user.role,
      });
    };
  }

  /**
   * requireMinRole('manager')
   * 簡單角色等級檢查
   */
  function requireMinRole(minRole) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: '未登入' });
      if (hasRoleLevel(req.user.role, minRole)) return next();
      return res.status(403).json({ error: '權限不足', required_role: minRole });
    };
  }

  return { requirePermission, requireMinRole };
}

module.exports = { createRBAC };

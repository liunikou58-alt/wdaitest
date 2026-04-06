/**
 * 資料範圍過濾 — 兩系統共用
 * 根據使用者角色自動過濾查詢結果
 */
const { getUserScope, SCOPE, hasRoleLevel } = require('./permissions');

/**
 * 過濾集合資料，依據使用者的資料範圍
 *
 * @param {Object} user - req.user（含 id, role, department_id）
 * @param {Array} items - 要過濾的資料陣列
 * @param {Object} opts - 過濾選項
 * @param {string} opts.ownerField - 擁有者欄位（預設 'created_by'）
 * @param {string} opts.deptField - 部門欄位（預設 'department_id'）
 * @param {string} opts.memberField - 成員陣列欄位（如 'members'）
 * @param {string} opts.assigneeField - 指派人欄位（如 'assigned_to'）
 * @returns {Array} 過濾後的資料
 */
function filterByScope(user, items, opts = {}) {
  if (!user || !items) return [];

  const scope = getUserScope(user);

  // CEO / Director 可看全部
  if (scope === SCOPE.ALL) return items;

  const {
    ownerField = 'created_by',
    deptField = 'department_id',
    memberField = null,
    assigneeField = null,
  } = opts;

  return items.filter(item => {
    // 1. 自己建立的一定看得到
    if (item[ownerField] === user.id) return true;

    // 2. 被指派的看得到
    if (assigneeField && item[assigneeField] === user.id) return true;

    // 3. 是成員之一
    if (memberField && Array.isArray(item[memberField])) {
      if (item[memberField].includes(user.id)) return true;
      // 支援 { user_id: xxx } 物件格式
      if (item[memberField].some(m => m.user_id === user.id || m.id === user.id)) return true;
    }

    // 4. 部門範圍
    if (scope === SCOPE.DEPARTMENT) {
      if (user.department_id && item[deptField] === user.department_id) return true;
    }

    // 5. self 範圍 — 只看自己的（已在 1-3 判斷過）
    return false;
  });
}

/**
 * 檢查使用者是否可存取特定資源
 */
function canAccessItem(user, item, opts = {}) {
  if (!user || !item) return false;

  // CEO / Director 全部可看
  if (hasRoleLevel(user.role, 'director')) return true;

  const {
    ownerField = 'created_by',
    deptField = 'department_id',
    memberField = null,
    assigneeField = null,
  } = opts;

  // 自己建立
  if (item[ownerField] === user.id) return true;

  // 被指派
  if (assigneeField && item[assigneeField] === user.id) return true;

  // 是成員
  if (memberField && Array.isArray(item[memberField])) {
    if (item[memberField].includes(user.id)) return true;
    if (item[memberField].some(m => m.user_id === user.id || m.id === user.id)) return true;
  }

  // 同部門（manager / senior）
  if (hasRoleLevel(user.role, 'senior') && user.department_id && item[deptField] === user.department_id) {
    return true;
  }

  return false;
}

/**
 * 在查詢結果中隱藏敏感欄位
 * 金額欄位僅 manager+ 可見
 */
function maskSensitiveFields(user, item, sensitiveFields = []) {
  if (hasRoleLevel(user.role, 'manager')) return item;

  const masked = { ...item };
  for (const field of sensitiveFields) {
    if (masked[field] !== undefined) {
      masked[field] = '***';
    }
  }
  return masked;
}

/**
 * Express middleware — 自動過濾 res.json 的陣列資料
 */
function scopeMiddleware(opts = {}) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (Array.isArray(data) && req.user) {
        data = filterByScope(req.user, data, opts);
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = { filterByScope, canAccessItem, maskSensitiveFields, scopeMiddleware };

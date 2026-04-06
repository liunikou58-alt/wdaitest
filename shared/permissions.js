/**
 * ERPTW 統一權限定義
 * 兩系統（ProposalFlow AI + WDMC-ERP）共用
 */

// ===== 角色層級（數字越大權限越高）=====
const ROLE_LEVELS = {
  assistant: 1,
  staff: 2,
  senior: 3,
  manager: 4,
  director: 5,
  ceo: 6,
};

const ROLE_LABELS = {
  assistant: '助理',
  staff: '專員',
  senior: '資深專員',
  manager: '主管',
  director: '總監',
  ceo: '執行長',
};

// ===== 資料範圍 =====
const SCOPE = {
  SELF: 'self',           // 僅自己
  DEPARTMENT: 'department', // 同部門
  CROSS_DEPT: 'cross_dept', // 跨部門（指定）
  ALL: 'all',              // 全公司
};

// 角色預設資料範圍
const ROLE_SCOPE = {
  assistant: SCOPE.SELF,
  staff: SCOPE.SELF,
  senior: SCOPE.DEPARTMENT,
  manager: SCOPE.DEPARTMENT,
  director: SCOPE.ALL,
  ceo: SCOPE.ALL,
};

// ===== 動作類型 =====
const ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  ADMIN: 'admin',
};

// ===== ProposalFlow AI 權限矩陣 =====
const PF_PERMISSIONS = {
  projects: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff', scope: true },
    delete: { minRole: 'manager' },
  },
  documents: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
    delete: { minRole: 'senior' },
  },
  analysis: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'senior' },
  },
  costs: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
    approve: { minRole: 'manager' },
  },
  themes: {
    view: { minRole: 'assistant' },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
    delete: { minRole: 'senior' },
  },
  highlights: {
    view: { minRole: 'assistant' },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
  },
  proposal: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
    approve: { minRole: 'manager' },
  },
  bid: {
    view: { minRole: 'senior', scope: true },
    create: { minRole: 'senior' },
    approve: { minRole: 'manager' },
  },
  presentation: {
    view: { minRole: 'assistant' },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
  },
  collaboration: {
    view: { minRole: 'assistant' },
    create: { minRole: 'assistant' },
  },
  tasks: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff', scope: true },
    delete: { minRole: 'manager' },
  },
};

// ===== WDMC-ERP 權限矩陣 =====
const ERP_PERMISSIONS = {
  projects: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff', scope: true },
    delete: { minRole: 'manager' },
  },
  proposals: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior', scope: true },
    approve: { minRole: 'manager' },
    delete: { minRole: 'manager' },
  },
  quotation_items: {
    view: { minRole: 'staff' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
  },
  contracts: {
    view: { minRole: 'senior', scope: true },
    create: { minRole: 'manager' },
    edit: { minRole: 'manager' },
    approve: { minRole: 'director' },
  },
  customers: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff', scope: true },
    delete: { minRole: 'manager' },
  },
  vendors: {
    view: { minRole: 'senior' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
    delete: { minRole: 'manager' },
  },
  purchase_orders: {
    view: { minRole: 'senior', scope: true },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
    approve: { minRole: 'manager' },
  },
  events: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
  },
  event_docs: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
  },
  finance: {
    view: { minRole: 'manager', scope: true },
    create: { minRole: 'director' },
    edit: { minRole: 'director' },
    export: { minRole: 'director' },
  },
  payments: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'staff' },
    approve: { minRole: 'manager' },
  },
  deposits: {
    view: { minRole: 'senior' },
    create: { minRole: 'senior' },
    edit: { minRole: 'manager' },
  },
  profit_loss: {
    view: { minRole: 'director' },
    create: { minRole: 'director' },
    export: { minRole: 'director' },
  },
  bi: {
    view: { minRole: 'manager', scope: true },
  },
  journal: {
    view: { minRole: 'manager' },
    create: { minRole: 'director' },
  },
  inventory: {
    view: { minRole: 'assistant' },
    create: { minRole: 'staff', departments: ['logistics'] },
    edit: { minRole: 'staff', departments: ['logistics'] },
  },
  assets: {
    view: { minRole: 'assistant' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
    approve: { minRole: 'manager' },
  },
  workers: {
    view: { minRole: 'senior' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
  },
  labor_reports: {
    view: { minRole: 'assistant', scope: true },
    create: { minRole: 'assistant' },
    edit: { minRole: 'staff', scope: true },
    approve: { minRole: 'manager' },
  },
  calendar: {
    view: { minRole: 'assistant' },
    create: { minRole: 'assistant' },
    edit: { minRole: 'staff' },
  },
  schedules: {
    view: { minRole: 'assistant' },
    create: { minRole: 'staff' },
    edit: { minRole: 'staff' },
  },
  checklists: {
    view: { minRole: 'assistant' },
    create: { minRole: 'assistant' },
    edit: { minRole: 'staff' },
  },
  files: {
    view: { minRole: 'assistant' },
    create: { minRole: 'assistant' },
    delete: { minRole: 'senior' },
  },
  approvals: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'staff' },
    approve: { minRole: 'manager' },
  },
  reports: {
    view: { minRole: 'manager', scope: true },
    export: { minRole: 'manager' },
  },
  knowledge: {
    view: { minRole: 'assistant' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
  },
  resources: {
    view: { minRole: 'staff' },
    create: { minRole: 'senior' },
    edit: { minRole: 'senior' },
  },
  form_builder: {
    view: { minRole: 'staff' },
    create: { minRole: 'senior' },
    admin: { minRole: 'manager' },
  },
  notifications: {
    view: { minRole: 'assistant' },
  },
  // System admin
  users: {
    view: { minRole: 'director' },
    create: { minRole: 'ceo' },
    edit: { minRole: 'ceo' },
    admin: { minRole: 'ceo' },
  },
  settings: {
    view: { minRole: 'director' },
    edit: { minRole: 'ceo' },
  },
  activity_logs: {
    view: { minRole: 'director' },
  },
  bonuses: {
    view: { minRole: 'manager' },
    create: { minRole: 'director' },
    edit: { minRole: 'director' },
    approve: { minRole: 'ceo' },
  },
  esign: {
    view: { minRole: 'staff', scope: true },
    create: { minRole: 'senior' },
    edit: { minRole: 'manager' },
  },
  public_share: {
    view: { minRole: 'manager' },
    create: { minRole: 'manager' },
    delete: { minRole: 'director' },
  },
};

// ===== 審批金額門檻 =====
const APPROVAL_THRESHOLDS = [
  { maxAmount: 50000, requiredRole: 'manager' },
  { maxAmount: 300000, requiredRole: 'director' },
  { maxAmount: Infinity, requiredRole: 'ceo' },
];

// ===== 部門對映 =====
const DEPARTMENT_MAP = {
  management: { name: '管理部', icon: '👑', sort: 1 },
  planning: { name: '企畫部', icon: '📋', sort: 2 },
  design: { name: '設計部', icon: '🎨', sort: 3 },
  production: { name: '輸出設計組', icon: '🖥️', sort: 4 },
  marketing: { name: '行銷部', icon: '📢', sort: 5 },
  logistics: { name: '分銷部', icon: '📦', sort: 6 },
  sales: { name: '業務部', icon: '🤝', sort: 7 },
};

// ===== Helper Functions =====

/** 檢查角色是否 >= 最低要求 */
function hasRoleLevel(userRole, minRole) {
  return (ROLE_LEVELS[userRole] || 0) >= (ROLE_LEVELS[minRole] || 99);
}

/** 檢查使用者是否有特定模組的特定動作權限 */
function hasPermission(user, module, action, permMatrix) {
  const modulePerm = permMatrix[module];
  if (!modulePerm) return hasRoleLevel(user.role, 'director'); // unknown module → director+
  const actionPerm = modulePerm[action];
  if (!actionPerm) return hasRoleLevel(user.role, 'manager'); // unknown action → manager+

  // Check min role
  if (!hasRoleLevel(user.role, actionPerm.minRole)) return false;

  // Check department restriction
  if (actionPerm.departments && actionPerm.departments.length > 0) {
    const userDeptKey = getDepartmentKey(user.department_name || user.department_id);
    if (!actionPerm.departments.includes(userDeptKey) && !hasRoleLevel(user.role, 'manager')) {
      return false;
    }
  }

  return true;
}

/** 根據部門名稱取得 key */
function getDepartmentKey(deptNameOrId) {
  if (!deptNameOrId) return '';
  for (const [key, val] of Object.entries(DEPARTMENT_MAP)) {
    if (val.name === deptNameOrId || key === deptNameOrId) return key;
  }
  return '';
}

/** 取得審批所需角色 */
function getApprovalRole(amount) {
  for (const t of APPROVAL_THRESHOLDS) {
    if (amount <= t.maxAmount) return t.requiredRole;
  }
  return 'ceo';
}

/** 取得使用者的資料範圍 */
function getUserScope(user) {
  return ROLE_SCOPE[user.role] || SCOPE.SELF;
}

module.exports = {
  ROLE_LEVELS, ROLE_LABELS, SCOPE, ROLE_SCOPE, ACTIONS,
  PF_PERMISSIONS, ERP_PERMISSIONS, APPROVAL_THRESHOLDS, DEPARTMENT_MAP,
  hasRoleLevel, hasPermission, getDepartmentKey, getApprovalRole, getUserScope,
};

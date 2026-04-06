/**
 * usePermission Hook + PermissionGate 元件
 * 前端權限控制（兩系統共用）
 */
import { createContext, useContext, useState, useEffect, useMemo } from 'react';

// ===== 角色常量（前端副本）=====
export const ROLE_LEVELS = {
  assistant: 1, staff: 2, senior: 3, manager: 4, director: 5, ceo: 6,
};

export const ROLE_LABELS = {
  assistant: '助理', staff: '專員', senior: '資深專員',
  manager: '主管', director: '總監', ceo: '執行長',
};

export const ROLE_COLORS = {
  assistant: '#94a3b8', staff: '#22c55e', senior: '#06b6d4',
  manager: '#f59e0b', director: '#8b5cf6', ceo: '#ef4444',
};

// ===== 權限 Context =====
const PermContext = createContext({ permissions: {}, loading: true });

/**
 * PermissionProvider — 包在 AuthProvider 外層或內層
 * 登入後自動載入當前使用者的權限矩陣
 */
export function PermissionProvider({ children, token }) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setPermissions({}); setLoading(false); return; }
    fetch('/api/auth/permissions', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : {})
      .then(p => { setPermissions(p); setLoading(false); })
      .catch(() => { setPermissions({}); setLoading(false); });
  }, [token]);

  return (
    <PermContext.Provider value={{ permissions, loading }}>
      {children}
    </PermContext.Provider>
  );
}

// ===== Hooks =====

/**
 * usePermission('projects', 'create')
 * @returns boolean
 */
export function usePermission(module, action) {
  const { permissions } = useContext(PermContext);
  if (!module || !action) return false;
  return permissions[module]?.[action] || false;
}

/**
 * usePermissions() — 回傳完整權限物件
 */
export function usePermissions() {
  return useContext(PermContext);
}

/**
 * useRoleLevel(user)
 * @returns {{ level, label, color, hasRole: (minRole) => boolean }}
 */
export function useRoleLevel(user) {
  return useMemo(() => {
    const role = user?.role || 'assistant';
    return {
      level: ROLE_LEVELS[role] || 0,
      label: ROLE_LABELS[role] || role,
      color: ROLE_COLORS[role] || '#94a3b8',
      hasRole: (minRole) => (ROLE_LEVELS[role] || 0) >= (ROLE_LEVELS[minRole] || 99),
    };
  }, [user?.role]);
}

// ===== Components =====

/**
 * <PermissionGate module="projects" action="create">
 *   <button>建立專案</button>
 * </PermissionGate>
 */
export function PermissionGate({ module, action, minRole, children, fallback = null }) {
  const { permissions } = useContext(PermContext);

  // Module + action check
  if (module && action) {
    if (!permissions[module]?.[action]) return fallback;
  }

  return children;
}

/**
 * <RoleGate minRole="manager">
 *   <AdminPanel />
 * </RoleGate>
 */
export function RoleGate({ minRole, user, children, fallback = null }) {
  const level = ROLE_LEVELS[user?.role] || 0;
  const required = ROLE_LEVELS[minRole] || 99;
  if (level < required) return fallback;
  return children;
}

/**
 * <RoleBadge role="manager" />
 */
export function RoleBadge({ role, size = 'sm' }) {
  const label = ROLE_LABELS[role] || role;
  const color = ROLE_COLORS[role] || '#94a3b8';
  const sizes = { sm: { fontSize: 11, padding: '2px 8px' }, md: { fontSize: 13, padding: '4px 12px' } };
  const s = sizes[size] || sizes.sm;

  return (
    <span style={{
      display: 'inline-block', background: `${color}20`, color,
      borderRadius: 20, fontWeight: 600, ...s,
    }}>
      {label}
    </span>
  );
}

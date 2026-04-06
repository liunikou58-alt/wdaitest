/**
 * StatusBadge — 狀態標籤元件
 * 
 * Props:
 *   status: string key
 *   map: { key: { label, class } } — 狀態對照表
 *   small: boolean
 */
const DEFAULT_MAP = {
  // 通用
  active: { label: '啟用', class: 'badge-success' },
  inactive: { label: '停用', class: 'badge-danger' },
  // 專案
  planning: { label: '規劃中', class: 'badge-info' },
  in_progress: { label: '執行中', class: 'badge-primary' },
  completed: { label: '已結案', class: 'badge-success' },
  cancelled: { label: '已取消', class: 'badge-danger' },
  // 提案
  draft: { label: '草稿', class: 'badge-info' },
  submitted: { label: '已提交', class: 'badge-primary' },
  reviewing: { label: '審閱中', class: 'badge-warning' },
  approved: { label: '已核准', class: 'badge-success' },
  rejected: { label: '已退回', class: 'badge-danger' },
  converted: { label: '已轉案', class: 'badge-success' },
  // 採購/財務
  pending: { label: '待處理', class: 'badge-warning' },
  confirmed: { label: '已確認', class: 'badge-primary' },
  delivered: { label: '已交貨', class: 'badge-info' },
  paid: { label: '已付款', class: 'badge-success' },
  received: { label: '已收款', class: 'badge-success' },
  // 合約
  expired: { label: '已到期', class: 'badge-danger' },
  terminated: { label: '已終止', class: 'badge-danger' },
  // 任務
  todo: { label: '待辦', class: 'badge-info' },
  done: { label: '完成', class: 'badge-success' },
};

export default function StatusBadge({ status, map, small }) {
  const merged = { ...DEFAULT_MAP, ...(map || {}) };
  const info = merged[status] || { label: status, class: '' };
  return <span className={`badge ${info.class}`} style={small ? { fontSize: 10, padding: '1px 6px' } : {}}>{info.label}</span>;
}

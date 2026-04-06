/**
 * StatCard — 統計卡片元件
 * 
 * Props:
 *   icon: emoji string
 *   bg: CSS color for icon background
 *   value: 顯示值
 *   label: 說明文字
 *   sub: 副標（選填）
 *   color: 文字顏色（選填）
 *   onClick: 點擊事件（選填）
 */
export default function StatCard({ icon, bg, value, label, sub, color, onClick }) {
  return (
    <div className="stat-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <div className="stat-icon" style={{ background: bg || 'var(--c-primary-light)' }}>{icon}</div>
      <div>
        <div className="stat-value" style={{ color: color || 'inherit' }}>{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

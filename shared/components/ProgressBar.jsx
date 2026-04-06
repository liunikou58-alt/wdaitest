/**
 * ProgressBar — 進度條元件
 * 
 * Props:
 *   value: 0-100
 *   height: px (default 8)
 *   color: CSS color (auto green/yellow/red if not set)
 *   showLabel: boolean
 */
export default function ProgressBar({ value = 0, height = 8, color, showLabel = false }) {
  const v = Math.max(0, Math.min(100, value));
  const autoColor = v >= 80 ? 'var(--c-success)' : v >= 40 ? 'var(--c-warning)' : 'var(--c-danger)';
  const bg = color || autoColor;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height, background: 'var(--c-border)', borderRadius: height / 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${v}%`, background: bg, borderRadius: height / 2, transition: 'width 0.3s ease' }} />
      </div>
      {showLabel && <span style={{ fontSize: 11, fontWeight: 700, color: bg, minWidth: 32 }}>{v}%</span>}
    </div>
  );
}

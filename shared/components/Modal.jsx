/**
 * Modal — 通用彈窗元件
 * 
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   title: string
 *   width: number (default 520)
 *   children: JSX
 *   footer: JSX (optional)
 */
export default function Modal({ open, onClose, title, width = 520, children, footer }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />
      {/* content */}
      <div style={{ position: 'relative', background: 'white', borderRadius: 14, width, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'fadeInUp 0.2s ease' }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--c-border)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--c-text-muted)', padding: '2px 6px', borderRadius: 6 }}>✕</button>
        </div>
        {/* body */}
        <div style={{ padding: '20px 24px' }}>{children}</div>
        {/* footer */}
        {footer && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

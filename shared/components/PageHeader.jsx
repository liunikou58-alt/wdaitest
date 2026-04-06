/**
 * PageHeader — 頁面標題區元件
 * 
 * Props:
 *   icon: emoji
 *   title: string
 *   subtitle: string
 *   actions: JSX (右側按鈕區)
 */
export default function PageHeader({ icon, title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{icon && <>{icon} </>}{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
    </div>
  );
}

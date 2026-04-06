import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'
import { useLang } from './LangContext'
import { useState, useRef, useEffect } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProjectNew from './pages/ProjectNew'
import ProjectWorkspace from './pages/ProjectWorkspace'
import AdminPanel from './pages/AdminPanel'
import IntelCenter from './pages/IntelCenter'
import RiskRadar from './pages/RiskRadar'
import TeamHub from './pages/TeamHub'
import AiAssistant from './pages/AiAssistant'

function useNavItems() {
  const { t } = useLang();
  return [
    { path: '/', label: t('nav.home') },
    { path: '/new', label: t('nav.new') },
    { path: '/intel', label: t('nav.intel') },
    { path: '/risk', label: t('nav.risk') },
    { path: '/team', label: t('nav.team') },
    { path: '/ai', label: t('nav.ai') },
  ];
}

function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <button onClick={() => setLang(lang === 'zh-TW' ? 'en' : 'zh-TW')}
      className="btn btn-ghost btn-sm"
      title={lang === 'zh-TW' ? 'Switch to English' : '切換為中文'}
      style={{ fontSize: 13, padding: '6px 12px', borderRadius: 10, fontWeight: 600 }}>
      {lang === 'zh-TW' ? 'EN' : '中'}
    </button>
  );
}

function ThemeSwitcher() {
  const { themeId, setThemeId, themes } = useTheme();
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const current = themes.find(t => t.id === themeId);
  const grouped = { [t('theme.female')]: [], [t('theme.male')]: [], [t('theme.neutral')]: [] };
  const groupMap = { '女性': t('theme.female'), '男性': t('theme.male'), '中性': t('theme.neutral') };
  themes.forEach(th => {
    const key = groupMap[th.group] || th.group;
    if (grouped[key]) grouped[key].push(th);
  });

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} className="btn btn-ghost btn-sm"
        title={t('theme.title')} style={{ fontSize: 16, padding: '6px 12px', borderRadius: 10 }}>
              </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 300,
          background: 'var(--c-bg-card-solid)', border: '1px solid var(--c-border)',
          borderRadius: 16, padding: '16px', minWidth: 240,
          boxShadow: 'var(--shadow-lg)', animation: 'slideDown 0.2s ease',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)', marginBottom: 12 }}>{t('theme.title')}</div>

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>{group}</div>
              {items.map(th => (
                <button key={th.id} onClick={() => { setThemeId(th.id); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px',
                    borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 4,
                    background: themeId === th.id ? 'var(--c-primary-bg)' : 'transparent',
                    transition: 'all 0.2s', fontFamily: 'inherit', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (themeId !== th.id) e.currentTarget.style.background = 'var(--c-bg-hover)'; }}
                  onMouseLeave={e => { if (themeId !== th.id) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ fontSize: 16 }}>{th.name.split(' ')[0]}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: themeId === th.id ? 700 : 500, color: themeId === th.id ? 'var(--c-primary)' : 'var(--c-text)' }}>
                      {th.name.split(' ').slice(1).join(' ')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{th.desc}</div>
                  </div>
                  {themeId === th.id && <span style={{ marginLeft: 'auto', color: 'var(--c-primary)', fontWeight: 700 }}></span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { user, loading, logout, isAdmin } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/project/');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const NAV_ITEMS = useNavItems();

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading) return <div className="loader-container"><div className="loader" /><span>{t('common.loading')}</span></div>;
  if (!user) return <Login />;

  return (
    <div className="app-layout">
      {!isWorkspace && (
        <header className="topnav">
          <NavLink to="/" className="topnav-logo">
            <div className="topnav-logo-icon" style={{ background: 'var(--c-primary)', color: 'white', borderRadius: 8, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 }}>W</div>
            {t('app.name')}
          </NavLink>

          <nav className="topnav-links">
            {NAV_ITEMS.map(item => (
              <NavLink key={item.path} to={item.path} end={item.path === '/'}
                className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LangSwitcher />
            <ThemeSwitcher />

            <div className="topnav-user" ref={dropdownRef} onClick={() => setShowDropdown(!showDropdown)}>
              <div className="topnav-avatar">{user.display_name?.[0] || ''}</div>
              <div className="topnav-user-info">
                <span className="topnav-user-name">{user.display_name}</span>
                <span className="topnav-user-role">{user.department_name || user.role}</span>
              </div>
              <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>▾</span>

              {showDropdown && (
                <div className="topnav-dropdown">
                  {isAdmin && (
                    <NavLink to="/admin" className="topnav-dropdown-item" onClick={() => setShowDropdown(false)}>
                      {t('nav.admin')}
                    </NavLink>
                  )}
                  <button className="topnav-dropdown-item" onClick={logout}>
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <main className={isWorkspace ? '' : 'main-content'}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<ProjectNew />} />
          <Route path="/project/:id/*" element={<ProjectWorkspace />} />
          <Route path="/intel" element={<IntelCenter />} />
          <Route path="/risk" element={<RiskRadar />} />
          <Route path="/team" element={<TeamHub />} />
          <Route path="/ai" element={<AiAssistant />} />
          {isAdmin && <Route path="/admin" element={<AdminPanel />} />}
        </Routes>
      </main>
    </div>
  );
}

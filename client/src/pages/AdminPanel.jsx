import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { useAuth } from '../AuthContext'

const API = '/api/auth';

function authFetch(url, token, options = {}) {
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } })
    .then(r => r.json());
}

const ROLE_MAP = {
  admin: { label: '管理員', color: 'var(--c-danger)' },
  planning_manager: { label: '企劃主管', color: 'var(--c-warning)' },
  planner: { label: '企劃人員', color: '#8b5cf6' },
  designer: { label: '設計人員', color: '#06b6d4' },
  dept_manager: { label: '部門主管', color: 'var(--c-success)' },
  executor: { label: '執行人員', color: '#8b8fa3' },
};

export default function AdminPanel() {
  const { t } = useLang();
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [tab, setTab] = useState('users');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    username: '', password: '', display_name: '',
    role: 'planner', department_id: '', email: ''
  });

  useEffect(() => {
    authFetch(`${API}/users`, token).then(setUsers);
    authFetch(`${API}/departments`, token).then(setDepartments);
  }, [token]);

  const addUser = async () => {
    await authFetch(`${API}/users`, token, {
      method: 'POST', body: JSON.stringify(form)
    });
    authFetch(`${API}/users`, token).then(setUsers);
    setShowAdd(false);
    setForm({ username: '', password: '', display_name: '', role: 'planner', department_id: '', email: '' });
  };

  const toggleActive = async (u) => {
    await authFetch(`${API}/users/${u.id}`, token, {
      method: 'PUT', body: JSON.stringify({ is_active: !u.is_active })
    });
    authFetch(`${API}/users`, token).then(setUsers);
  };

  const [newDept, setNewDept] = useState('');
  const addDept = async () => {
    if (!newDept.trim()) return;
    await authFetch(`${API}/departments`, token, {
      method: 'POST', body: JSON.stringify({ name: newDept })
    });
    authFetch(`${API}/departments`, token).then(setDepartments);
    setNewDept('');
  };

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  return (
    <div className="animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('admin.title')}</h1>
          <p className="page-subtitle">{t('admin.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ key: 'users', label: t('admin.users') }, { key: 'departments', label: t('admin.departments') }].map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('admin.addUser')}</button>
          </div>

          {showAdd && (
            <div className="card animate-fadeUp" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{t('admin.addUserTitle')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div className="form-group"><label className="form-label">{t('admin.username')}</label>
                  <input className="form-input" value={form.username} onChange={set('username')} /></div>
                <div className="form-group"><label className="form-label">{t('admin.password')}</label>
                  <input className="form-input" type="password" value={form.password} onChange={set('password')} /></div>
                <div className="form-group"><label className="form-label">{t('admin.displayName')}</label>
                  <input className="form-input" value={form.display_name} onChange={set('display_name')} /></div>
                <div className="form-group"><label className="form-label">{t('admin.role')}</label>
                  <select className="form-select" value={form.role} onChange={set('role')}>
                    {Object.entries(ROLE_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">{t('admin.dept')}</label>
                  <select className="form-select" value={form.department_id} onChange={set('department_id')}>
                    <option value="">未指定</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Email</label>
                  <input className="form-input" value={form.email} onChange={set('email')} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={addUser}>{t('common.create')}</button>
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => (
              <div key={u.id} className="card" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${ROLE_MAP[u.role]?.color || '#8b5cf6'}12`, fontSize: 18 }}></div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                      {u.display_name}
                      <span className="capsule" style={{ background: `${ROLE_MAP[u.role]?.color}10`, color: ROLE_MAP[u.role]?.color }}>
                        {ROLE_MAP[u.role]?.label || u.role}
                      </span>
                      {!u.is_active && <span className="capsule" style={{ background: 'rgba(239,68,68,0.08)', color: 'var(--c-danger)' }}>已停用</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                      @{u.username} · {u.department_name || '未指定部門'} {u.email && `· ${u.email}`}
                    </div>
                  </div>
                </div>
                {u.username !== 'admin' && (
                  <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggleActive(u)}>{u.is_active ? '停用' : '啟用'}</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'departments' && (
        <>
          <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label">{t('admin.addDept')}</label>
              <input className="form-input" value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="例：行銷部" />
            </div>
            <button className="btn btn-primary" onClick={addDept}>{t('admin.addDeptBtn')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {departments.map(d => (
              <div key={d.id} className="card" style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 26 }}>{d.icon}</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

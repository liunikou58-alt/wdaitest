import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { useAuth } from '../AuthContext'

const STATUS_COLS = [
  { key: 'todo', label: '待辦', color: '#8b8fa3' },
  { key: 'in_progress', label: '進行中', color: '#8b5cf6' },
  { key: 'review', label: '待審核', color: 'var(--c-warning)' },
  { key: 'done', label: '已完成', color: 'var(--c-success)' },
];

const PRIORITY_MAP = { high: '', medium: '', low: '' };

const API = '/api';
function authFetch(url, token, options = {}) {
  return fetch(`${API}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }
  }).then(r => r.json());
}

export default function ExecutionPanel({ projectId }) {
  const { t } = useLang();
  const { token } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [filterDept, setFilterDept] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', department_id: '', assignee_id: '', priority: 'medium', due_date: '' });
  const [view, setView] = useState('board');

  const load = () => {
    let url = `/projects/${projectId}/tasks`;
    if (filterDept) url += `?department_id=${filterDept}`;
    authFetch(url, token).then(setTasks);
  };

  useEffect(() => {
    load();
    authFetch('/auth/departments', token).then(setDepartments);
    authFetch('/auth/users', token).then(setUsers).catch(() => setUsers([]));
  }, [projectId, filterDept]);

  const addTask = async () => {
    if (!form.title.trim()) return;
    await authFetch(`/projects/${projectId}/tasks`, token, { method: 'POST', body: JSON.stringify(form) });
    setShowAdd(false);
    setForm({ title: '', department_id: '', assignee_id: '', priority: 'medium', due_date: '' });
    load();
  };

  const updateStatus = async (taskId, status) => {
    await authFetch(`/projects/${projectId}/tasks/${taskId}`, token, { method: 'PUT', body: JSON.stringify({ status }) });
    load();
  };

  const deleteTask = async (id) => {
    await authFetch(`/projects/${projectId}/tasks/${id}`, token, { method: 'DELETE' });
    load();
  };

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  const deptStats = departments.map(d => {
    const deptTasks = tasks.filter(t => t.department_id === d.id);
    const done = deptTasks.filter(t => t.status === 'done').length;
    return { ...d, total: deptTasks.length, done, pct: deptTasks.length ? Math.round((done / deptTasks.length) * 100) : 0 };
  }).filter(d => d.total > 0);

  return (
    <div className="animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('exec.title')}</h1>
          <p className="page-subtitle">{t('exec.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn btn-sm ${view === 'board' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('board')}>{t('exec.board')}</button>
          <button className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('list')}>{t('exec.list')}</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('exec.addTask')}</button>
        </div>
      </div>

      {deptStats.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {deptStats.map(d => (
            <div key={d.id} className="card" style={{ padding: '14px 18px', minWidth: 150, cursor: 'pointer', borderColor: filterDept === d.id ? 'var(--c-primary)' : undefined }}
              onClick={() => setFilterDept(filterDept === d.id ? '' : d.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{d.icon} {d.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-primary)' }}>{d.pct}%</span>
              </div>
              <div style={{ height: 5, background: 'rgba(139,92,246,0.06)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${d.pct}%`, background: 'var(--c-primary)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{d.done}/{d.total} 完成</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn btn-sm ${!filterDept ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilterDept('')}>全部</button>
        {departments.map(d => (
          <button key={d.id} className={`btn btn-sm ${filterDept === d.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterDept(d.id)}>{d.icon} {d.name}</button>
        ))}
      </div>

      {showAdd && (
        <div className="card animate-fadeUp" style={{ marginBottom: 16, padding: '24px 28px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('exec.addTaskTitle')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 14 }}>
            <div className="form-group"><label className="form-label">{t('exec.taskName')}</label>
              <input className="form-input" value={form.title} onChange={set('title')} /></div>
            <div className="form-group"><label className="form-label">{t('exec.department')}</label>
              <select className="form-select" value={form.department_id} onChange={set('department_id')}>
                <option value="">未指定</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.icon} {d.name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">{t('exec.assignee')}</label>
              <select className="form-select" value={form.assignee_id} onChange={set('assignee_id')}>
                <option value="">未指定</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">{t('exec.priority')}</label>
              <select className="form-select" value={form.priority} onChange={set('priority')}>
                <option value="high">高</option><option value="medium">中</option><option value="low">低</option>
              </select></div>
            <div className="form-group"><label className="form-label">{t('exec.dueDate')}</label>
              <input className="form-input" type="date" value={form.due_date} onChange={set('due_date')} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={addTask}>{t('common.create')}</button>
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {view === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {STATUS_COLS.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            return (
              <div key={col.key} style={{ background: 'rgba(139,92,246,0.02)', borderRadius: 20, padding: 14, minHeight: 300 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span className="capsule" style={{ background: `${col.color}10`, color: col.color }}>{colTasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {colTasks.map(task => (
                    <div key={task.id} className="card" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{PRIORITY_MAP[task.priority]} {task.title}</span>
                        <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 12 }}></button>
                      </div>
                      {task.department_name && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 4 }}>{task.department_icon} {task.department_name}</div>}
                      {task.assignee_name && <div style={{ fontSize: 11, color: 'var(--c-primary)' }}>{task.assignee_name}</div>}
                      {task.due_date && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{task.due_date}</div>}
                      <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                        {STATUS_COLS.filter(s => s.key !== task.status).map(s => (
                          <button key={s.key} className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: 10 }}
                            onClick={() => updateStatus(task.id, s.key)}>{s.label.split(' ')[0]}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"></div>
              <div className="empty-state-title">{t('exec.noTasks')}</div>
              <p style={{ color: 'var(--c-text-muted)' }}>{t('exec.noTasksHint')}</p>
            </div>
          ) : tasks.map(task => (
            <div key={task.id} className="card" style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <span>{PRIORITY_MAP[task.priority]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                    {task.department_icon} {task.department_name || '未指定'} · {task.assignee_name || '未分配'} {task.due_date && `· ${task.due_date}`}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="form-select" value={task.status} style={{ padding: '6px 10px', fontSize: 12, width: 130, borderRadius: 9999 }}
                  onChange={e => updateStatus(task.id, e.target.value)}>
                  {STATUS_COLS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <button className="btn btn-danger btn-sm" onClick={() => deleteTask(task.id)}></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

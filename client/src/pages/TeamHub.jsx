import { useState } from 'react'
import { useLang } from '../LangContext'

const TEAM = [
  { id: 1, name: '王小明', role: '專案經理', dept: '企劃部', avatar: '‍', status: 'online', currentTask: '午時水 - 企劃書撰寫',
    workload: 85, projects: ['午時水活動', '台中花博'], skills: ['專案管理', '企劃撰寫', '客戶溝通'] },
  { id: 2, name: '李美玲', role: '資深企劃', dept: '企劃部', avatar: '‍', status: 'online', currentTask: '午時水 - 主題包裝設計',
    workload: 72, projects: ['午時水活動'], skills: ['創意企劃', '活動設計', '文案撰寫'] },
  { id: 3, name: '張大勇', role: '業務經理', dept: '業務部', avatar: '‍', status: 'busy', currentTask: '客戶提案會議',
    workload: 90, projects: ['午時水活動', '桃園燈會'], skills: ['客戶關係', '提案簡報', '商務談判'] },
  { id: 4, name: '陳小花', role: '設計師', dept: '企劃部', avatar: '‍', status: 'online', currentTask: '午時水 - 視覺設計',
    workload: 60, projects: ['午時水活動'], skills: ['視覺設計', '3D建模', 'AI繪圖'] },
  { id: 5, name: '林技術', role: '音響工程師', dept: '音響組', avatar: '', status: 'offline', currentTask: '設備清單整理',
    workload: 40, projects: ['午時水活動'], skills: ['音響系統', '現場調音', '設備管理'] },
  { id: 6, name: '黃燈光', role: '燈光設計師', dept: '燈光組', avatar: '', status: 'online', currentTask: '燈光方案規劃',
    workload: 55, projects: ['午時水活動', '台北跨年'], skills: ['燈光設計', 'LED控制', '舞台設計'] },
];

const TASKS = [
  { id: 1, title: '企劃書初稿撰寫', assignee: '王小明', status: 'doing', priority: 'HIGH', deadline: '3/24', project: '午時水' },
  { id: 2, title: '主題視覺 3 組方案', assignee: '陳小花', status: 'doing', priority: 'HIGH', deadline: '3/23', project: '午時水' },
  { id: 3, title: '成本報價確認', assignee: '張大勇', status: 'todo', priority: 'HIGH', deadline: '3/25', project: '午時水' },
  { id: 4, title: '音響設備清單', assignee: '林技術', status: 'done', priority: 'MEDIUM', deadline: '3/22', project: '午時水' },
  { id: 5, title: '燈光配置圖', assignee: '黃燈光', status: 'doing', priority: 'MEDIUM', deadline: '3/25', project: '午時水' },
  { id: 6, title: '場勘照片整理', assignee: '李美玲', status: 'done', priority: 'LOW', deadline: '3/21', project: '午時水' },
  { id: 7, title: '客戶需求確認會議', assignee: '張大勇', status: 'todo', priority: 'HIGH', deadline: '3/23', project: '午時水' },
  { id: 8, title: 'AI 需求分析報告', assignee: '王小明', status: 'done', priority: 'MEDIUM', deadline: '3/20', project: '午時水' },
];

const STATUS_LABELS = { todo: '待辦', doing: '進行中', done: '已完成' };
const STATUS_COLORS = { todo: '#8b8fa3', doing: 'var(--c-warning)', done: 'var(--c-success)' };
const PRIORITY_COLORS = { HIGH: 'var(--c-danger)', MEDIUM: 'var(--c-warning)', LOW: '#8b5cf6' };
const PRESENCE_COLORS = { online: 'var(--c-success)', busy: 'var(--c-warning)', offline: '#94a3b8' };
const PRESENCE_LABELS = { online: '在線', busy: '忙碌', offline: '離線' };

function WorkloadRing({ percent, size = 40 }) {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent > 80 ? 'var(--c-danger)' : percent > 60 ? 'var(--c-warning)' : 'var(--c-success)';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(139,92,246,0.06)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color }}>{percent}</span>
    </div>
  );
}

export default function TeamHub() {
  const { t } = useLang();
  const [tab, setTab] = useState('board');

  const columns = ['todo', 'doing', 'done'];

  return (
    <div className="animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('team.title')}</h1>
          <p className="page-subtitle">{t('team.subtitle')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { key: 'board', label: t('team.board') },
          { key: 'members', label: t('team.members') },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13 }}>{t.label}</button>
        ))}
      </div>

      {tab === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {columns.map(col => (
            <div key={col} style={{ background: 'rgba(139,92,246,0.02)', borderRadius: 20, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', borderRadius: 12, background: `${STATUS_COLORS[col]}08` }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: STATUS_COLORS[col] }}>{STATUS_LABELS[col]}</span>
                <span className="capsule" style={{ marginLeft: 'auto', background: `${STATUS_COLORS[col]}10`, color: STATUS_COLORS[col] }}>
                  {TASKS.filter(t => t.status === col).length}
                </span>
              </div>
              {TASKS.filter(t => t.status === col).map(task => (
                <div key={task.id} className="card" style={{ padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="capsule" style={{ background: `${PRIORITY_COLORS[task.priority]}10`, color: PRIORITY_COLORS[task.priority] }}>{task.priority === 'HIGH' ? '' : task.priority === 'MEDIUM' ? '' : ''} {task.priority}</span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{task.deadline}</span>
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{task.title}</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{task.assignee}</span>
                    <span className="capsule" style={{ background: 'rgba(139,92,246,0.04)', color: 'var(--c-text-muted)', fontSize: 10 }}>{task.project}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {TEAM.map(m => (
            <div key={m.id} className="card" style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, position: 'relative' }}>
                  {m.avatar}
                  <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: PRESENCE_COLORS[m.status], border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                    <span className="capsule" style={{ background: `${PRESENCE_COLORS[m.status]}10`, color: PRESENCE_COLORS[m.status] }}>{PRESENCE_LABELS[m.status]}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{m.role} · {m.dept}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{m.currentTask}</div>
                </div>
                <WorkloadRing percent={m.workload} />
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {m.skills.map(s => (
                  <span key={s} className="capsule" style={{ background: 'rgba(139,92,246,0.05)', color: 'var(--c-primary)', fontSize: 10 }}>{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

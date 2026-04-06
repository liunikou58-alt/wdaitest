import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useLang } from '../LangContext'
import { api } from '../api'

function useStatusMap() {
  const { t } = useLang();
  return {
    draft: { label: t('status.draft'), color: '#94a3b8' },
    analyzing: { label: t('status.analyzing'), color: 'var(--c-warning)' },
    planning: { label: t('status.planning'), color: '#8b5cf6' },
    bidding: { label: t('status.bidding'), color: '#ec4899' },
    won: { label: t('status.won'), color: 'var(--c-success)' },
    lost: { label: t('status.lost'), color: 'var(--c-danger)' },
  };
}

const MOCK_CALENDAR = [
  { date: '3/23', events: [{ title: '午時水活動 - 企劃書截止', type: 'deadline' }] },
  { date: '3/25', events: [{ title: '午時水活動 - 簡報排練', type: 'meeting' }, { title: '台中花博 - 場勘', type: 'task' }] },
  { date: '3/28', events: [{ title: '午時水活動 - 投標日', type: 'bid' }] },
  { date: '4/01', events: [{ title: '桃園燈會 - 需求分析', type: 'task' }] },
  { date: '4/05', events: [{ title: '台中花博 - 企劃提交', type: 'deadline' }] },
];

const EVENT_STYLE = {
  deadline: { bg: 'rgba(239,68,68,0.06)', border: 'var(--c-danger)', dot: '#ef4444' },
  meeting: { bg: 'rgba(139,92,246,0.06)', border: '#8b5cf6', dot: '#8b5cf6' },
  task: { bg: 'rgba(245,158,11,0.06)', border: 'var(--c-warning)', dot: '#f59e0b' },
  bid: { bg: 'rgba(236,72,153,0.06)', border: '#ec4899', dot: '#ec4899' },
};

const INSIGHT_STYLE = {
  opportunity: { bg: 'rgba(16,185,129,0.05)', border: 'var(--c-success)', label: 'OPP', labelBg: 'rgba(16,185,129,0.1)', labelColor: '#059669' },
  warning: { bg: 'rgba(239,68,68,0.05)', border: 'var(--c-danger)', label: 'WARN', labelBg: 'rgba(239,68,68,0.08)', labelColor: '#ef4444' },
  insight: { bg: 'rgba(139,92,246,0.05)', border: '#8b5cf6', label: 'TIP', labelBg: 'rgba(139,92,246,0.08)', labelColor: '#8b5cf6' },
};

function ProgressRing({ percent, size = 44, stroke = 4, color = '#8b5cf6' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(139,92,246,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="progress-ring-text" style={{ color }}>{percent}%</span>
    </div>
  );
}

// 迷你柱狀圖
function MiniBarChart({ data, maxH = 40 }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: maxH + 16 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: 18, borderRadius: 3,
            height: Math.max((d.value / max) * maxH, 3),
            background: d.color || 'var(--c-primary)',
            transition: 'height 0.6s ease',
          }} />
          <span style={{ fontSize: 9, color: 'var(--c-text-muted)' }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
  const STATUS_MAP = useStatusMap();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  // 判斷管理層
  const isManagement = ['ceo', 'director', 'manager'].includes(user?.role);

  useEffect(() => {
    const loads = [
      api.getProjects().then(setProjects).catch(console.error),
      api.getDashboardOverview().then(setStats).catch(() => {}),
      api.getMonthlyTrend().then(setTrend).catch(() => {}),
    ];
    if (isManagement) {
      loads.push(api.getPlannerRanking().then(setRanking).catch(() => {}));
    }
    Promise.all(loads).finally(() => setLoading(false));
  }, []);

  const daysUntil = (deadline) => {
    // 日期格式防護：僅接受 2000-2100 年的合法 YYYY-MM-DD 日期
    if (!deadline) return { text: '—', color: '#94a3b8', urgent: false };
    const m = String(deadline).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m || parseInt(m[1], 10) < 2000 || parseInt(m[1], 10) > 2100) {
      return { text: '日期格式錯誤', color: 'var(--c-text-muted)', urgent: false };
    }
    const parsed = new Date(deadline);
    if (isNaN(parsed.getTime())) return { text: '日期無效', color: 'var(--c-text-muted)', urgent: false };
    const diff = Math.ceil((parsed - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: t('common.expired'), color: 'var(--c-danger)', urgent: true };
    if (diff === 0) return { text: t('common.today'), color: 'var(--c-danger)', urgent: true };
    if (diff <= 3) return { text: t('common.daysLeft', { n: diff }), color: 'var(--c-warning)', urgent: true };
    if (diff <= 7) return { text: t('common.daysLeft', { n: diff }), color: '#8b5cf6', urgent: false };
    return { text: t('common.daysLeft', { n: diff }), color: '#94a3b8', urgent: false };
  };

  const AI_INSIGHTS = [
    { type: 'opportunity', text: '新公告「2026台灣燈會主場」預算 8,000 萬，與貴司經驗高度匹配 92%', action: '查看' },
    { type: 'warning', text: '「午時水活動」投標截止僅剩 5 天，企劃書完成度 68%', action: '前往' },
    { type: 'insight', text: '近 6 個月勝率上升 15%，強項為「文化慶典活動」', action: '分析' },
  ];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('greet.morning');
    if (h < 18) return t('greet.afternoon');
    return t('greet.evening');
  };

  if (loading) return <div className="loader-container"><div className="loader" /><span>{t('common.loading')}</span></div>;

  // 使用 API 統計或 fallback
  const kpis = stats || {
    active: projects.filter(p => !['won', 'lost'].includes(p.status)).length || 1,
    totalBudget: projects.reduce((s, p) => s + (Number(p.budget) || 0), 0) || 3500000,
    winRate: 72,
    monthlyProposals: projects.length,
    monthlyWon: 0,
    monthlyWonTender: 0,
    monthlyWonCommercial: 0,
    monthlyWonAmount: 0,
  };

  // 過濾專案列表（企劃視角只看自己的）
  const visibleProjects = isManagement
    ? projects
    : projects.filter(p => p.lead_planner === user?.id);

  // fallback if empty
  const displayProjects = visibleProjects.length > 0 ? visibleProjects : [
    { id: 'demo', name: '2026大甲鐵砧山劍井取午時水活動', agency: '台中市政府觀光旅遊局', status: 'planning', deadline: '2026-03-28', budget: 3500000, doc_count: 5 }
  ];

  return (
    <div className="animate-fadeUp">
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="greeting">{getGreeting()}，{user?.display_name || t('greet.colleague')}！</h1>
          <p className="greeting-sub">{t('dash.activeProjects', { n: kpis.active })}</p>
        </div>
        {/* 視角標籤 */}
        <div style={{
          padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: isManagement ? 'rgba(139,92,246,0.08)' : 'rgba(16,185,129,0.08)',
          color: isManagement ? '#8b5cf6' : '#059669',
          border: `1px solid ${isManagement ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)'}`,
        }}>
          {isManagement ? '管理視角' : '企劃視角'}
        </div>
      </div>

      {/* ── KPI 卡片 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {isManagement ? (
          /* 上帝視角 KPI */
          <>
            <KpiCard label="進行中專案" value={kpis.active} unit="件" color="#8b5cf6" />
            <KpiCard label="本月提案數" value={kpis.monthlyProposals} unit="案" color="var(--c-warning)" />
            <KpiCard label="本月得標" value={kpis.monthlyWon} unit="案" color="var(--c-success)"
              sub={`標案 ${kpis.monthlyWonTender || 0} / 商案 ${kpis.monthlyWonCommercial || 0}`} />
            <KpiCard label="本月得標金額" value={`${((kpis.monthlyWonAmount || 0) / 10000).toLocaleString()}`}
              unit={t('common.wan')} color="#ec4899" />
          </>
        ) : (
          /* 企劃視角 KPI */
          <>
            <KpiCard label="我的進行中專案" value={kpis.active} unit="件" color="#8b5cf6" />
            <KpiCard label="本月完成提案" value={kpis.monthlyProposals} unit="案" color="var(--c-warning)" />
            <KpiCard label="我的得標" value={kpis.monthlyWon} unit="案" color="var(--c-success)"
              sub={`標案 ${kpis.monthlyWonTender || 0} / 商案 ${kpis.monthlyWonCommercial || 0}`} />
            <KpiCard label="歷史勝率" value={kpis.winRate || 0} unit="%" color="#ec4899" />
          </>
        )}
      </div>

      {/* ── 管理層：企劃績效排名 ── */}
      {isManagement && ranking.length > 0 && (
        <div className="card" style={{ padding: '22px 26px', marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>各企劃得標績效</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {ranking.map((r, i) => (
              <div key={r.user_id} style={{
                padding: '14px 18px', borderRadius: 12,
                background: i === 0 ? 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.03))' : 'rgba(139,92,246,0.02)',
                border: `1px solid ${i === 0 ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.06)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: r.avatar_color || '#8b5cf6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 13, fontWeight: 700,
                  }}>
                    {r.display_name.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{r.display_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>勝率 {r.winRate}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--c-text-secondary)' }}>
                  <span>得標 <b style={{ color: 'var(--c-success)' }}>{r.wonCount}</b></span>
                  <span>進行 <b style={{ color: '#8b5cf6' }}>{r.activeCount}</b></span>
                  <span>金額 <b style={{ color: '#ec4899' }}>{(r.wonAmount / 10000).toLocaleString()}{t('common.wan')}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 月度趨勢 + 專案列表 + 行事曆 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 月度趨勢迷你圖 */}
          {trend.length > 0 && (
            <div className="card" style={{ padding: '18px 26px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>近6月趨勢</h3>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--c-text-muted)' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'rgba(139,92,246,0.5)', marginRight: 4 }} />提案</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#10b981', marginRight: 4 }} />得標</span>
                </div>
              </div>
              <MiniBarChart data={trend.flatMap(m => [
                { label: m.label, value: m.proposals, color: 'rgba(139,92,246,0.4)' },
                { label: '', value: m.won, color: '#10b981' },
              ])} />
            </div>
          )}

          {/* 專案列表 */}
          <div className="card" style={{ padding: '22px 26px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>
                {isManagement ? t('dash.activeProjectsTitle') : '我負責的專案'}
              </h3>
              <Link to="/new" className="btn btn-sm btn-primary" style={{ fontSize: 12 }}>{t('dash.newProject')}</Link>
            </div>
            {displayProjects.map(p => {
              const status = STATUS_MAP[p.status] || STATUS_MAP.draft;
              const dl = daysUntil(p.deadline);
              const progress = p.status === 'draft' ? 15 : p.status === 'analyzing' ? 30 : p.status === 'planning' ? 55 : p.status === 'bidding' ? 80 : 100;
              return (
                <Link key={p.id} to={`/project/${p.id}`} style={{
                  textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '16px 18px', marginBottom: 10, borderRadius: 16,
                  background: 'rgba(139,92,246,0.02)', border: '1px solid rgba(139,92,246,0.06)',
                  transition: 'all 0.25s ease',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.15)'; e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,92,246,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.06)'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <ProgressRing percent={progress} color={status.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h4>
                      <span className="capsule" style={{ background: `${status.color}12`, color: status.color }}>{status.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--c-text-muted)' }}>
                      <span>{p.agency || p.company}</span>
                      {p.budget && <span>{(Number(p.budget) / 10000).toLocaleString()}{t('common.wan')}</span>}
                      {p.lead_planner_name && (
                        <span style={{ color: '#8b5cf6' }}>
                          主寫：{p.lead_planner_name}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="capsule" style={{
                    background: `${dl.color}10`, color: dl.color,
                    fontWeight: dl.urgent ? 700 : 500, fontSize: 12, padding: '5px 14px',
                  }}>{dl.text}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 行事曆 */}
        <div className="card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>{t('dash.calendar')}</h3>
          {MOCK_CALENDAR.map((day, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>{day.date}</div>
              {day.events.map((evt, j) => {
                const s = EVENT_STYLE[evt.type] || EVENT_STYLE.task;
                return (
                  <div key={j} className="timeline-item" style={{ background: s.bg, borderColor: s.border }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0, marginRight: 8, display: 'inline-block' }} />
                    {evt.title}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI 智能提醒 ── */}
      <div className="card" style={{ padding: '22px 26px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('dash.aiInsights')}</h3>
        {AI_INSIGHTS.map((ins, i) => {
          const s = INSIGHT_STYLE[ins.type];
          return (
            <div key={i} className="insight-card" style={{ background: s.bg, borderColor: s.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.labelBg, color: s.labelColor, marginRight: 10, letterSpacing: '0.5px' }}>{s.label}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text)' }}>{ins.text}</span>
              </div>
              <button className="btn btn-sm btn-secondary" style={{ marginLeft: 12 }}>{ins.action} →</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// KPI 卡片元件
function KpiCard({ label, value, unit, color, sub }) {
  const bg = `linear-gradient(135deg, ${color}14, ${color}04)`;
  return (
    <div className="kpi-card" style={{ background: bg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ color }}>
            {value}<span className="kpi-unit">{unit}</span>
          </div>
          {sub && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>{sub}</div>}
        </div>
        <span className="kpi-icon" style={{ width: 36, height: 36, borderRadius: 10, background: `${color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
        </span>
      </div>
    </div>
  );
}

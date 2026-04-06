import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../LangContext'
import { Link } from 'react-router-dom'
import { api } from '../api'

const SOURCES = [
  { key: 'all', label: '全部', icon: '' }, { key: 'pcc', label: '採購網', icon: '' },
  { key: 'ebuying', label: '加值網', icon: '' }, { key: 'g0v', label: 'g0v', icon: '' },
];
const LINKS = [
  { key: 'pcc', label: '政府電子採購網', url: 'https://web.pcc.gov.tw', icon: '', color: '#1e40af' },
  { key: 'ebuying', label: '採購加值網', url: 'https://ebuying.hinet.net/epvas/', icon: '', color: '#059669' },
  { key: 'g0v', label: 'g0v 標案瀏覽', url: 'https://ronnywang.github.io/pcc-viewer/index.html', icon: '', color: '#7c3aed' },
];
const CODE_COLORS = { '871': '#dc2626', '879': '#ea580c', '911': '#0284c7', '933': '#7c3aed', '96': '#059669', '97': '#64748b' };

const daysUntil = d => !d ? '—' : ((n = Math.ceil((new Date(d) - new Date()) / 86400000)) => n < 0 ? '已截止' : `${n}天`)();
const fmtBudget = b => !b ? '未公告' : typeof b === 'string' ? b : b >= 1e8 ? `${(b / 1e8).toFixed(1)}億` : b >= 1e4 ? `${(b / 1e4).toLocaleString()}萬` : b.toLocaleString();

function Ring({ score, size = 48 }) {
  const s = score || 0, r = (size - 4) / 2, circ = 2 * Math.PI * r;
  const color = s >= 85 ? 'var(--c-success)' : s >= 70 ? 'var(--c-warning)' : '#94a3b8';
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(139,92,246,.06)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={circ - (s / 100) * circ} strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset .6s' }} />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color }}>{s || '—'}</span>
    </div>
  );
}

function Badge({ source }) {
  const m = { pcc: ['rgba(30,64,175,.08)', '#1e40af', '採購網'], g0v: ['rgba(124,58,237,.08)', '#7c3aed', 'g0v'], ebuying: ['rgba(5,150,105,.08)', '#059669', '加值網'] };
  const [bg, c, l] = m[source] || m.pcc;
  return <span className="capsule" style={{ background: bg, color: c, fontSize: 10 }}>{l}</span>;
}

function Tags({ items, onAdd, onRemove, placeholder, icon }) {
  const [v, setV] = useState('');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV(''); } }}
          placeholder={placeholder} className="form-input" style={{ flex: 1, padding: '8px 12px', fontSize: 13 }} />
        <button onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(''); } }} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>{icon} 新增</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {items.map(it => (
          <span key={it.id} className="capsule" style={{ background: 'rgba(139,92,246,.08)', color: 'var(--c-primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
            {it.keyword || it.name}<span onClick={() => onRemove(it.id)} style={{ cursor: 'pointer', opacity: .5 }}></span>
          </span>
        ))}
        {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>尚未設定</span>}
      </div>
    </div>
  );
}

function BidCard({ b, selected, onClick, isSaved }) {
  return (
    <div onClick={onClick} className="card" style={{
      padding: '14px 18px', marginBottom: 8, cursor: 'pointer', transition: 'all .2s',
      background: selected ? 'rgba(139,92,246,.04)' : 'var(--c-bg-card)',
      borderColor: selected ? 'rgba(139,92,246,.2)' : undefined,
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Ring score={b.matchScore} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
            <Badge source={b.source} />
            {b.code && <span className="capsule" style={{ background: `${CODE_COLORS[b.code] || '#64748b'}15`, color: CODE_COLORS[b.code], fontSize: 10 }}>{b.code}</span>}
            <span className="capsule" style={{ background: 'rgba(139,92,246,.04)', color: 'var(--c-text-muted)', fontSize: 10 }}>{b.category}</span>
            {isSaved && <span style={{ fontSize: 11 }}>⭐</span>}
          </div>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: '1px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</h4>
          <p style={{ fontSize: 11, color: 'var(--c-text-muted)', margin: 0 }}>{b.agency}</p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--c-text-muted)', flexShrink: 0 }}>
          <div>{fmtBudget(b.budget)}</div>
          <div>⏰ {daysUntil(b.deadline)}</div>
        </div>
      </div>
    </div>
  );
}

export default function IntelCenter() {
  const { t } = useLang();
  const [tab, setTab] = useState('search');
  const [search, setSearch] = useState('');
  const [srcFilter, setSrcFilter] = useState('all');
  const [sel, setSel] = useState(null);
  const [bids, setBids] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [acctForm, setAcctForm] = useState({ platform: 'pcc', username: '', password: '', notes: '' });
  const [keywords, setKeywords] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  // 標案評估
  const [codes, setCodes] = useState([]);
  const [activeCode, setActiveCode] = useState('96');
  const [codeBids, setCodeBids] = useState([]);
  const [codeLoading, setCodeLoading] = useState(false);
  // 競爭分析
  const [awardSearch, setAwardSearch] = useState({ mode: 'name', keyword: '', agency: '' });
  const [awards, setAwards] = useState([]);
  const [awardLoading, setAwardLoading] = useState(false);
  const [trendResult, setTrendResult] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  // 競品資料庫
  const [records, setRecords] = useState([]);
  const [recordStats, setRecordStats] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recSearch, setRecSearch] = useState('');
  const [recForm, setRecForm] = useState({ agency: '', caseName: '', amount: '', winner2023: '', winner2024: '', winner2025: '', notes: '' });
  const [showRecForm, setShowRecForm] = useState(false);
  const [editingRec, setEditingRec] = useState(null);

  const doSearch = useCallback(async kw => {
    setLoading(true);
    try { const d = await api.searchBids({ keyword: kw || search || '活動', source: srcFilter }); setBids(d.results || []); } catch {} finally { setLoading(false); }
  }, [search, srcFilter]);

  useEffect(() => {
    doSearch('活動');
    api.getSavedBids().then(setSaved).catch(() => {});
    api.getExternalAccounts().then(setAccounts).catch(() => {});
    api.getTrackingKeywords().then(setKeywords).catch(() => {});
    api.getCompetitors().then(setCompetitors).catch(() => {});
    api.getCategories().then(setCodes).catch(() => {});
  }, []);

  const toggleSave = async b => {
    const ex = saved.find(s => s.title === b.title && s.agency === b.agency);
    if (ex) { await api.removeSavedBid(ex.id); setSaved(p => p.filter(s => s.id !== ex.id)); }
    else { const r = await api.saveBid(b); setSaved(p => [...p, { ...b, id: r.id }]); }
  };
  const isSaved = b => saved.some(s => s.title === b.title && s.agency === b.agency);
  const runAi = async b => { setAiLoading(true); setAiResult(null); try { setAiResult(await api.aiMatchBid(b)); } catch {} finally { setAiLoading(false); } };

  // 代碼搜尋
  const searchCode = async code => {
    setActiveCode(code); setCodeLoading(true);
    try { const d = await api.searchByCode(code); setCodeBids(d.results || []); } catch {} finally { setCodeLoading(false); }
  };
  useEffect(() => { if (tab === 'evaluate') searchCode(activeCode); }, [tab]);

  // 決標搜尋
  const searchAward = async () => {
    setAwardLoading(true); setTrendResult(null);
    try {
      const params = awardSearch.mode === 'name' ? { keyword: awardSearch.keyword } : { agency: awardSearch.agency };
      const d = await api.searchAwards(params);
      setAwards(d.results || []);
    } catch {} finally { setAwardLoading(false); }
  };
  const analyzeTrend = async () => {
    if (!awards.length) return;
    setTrendLoading(true);
    try { setTrendResult(await api.analyzeTrend(awards)); } catch {} finally { setTrendLoading(false); }
  };

  const addKw = async kw => { await api.addTrackingKeyword(kw); setKeywords(await api.getTrackingKeywords()); };
  const delKw = async id => { await api.deleteTrackingKeyword(id); setKeywords(await api.getTrackingKeywords()); };
  const addComp = async n => { await api.addCompetitor(n); setCompetitors(await api.getCompetitors()); };
  const delComp = async id => { await api.deleteCompetitor(id); setCompetitors(await api.getCompetitors()); };

  // 競品資料庫
  const loadRecords = async (kw) => {
    setRecLoading(true);
    try {
      const params = kw ? { keyword: kw } : {};
      const d = await api.getRecords(params);
      setRecords(d.results || []);
    } catch {} finally { setRecLoading(false); }
  };
  const loadStats = async () => { try { setRecordStats(await api.getRecordStats()); } catch {} };
  useEffect(() => { if (tab === 'records') { loadRecords(); loadStats(); } }, [tab]);
  const saveRec = async () => {
    if (!recForm.caseName) return;
    if (editingRec) { await api.updateRecord(editingRec, recForm); }
    else { await api.addRecord(recForm); }
    setRecForm({ agency: '', caseName: '', amount: '', winner2023: '', winner2024: '', winner2025: '', notes: '' });
    setShowRecForm(false); setEditingRec(null); loadRecords(recSearch); loadStats();
  };
  const delRec = async id => { await api.deleteRecord(id); loadRecords(recSearch); loadStats(); };
  const editRec = r => { setRecForm({ agency: r.agency, caseName: r.caseName, amount: r.amount, winner2023: r.winner2023, winner2024: r.winner2024, winner2025: r.winner2025, notes: r.notes }); setEditingRec(r.id); setShowRecForm(true); };

  const TABS = [
    { key: 'search', label: '搜尋', count: bids.length },
    { key: 'evaluate', label: '評估', count: codeBids.length },
    { key: 'compete', label: '競爭', count: awards.length },
    { key: 'records', label: '競品資料庫', count: records.length },
    { key: 'saved', label: '⭐ 收藏', count: saved.length },
    { key: 'settings', label: '設定', count: keywords.length + competitors.length + accounts.length },
  ];
  const displayBids = tab === 'saved' ? saved : tab === 'evaluate' ? codeBids : bids;

  // === Detail Panel (shared) ===
  const DetailPanel = () => sel && (
    <div className="card animate-fadeUp" style={{ padding: 20, position: 'sticky', top: 80, maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <Badge source={sel.source} />
        <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--c-text-muted)' }}></button>
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, lineHeight: 1.5 }}>{sel.title}</h3>
      <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 14 }}>{sel.agency}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {[{ l: '預算', v: fmtBudget(sel.budget) }, { l: '截止日', v: sel.deadline || '—' }, { l: '類別', v: sel.category }, { l: '匹配度', v: sel.matchScore ? `${sel.matchScore}%` : '—' }].map(s => (
          <div key={s.l} style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(139,92,246,.03)' }}>
            <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{s.l}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* 文件清單（標案評估用） */}
      {sel.documents && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>招標文件</div>
          {sel.documents.map(d => (
            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,.03)', marginBottom: 4, fontSize: 12 }}>
              <span>{d.name}</span>
              <a href={sel.sourceUrl} target="_blank" rel="noopener" style={{ color: 'var(--c-primary)', fontWeight: 600 }}>開啟 →</a>
            </div>
          ))}
        </div>
      )}
      {competitors.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>對標公司</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {competitors.map(c => <span key={c.id} className="capsule" style={{ background: 'rgba(239,68,68,.06)', color: '#dc2626', fontSize: 11 }}>{c.name}</span>)}
          </div>
        </div>
      )}
      <button onClick={() => runAi(sel)} disabled={aiLoading} className="btn btn-primary" style={{ width: '100%', marginBottom: 10, fontSize: 13 }}>
        {aiLoading ? '分析中...' : 'AI 深度匹配分析'}
      </button>
      {aiResult && (
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(16,185,129,.04)', borderLeft: '4px solid var(--c-success)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-success)' }}>AI 結果</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: aiResult.score >= 80 ? 'var(--c-success)' : aiResult.score >= 60 ? 'var(--c-warning)' : '#94a3b8' }}>{aiResult.score}分</span>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
            <div>{aiResult.reason}</div>
            <div>威脅：<span style={{ color: aiResult.threat === '高' ? '#dc2626' : aiResult.threat === '中' ? '#f59e0b' : 'var(--c-success)' }}>{aiResult.threat}</span></div>
            <div>{aiResult.suggestion}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Link to="/new" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>建立專案</Link>
        <button onClick={() => toggleSave(sel)} className={`btn ${isSaved(sel) ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 13 }}>{isSaved(sel) ? '⭐' : ''}</button>
      </div>
    </div>
  );

  return (
    <div className="animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('intel.title')}</h1>
          <p className="page-subtitle">整合政府採購網 · 採購加值網 · g0v開放資料 · AI智慧匹配</p>
        </div>
      </div>

      {/* 三大入口 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        {LINKS.map(p => (
          <a key={p.key} href={p.url} target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12,
            background: 'var(--c-bg-card)', border: '1px solid var(--c-border)', textDecoration: 'none', color: 'var(--c-text)', transition: 'all .2s',
          }} onMouseOver={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = 'translateY(-1px)'; }}
             onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.transform = 'none'; }}>
            <span style={{ fontSize: 24 }}>{p.icon}</span>
            <div><div style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{p.label}</div><div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>前往 →</div></div>
          </a>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 16, background: 'rgba(139,92,246,.04)', borderRadius: 12, padding: 3 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSel(null); }} style={{
            flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'var(--c-primary)' : 'transparent',
            color: tab === t.key ? '#fff' : 'var(--c-text-muted)', fontWeight: tab === t.key ? 700 : 500,
            fontSize: 12, transition: 'all .2s', whiteSpace: 'nowrap',
          }}>
            {t.label} {t.count > 0 && <span style={{
              background: tab === t.key ? 'rgba(255,255,255,.2)' : 'rgba(139,92,246,.1)',
              padding: '1px 5px', borderRadius: 8, fontSize: 10, marginLeft: 3,
            }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ========== TAB: 標案搜尋 ========== */}
      {tab === 'search' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flex: 1, minWidth: 200 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()}
                placeholder="輸入關鍵字..." className="form-input" style={{ flex: 1, padding: '10px 16px', borderRadius: '9999px 0 0 9999px', borderRight: 'none' }} />
              <button onClick={() => doSearch()} disabled={loading} className="btn btn-primary" style={{ borderRadius: '0 9999px 9999px 0', fontSize: 13 }}>{loading ? '⏳' : '搜尋'}</button>
            </div>
            {SOURCES.map(s => (
              <button key={s.key} onClick={() => setSrcFilter(s.key)} className={`btn btn-sm ${srcFilter === s.key ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 11 }}>{s.icon} {s.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-muted)', lineHeight: '26px' }}>快速：</span>
            {keywords.map(k => (
              <button key={k.id} onClick={() => { setSearch(k.keyword); doSearch(k.keyword); }}
                className="capsule" style={{ cursor: 'pointer', border: 'none', background: 'rgba(139,92,246,.1)', color: 'var(--c-primary)', fontSize: 11, padding: '4px 10px' }}>{k.keyword}</button>
            ))}
            {['活動', '行銷', '企劃', '策展'].filter(w => !keywords.some(k => k.keyword === w)).map(w => (
              <button key={w} onClick={() => { setSearch(w); doSearch(w); }} className="capsule" style={{ cursor: 'pointer', border: 'none', background: 'rgba(139,92,246,.04)', color: 'var(--c-text-muted)', fontSize: 11, padding: '4px 10px' }}>#{w}</button>
            ))}
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-text-muted)' }}>搜尋中...</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 380px' : '1fr', gap: 18 }}>
              <div>{bids.map(b => <BidCard key={b.id} b={b} selected={sel?.id === b.id} onClick={() => { setSel(b); setAiResult(null); }} isSaved={isSaved(b)} />)}</div>
              <DetailPanel />
            </div>
          )}
        </>
      )}

      {/* ========== TAB: 標案評估 (流程圖2) ========== */}
      {tab === 'evaluate' && (
        <>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>勞務類 — 採購代碼分類</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {codes.map(c => (
                <button key={c.code} onClick={() => searchCode(c.code)} style={{
                  padding: '12px 16px', borderRadius: 12, border: `2px solid ${activeCode === c.code ? CODE_COLORS[c.code] : 'var(--c-border)'}`,
                  background: activeCode === c.code ? `${CODE_COLORS[c.code]}08` : 'var(--c-bg-card)',
                  cursor: 'pointer', textAlign: 'left', transition: 'all .2s',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: CODE_COLORS[c.code], marginBottom: 2 }}>{c.code}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{c.label}</div>
                  {c.code === '96' && <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>⭐ 最多案源</div>}
                </button>
              ))}
            </div>
          </div>
          {codeLoading ? <div style={{ textAlign: 'center', padding: 40 }}>⏳ 載入中...</div> : (
            <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 380px' : '1fr', gap: 18 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--c-text-muted)' }}>找到 {codeBids.length} 筆「{codes.find(c => c.code === activeCode)?.label}」標案</div>
                {codeBids.map(b => <BidCard key={b.id} b={b} selected={sel?.id === b.id} onClick={() => { setSel(b); setAiResult(null); }} isSaved={isSaved(b)} />)}
              </div>
              <DetailPanel />
            </div>
          )}
        </>
      )}

      {/* ========== TAB: 競爭分析 (流程圖1) ========== */}
      {tab === 'compete' && (
        <>
          <div className="card" style={{ padding: '18px 22px', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>決標查詢 — 競爭對手分析</div>
            {/* 分支判斷 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setAwardSearch(p => ({ ...p, mode: 'name' }))}
                className={`btn btn-sm ${awardSearch.mode === 'name' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12 }}>
                按標案名稱搜尋（名稱固定）
              </button>
              <button onClick={() => setAwardSearch(p => ({ ...p, mode: 'agency' }))}
                className={`btn btn-sm ${awardSearch.mode === 'agency' ? 'btn-primary' : 'btn-secondary'}`} style={{ fontSize: 12 }}>
                按招標機關搜尋（名稱會換）
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {awardSearch.mode === 'name' ? (
                <input value={awardSearch.keyword} onChange={e => setAwardSearch(p => ({ ...p, keyword: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && searchAward()}
                  placeholder="輸入標案名稱關鍵字（模糊對比）..." className="form-input" style={{ flex: 1, padding: '10px 14px' }} />
              ) : (
                <input value={awardSearch.agency} onChange={e => setAwardSearch(p => ({ ...p, agency: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && searchAward()}
                  placeholder="輸入招標機關名稱..." className="form-input" style={{ flex: 1, padding: '10px 14px' }} />
              )}
              <button onClick={searchAward} disabled={awardLoading} className="btn btn-primary" style={{ fontSize: 13 }}>
                {awardLoading ? '⏳' : '查詢決標'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 8 }}>自動追蹤最近 2-3 年同名/同機關決標紀錄</div>
          </div>

          {/* 決標結果 */}
          {awards.length > 0 && (
            <div className="card" style={{ padding: '18px 22px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>決標紀錄（{awards.length} 筆，{[...new Set(awards.map(a => a.year))].length} 年）</div>
                <button onClick={analyzeTrend} disabled={trendLoading} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>
                  {trendLoading ? '⏳' : 'AI 分析趨勢'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                      {['年度', '標案名稱', '機關', '得標廠商', '金額', '投標數'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {awards.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700 }}>{a.year}</td>
                        <td style={{ padding: '8px 10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--c-text-muted)' }}>{a.agency}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(239,68,68,.06)', color: '#dc2626', fontWeight: 600 }}>{a.winner}</span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{fmtBudget(a.amount)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>{a.bidCount} 家</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AI 趨勢分析結果 */}
          {trendResult && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>AI 得標趨勢分析</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: trendResult.isFixed ? 'rgba(239,68,68,.04)' : 'rgba(16,185,129,.04)', borderLeft: `4px solid ${trendResult.isFixed ? '#dc2626' : 'var(--c-success)'}` }}>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>固定廠商</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: trendResult.isFixed ? '#dc2626' : 'var(--c-success)' }}>{trendResult.isFixed ? '是' : '否'}</div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(139,92,246,.03)' }}>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>最常得標</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{trendResult.topWinner?.name || '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{trendResult.topWinner?.count || 0} 次</div>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(139,92,246,.03)' }}>
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>競爭公平性</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: trendResult.aiAnalysis?.fairness === '高' ? 'var(--c-success)' : trendResult.aiAnalysis?.fairness === '低' ? '#dc2626' : '#f59e0b' }}>
                    {trendResult.aiAnalysis?.fairness || '—'}
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: trendResult.isFixed ? 'rgba(239,68,68,.03)' : 'rgba(16,185,129,.03)', borderLeft: `4px solid ${trendResult.isFixed ? '#dc2626' : 'var(--c-success)'}` }}>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div><strong>趨勢：</strong>{trendResult.aiAnalysis?.trend}</div>
                  <div><strong>風險：</strong><span style={{ color: trendResult.aiAnalysis?.riskLevel === '高' ? '#dc2626' : 'var(--c-success)' }}>{trendResult.aiAnalysis?.riskLevel}</span></div>
                  <div><strong>建議：</strong>{trendResult.aiAnalysis?.recommendation}</div>
                </div>
              </div>
              {/* 得標分布 */}
              {trendResult.winnerCounts && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>得標廠商分布</div>
                  {Object.entries(trendResult.winnerCounts).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, width: 80, flexShrink: 0 }}>{name}</span>
                      <div style={{ flex: 1, height: 16, background: 'rgba(139,92,246,.06)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${(count / awards.length) * 100}%`, height: '100%', background: competitors.some(c => c.name === name) ? '#dc2626' : 'var(--c-primary)', borderRadius: 8, transition: 'width .6s' }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, width: 30 }}>{count}次</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ========== TAB: 收藏 ========== */}
      {tab === 'saved' && (
        <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 380px' : '1fr', gap: 18 }}>
          <div>
            {saved.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: 'var(--c-text-muted)' }}>尚未收藏標案</div>}
            {saved.map(b => <BidCard key={b.id} b={b} selected={sel?.id === b.id} onClick={() => { setSel(b); setAiResult(null); }} isSaved={true} />)}
          </div>
          <DetailPanel />
        </div>
      )}

      {/* ========== TAB: 設定 ========== */}
      {tab === 'settings' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>追蹤關鍵詞</h3>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12 }}>系統會自動搜尋含有這些關鍵詞的標案並提高匹配度。</p>
            <Tags items={keywords} onAdd={addKw} onRemove={delKw} placeholder="例：活動、行銷、企劃..." icon="" />
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>對標公司</h3>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12 }}>AI 會分析競爭威脅並提供投標策略建議。競爭分析頁的得標分布圖會以紅色標示。</p>
            <Tags items={competitors} onAdd={addComp} onRemove={delComp} placeholder="例：奧美、電通、必應創造..." icon="" />
          </div>
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>外部平台帳號</h3>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 12 }}>輸入後系統會嘗試自動登入外部網站抓取標案。</p>
            {accounts.map(a => {
              const p = LINKS.find(l => l.key === a.platform) || {};
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(139,92,246,.03)', marginBottom: 6, border: '1px solid var(--c-border)' }}>
                  <span style={{ fontSize: 18 }}>{p.icon || ''}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{p.label || a.platform}</div><div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{a.username}{a.hasPassword && ' · 已設密碼'}</div></div>
                  <button onClick={async () => { await api.deleteExternalAccount(a.platform); setAccounts(await api.getExternalAccounts()); }}
                    className="btn btn-sm btn-secondary" style={{ fontSize: 11, color: 'var(--c-danger)' }}>刪除</button>
                </div>
              );
            })}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10, marginBottom: 10 }}>
              <select value={acctForm.platform} onChange={e => setAcctForm(p => ({ ...p, platform: e.target.value }))} className="form-input" style={{ padding: '8px 12px' }}>
                <option value="pcc">政府採購網</option><option value="ebuying">採購加值網</option>
              </select>
              <input value={acctForm.username} onChange={e => setAcctForm(p => ({ ...p, username: e.target.value }))} className="form-input" style={{ padding: '8px 12px' }} placeholder="帳號" />
              <input type="password" value={acctForm.password} onChange={e => setAcctForm(p => ({ ...p, password: e.target.value }))} className="form-input" style={{ padding: '8px 12px' }} placeholder="密碼" />
              <input value={acctForm.notes} onChange={e => setAcctForm(p => ({ ...p, notes: e.target.value }))} className="form-input" style={{ padding: '8px 12px' }} placeholder="備註" />
            </div>
            <button onClick={async () => { if (!acctForm.username) return; await api.saveExternalAccount(acctForm); setAccounts(await api.getExternalAccounts()); setAcctForm(p => ({ ...p, username: '', password: '', notes: '' })); }}
              disabled={!acctForm.username} className="btn btn-primary" style={{ fontSize: 13 }}>儲存帳號</button>
          </div>
        </div>
      )}

      {/* ========== TAB: 競品資料庫 ========== */}
      {tab === 'records' && (
        <>
          {/* 統計 KPI */}
          {recordStats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
              <div className="kpi-card" style={{ background: 'rgba(139,92,246,.06)' }}>
                <div className="kpi-label">紀錄總數</div>
                <div className="kpi-value" style={{ color: '#8b5cf6', fontSize: 28 }}>{recordStats.totalRecords}</div>
              </div>
              <div className="kpi-card" style={{ background: 'rgba(5,150,105,.06)' }}>
                <div className="kpi-label">總金額</div>
                <div className="kpi-value" style={{ color: '#059669', fontSize: 22 }}>{fmtBudget(recordStats.totalAmount)}</div>
              </div>
              <div className="kpi-card" style={{ background: 'rgba(239,68,68,.06)' }}>
                <div className="kpi-label">固定得標案件</div>
                <div className="kpi-value" style={{ color: '#dc2626', fontSize: 28 }}>{recordStats.fixedVendors?.length || 0}</div>
              </div>
            </div>
          )}

          {/* 搜尋 + 新增 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={recSearch} onChange={e => setRecSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadRecords(recSearch)}
              placeholder="搜尋機關、案名..." className="form-input" style={{ flex: 1, padding: '10px 14px' }} />
            <button onClick={() => loadRecords(recSearch)} className="btn btn-primary" style={{ fontSize: 13 }}>搜尋</button>
            <button onClick={() => { setShowRecForm(!showRecForm); setEditingRec(null); setRecForm({ agency: '', caseName: '', amount: '', winner2023: '', winner2024: '', winner2025: '', notes: '' }); }}
              className="btn btn-secondary" style={{ fontSize: 13 }}>{showRecForm ? '取消' : '＋ 新增紀錄'}</button>
          </div>

          {/* 新增/編輯表單 */}
          {showRecForm && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{editingRec ? '編輯紀錄' : '＋ 新增競品紀錄'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>機關名稱</label>
                  <input value={recForm.agency} onChange={e => setRecForm(p => ({ ...p, agency: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} placeholder="例：臺中市政府文化局" /></div>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>案名 *</label>
                  <input value={recForm.caseName} onChange={e => setRecForm(p => ({ ...p, caseName: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} placeholder="例：2024臺中兒童藝術節" /></div>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>金額</label>
                  <input value={recForm.amount} onChange={e => setRecForm(p => ({ ...p, amount: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} placeholder="例：2,400,000" /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>2023得標廠商</label>
                  <input value={recForm.winner2023} onChange={e => setRecForm(p => ({ ...p, winner2023: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>2024得標廠商</label>
                  <input value={recForm.winner2024} onChange={e => setRecForm(p => ({ ...p, winner2024: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>2025得標廠商</label>
                  <input value={recForm.winner2025} onChange={e => setRecForm(p => ({ ...p, winner2025: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} /></div>
                <div><label style={{ fontSize: 11, color: 'var(--c-text-muted)', display: 'block', marginBottom: 2 }}>備註</label>
                  <input value={recForm.notes} onChange={e => setRecForm(p => ({ ...p, notes: e.target.value }))} className="form-input" style={{ width: '100%', padding: '8px 10px' }} /></div>
              </div>
              <button onClick={saveRec} disabled={!recForm.caseName} className="btn btn-primary" style={{ fontSize: 13 }}>{editingRec ? '更新' : '儲存'}</button>
            </div>
          )}

          {/* 廠商得標排行（統計） */}
          {recordStats?.topVendors?.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>廠商得標次數排行 TOP 10</div>
              {recordStats.topVendors.slice(0, 10).map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, width: 20, textAlign: 'right', color: i < 3 ? '#f59e0b' : 'var(--c-text-muted)', fontWeight: i < 3 ? 800 : 400 }}>{i + 1}</span>
                  <span style={{ fontSize: 12, width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <div style={{ flex: 1, height: 14, background: 'rgba(139,92,246,.06)', borderRadius: 7, overflow: 'hidden' }}>
                    <div style={{ width: `${(count / recordStats.topVendors[0][1]) * 100}%`, height: '100%', background: competitors.some(c => c.name === name) ? '#dc2626' : 'var(--c-primary)', borderRadius: 7, transition: 'width .6s' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, width: 30 }}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* 資料表格 */}
          {recLoading ? <div style={{ textAlign: 'center', padding: 40 }}>⏳ 載入中...</div> : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'rgba(139,92,246,.03)' }}>
                      {['機關名稱', '案名', '金額', '2023得標', '2024得標', '2025得標', '備註', '操作'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 600, borderBottom: '2px solid var(--c-border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 30, color: 'var(--c-text-muted)' }}>尚無資料，請新增或匯入競品紀錄</td></tr>}
                    {records.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text-muted)' }}>{r.agency || '—'}</td>
                        <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{r.caseName}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: '#059669' }}>{r.amount || '—'}</td>
                        <td style={{ padding: '8px 12px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.winner2023 === 'X' ? <span style={{ color: '#dc2626' }}></span> : r.winner2023 || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.winner2024 === 'X' ? <span style={{ color: '#dc2626' }}></span> : r.winner2024 || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.winner2025 === 'X' ? <span style={{ color: '#dc2626' }}></span> : r.winner2025 || '—'}
                        </td>
                        <td style={{ padding: '8px 12px', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text-muted)', fontSize: 11 }}>{r.notes || '—'}</td>
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          <button onClick={() => editRec(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}></button>
                          <button onClick={() => delRec(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'

const COST_COLORS = { low: '#22c55e', medium: 'var(--c-warning)', high: 'var(--c-danger)' };
const COST_LABELS = { low: '低', medium: '中', high: '高' };

export default function HighlightsPanel({ projectId }) {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const load = () => api.getHighlights(projectId).then(setItems).catch(console.error);
  useEffect(() => { load(); }, [projectId]);

  const generate = async () => {
    setGenerating(true);
    try { await api.generateHighlights(projectId); load(); }
    catch (err) { alert(err.message); }
    finally { setGenerating(false); }
  };

  const addManual = async () => {
    if (!newTitle.trim()) return;
    await api.addHighlight(projectId, { title: newTitle, description: '', cost_level: 'medium' });
    setNewTitle(''); setShowAdd(false); load();
  };

  const toggle = async (h) => {
    await api.updateHighlight(projectId, h.id, { is_selected: h.is_selected ? 0 : 1 });
    load();
  };

  const deleteItem = async (id) => {
    await api.deleteHighlight(projectId, id);
    load();
  };

  const selected = items.filter(h => h.is_selected);
  const deselected = items.filter(h => !h.is_selected);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('hl.title')}</h1>
          <p className="page-subtitle">{t('hl.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => setShowAdd(true)}>{t('hl.addManual')}</button>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? t('hl.generating') : t('hl.generate')}
          </button>
        </div>
      </div>

      {/* 手動新增 */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('hl.inputTitle')}</label>
            <input className="form-input" value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="輸入自訂亮點名稱" />
          </div>
          <button className="btn btn-primary" onClick={addManual}>{t('common.add')}</button>
          <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>{t('common.cancel')}</button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('hl.empty')}</div>
          <p>{t('hl.emptyHint')}</p>
        </div>
      ) : (
        <>
          {/* 已選用亮點 */}
          <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>
            已納入企劃書（{selected.length}）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {selected.map(h => <HighlightCard key={h.id} h={h} onToggle={toggle} onDelete={deleteItem} />)}
          </div>

          {/* 已排除亮點 */}
          {deselected.length > 0 && (
            <>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>
                已排除（{deselected.length}）
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.5 }}>
                {deselected.map(h => <HighlightCard key={h.id} h={h} onToggle={toggle} onDelete={deleteItem} />)}
              </div>
            </>
          )}
        </>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'themes', label: t('hl.prev') }}
        next={{ path: 'plan-summary', label: t('hl.next') }} />
    </>
  );
}

function HighlightCard({ h, onToggle, onDelete }) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <input type="checkbox" checked={!!h.is_selected} onChange={() => onToggle(h)}
        style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--c-primary)', cursor: 'pointer' }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{h.title}</span>
          <span style={{ fontSize: 11, color: COST_COLORS[h.cost_level] || COST_COLORS.medium }}>
            {COST_LABELS[h.cost_level] || '中'}
          </span>
          {h.source === 'manual' && <span className="badge badge-draft">手動</span>}
        </div>
        {h.description && <p style={{ fontSize: 13, color: 'var(--c-text-muted)', margin: '4px 0' }}>{h.description}</p>}
        {h.expected_effect && <p style={{ fontSize: 12, color: 'var(--c-accent)' }}>{h.expected_effect}</p>}
        {h.mapped_criteria && <p style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4 }}>對應：{h.mapped_criteria}</p>}
      </div>
      <button className="btn btn-danger btn-sm" onClick={() => onDelete(h.id)}></button>
    </div>
  );
}

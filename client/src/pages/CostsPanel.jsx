import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'

const CATEGORIES = ['人事費', '場地費', '設備費', '設計印刷費', '交通住宿費', '餐飲費', '雜支', '管理費'];

export default function CostsPanel({ projectId, project }) {
  const { t } = useLang();
  const [items, setItems] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const load = () => api.getCosts(projectId).then(setItems).catch(console.error);
  useEffect(() => { load(); }, [projectId]);

  const addItem = async () => {
    await api.addCost(projectId, { category: '人事費', item_name: '新項目', unit: '式', quantity: 1, unit_price: 0 });
    load();
  };

  const updateField = async (costId, field, value) => {
    const item = items.find(i => i.id === costId);
    const updates = { ...item, [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      updates.subtotal = (Number(updates.quantity) || 0) * (Number(updates.unit_price) || 0);
    }
    await api.updateCost(projectId, costId, updates);
    load();
  };

  const deleteItem = async (costId) => {
    await api.deleteCost(projectId, costId);
    load();
  };

  const aiSuggest = async () => {
    setSuggesting(true);
    try {
      const suggestions = await api.aiCostSuggest(projectId);
      for (const s of suggestions) {
        await api.addCost(projectId, s);
      }
      load();
    } catch (err) { alert(err.message); }
    finally { setSuggesting(false); }
  };

  const total = items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
  const projectBudget = Number(project?.budget) || 0;
  const budgetDiff = projectBudget > 0 ? total - projectBudget : null;
  const budgetMatch = budgetDiff !== null && budgetDiff === 0;
  const byCategory = CATEGORIES.map(cat => ({
    cat, subtotal: items.filter(i => i.category === cat).reduce((s, i) => s + (Number(i.subtotal) || 0), 0)
  })).filter(c => c.subtotal > 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('costs.title')}</h1>
          <p className="page-subtitle">{t('costs.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={async () => {
            try {
              const r = await api.importQuotation(projectId);
              alert(`已從報價清單匯入 ${r.imported} 項`);
              load();
            } catch (err) { alert(err.message); }
          }}>
            從報價單匯入
          </button>
          {projectBudget > 0 && budgetDiff !== null && budgetDiff !== 0 && items.length > 0 && (
            <button className="btn btn-secondary" onClick={async () => {
              if (!confirm(`確定要自動調整所有項目金額，使加總等於 $${projectBudget.toLocaleString()} 嗎？`)) return;
              try {
                await api.autoAdjustCosts(projectId);
                load();
              } catch (err) { alert(err.message); }
            }} style={{ color: '#ec4899', borderColor: 'rgba(236,72,153,0.2)' }}>
              AI 自動調整
            </button>
          )}
          <button className="btn btn-secondary" onClick={aiSuggest} disabled={suggesting}>
            {suggesting ? t('costs.aiSuggesting') : t('costs.aiSuggest')}
          </button>
          <button className="btn btn-primary" onClick={addItem}>{t('costs.addItem')}</button>
        </div>
      </div>

      {/* 分類小計 + 預算校驗 */}
      {(byCategory.length > 0 || projectBudget > 0) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
            {byCategory.map(c => (
              <div key={c.cat} style={{ background: 'var(--c-bg-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
                <span style={{ color: 'var(--c-text-muted)' }}>{c.cat}</span>
                <span style={{ marginLeft: 8, fontWeight: 600 }}>${c.subtotal.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ background: 'var(--c-primary-bg)', border: '1px solid var(--c-primary)', borderRadius: 8, padding: '8px 16px', fontSize: 13 }}>
              <span style={{ color: 'var(--c-primary)' }}>{t('costs.total')}</span>
              <span style={{ marginLeft: 8, fontWeight: 700, color: 'var(--c-primary)' }}>${total.toLocaleString()}</span>
            </div>
          </div>

          {/* 預算校驗指示器 */}
          {projectBudget > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', borderRadius: 10,
              background: budgetMatch ? 'rgba(16,185,129,0.05)' : budgetDiff !== null ? 'rgba(239,68,68,0.05)' : 'rgba(139,92,246,0.03)',
              border: `1px solid ${budgetMatch ? 'rgba(16,185,129,0.2)' : budgetDiff !== null ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.1)'}`,
            }}>
              <span style={{
                width: 28, height: 28, borderRadius: '50%', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 14,
                background: budgetMatch ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: budgetMatch ? '#059669' : '#ef4444',
              }}>
                {budgetMatch ? '✓' : '!'}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: budgetMatch ? '#059669' : '#ef4444' }}>
                  {budgetMatch ? '預算校驗通過' : '預算校驗不通過'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                  案子總金額 ${projectBudget.toLocaleString()} ｜ 成本合計 ${total.toLocaleString()}
                  {budgetDiff !== null && budgetDiff !== 0 && (
                    <span style={{ color: budgetDiff > 0 ? '#ef4444' : 'var(--c-warning)', fontWeight: 600, marginLeft: 8 }}>
                      {budgetDiff > 0 ? `超出 $${budgetDiff.toLocaleString()}` : `尚餘 $${Math.abs(budgetDiff).toLocaleString()}`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 明細表格 */}
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('costs.empty')}</div>
          <p>{t('costs.emptyHint')}</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                {['類別','項目名稱','單位','數量','單價','小計','備註',''].map(h =>
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: 'var(--c-text-muted)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <td style={{ padding: '6px 8px' }}>
                    <select className="form-select" value={item.category} style={{ padding: '4px 8px', fontSize: 12 }}
                      onChange={e => updateField(item.id, 'category', e.target.value)}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </td>
                  <td><input className="form-input" value={item.item_name} style={{ padding: '4px 8px', fontSize: 12 }}
                    onChange={e => updateField(item.id, 'item_name', e.target.value)} /></td>
                  <td><input className="form-input" value={item.unit} style={{ padding: '4px 8px', fontSize: 12, width: 60 }}
                    onChange={e => updateField(item.id, 'unit', e.target.value)} /></td>
                  <td><input className="form-input" type="number" value={item.quantity} style={{ padding: '4px 8px', fontSize: 12, width: 70 }}
                    onChange={e => updateField(item.id, 'quantity', Number(e.target.value))} /></td>
                  <td><input className="form-input" type="number" value={item.unit_price} style={{ padding: '4px 8px', fontSize: 12, width: 100 }}
                    onChange={e => updateField(item.id, 'unit_price', Number(e.target.value))} /></td>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>${(Number(item.subtotal) || 0).toLocaleString()}</td>
                  <td><input className="form-input" value={item.notes || ''} style={{ padding: '4px 8px', fontSize: 12 }}
                    onChange={e => updateField(item.id, 'notes', e.target.value)} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'writing', label: '企劃書撰寫' }}
        next={{ path: 'proposal', label: t('costs.next') }} />
    </>
  );
}

import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const DIFFICULTY_COLORS = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };
const DIFFICULTY_LABELS = { easy: '基礎', medium: '挑戰', hard: '高難度' };
const CATEGORY_COLORS = {
  '技術執行': '#6366f1', '經費預算': '#10b981', '團隊能力': '#f59e0b',
  '品質管控': '#06b6d4', '風險管理': '#ef4444', '創意差異化': '#8b5cf6',
};

function TabButton({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: active ? 700 : 500,
      cursor: 'pointer', background: active ? 'white' : 'transparent',
      color: active ? 'var(--c-primary)' : 'var(--c-text-muted)',
      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none', transition: 'all 0.2s ease',
      whiteSpace: 'nowrap',
    }}>{icon} {label}</button>
  );
}

function MdReport({ title, subtitle, color, report }) {
  return (
    <div className="card" style={{ padding: '28px 32px', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 20 }}>{subtitle}</p>}
      <div className="markdown-report"><ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown></div>
    </div>
  );
}

function GenButton({ loading, hasData, onClick, loadingText, generateText, regenerateText, style }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '24px', marginBottom: 16, ...style }}>
      <button className="btn btn-primary" onClick={onClick} disabled={loading}
        style={{ padding: '12px 36px', fontSize: 15 }}>
        {loading ? loadingText : hasData ? regenerateText : generateText}
      </button>
    </div>
  );
}

export default function BidPanel({ projectId }) {
  const { t } = useLang();
  const [bid, setBid] = useState({ bid_date: '', result: '', review_notes: '', presentation_date: '' });
  const [saving, setSaving] = useState(false);
  const [project, setProject] = useState(null);

  const [qaItems, setQaItems] = useState([]);
  const [qaLoading, setQaLoading] = useState(false);
  const [expandedQA, setExpandedQA] = useState({});
  const [presReport, setPresReport] = useState(null);
  const [presLoading, setPresLoading] = useState(false);
  const [budgetStrategy, setBudgetStrategy] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [competitorReport, setCompetitorReport] = useState(null);
  const [competitorLoading, setCompetitorLoading] = useState(false);
  const [ganttData, setGanttData] = useState(null);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [sentimentReport, setSentimentReport] = useState(null);
  const [sentimentLoading, setSentimentLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('checklist');

  useEffect(() => {
    api.getBid(projectId).then(data => { if (data) setBid(data); }).catch(() => {});
    api.getProject(projectId).then(setProject).catch(() => {});
    api.getBidQA(projectId).then(d => { if (d?.items?.length) setQaItems(d.items); }).catch(() => {});
    api.getBidPresentation(projectId).then(d => { if (d?.report) setPresReport(d.report); }).catch(() => {});
    api.getBudgetStrategy(projectId).then(d => { if (d?.allocations) setBudgetStrategy(d); }).catch(() => {});
    api.getCompetitorAnalysis(projectId).then(d => { if (d?.report) setCompetitorReport(d.report); }).catch(() => {});
    api.getGantt(projectId).then(d => { if (d?.phases) setGanttData(d); }).catch(() => {});
    api.getSentimentTemplate(projectId).then(d => { if (d?.report) setSentimentReport(d.report); }).catch(() => {});
  }, [projectId]);

  const set = f => e => setBid({ ...bid, [f]: e.target.value });
  const save = async () => {
    setSaving(true);
    try { const fn = bid.id ? api.updateBid : api.saveBid; setBid(await fn(projectId, bid)); }
    catch (err) { alert(err.message); } finally { setSaving(false); }
  };

  const gen = (fn, setter, loader) => async () => {
    loader(true);
    try { const r = await fn(projectId); setter(r?.items || r?.report || r); }
    catch (err) { alert(err.message); } finally { loader(false); }
  };

  const deadline = project?.deadline;
  const isValidDate = d => d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime());
  const daysLeft = isValidDate(deadline) ? Math.ceil((new Date(deadline) - new Date()) / 86400000) : null;

  const TABS = [
    { key: 'checklist', label: '投標清單', icon: '✅' },
    { key: 'qa', label: `答詢準備${qaItems.length ? ` (${qaItems.length})` : ''}`, icon: '🎯' },
    { key: 'presentation', label: '簡報框架', icon: '📊' },
    { key: 'budget', label: '預算策略', icon: '💰' },
    { key: 'gantt', label: '時程甘特', icon: '📅' },
    { key: 'competitor', label: '競爭分析', icon: '🏢' },
    { key: 'sentiment', label: '輿情範本', icon: '📡' },
    { key: 'record', label: '投標紀錄', icon: '📋' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('bid.title')}</h1>
          <p className="page-subtitle">投標準備、答詢模擬、預算策略、競爭分析、時程管控</p>
        </div>
        {/* PDF 匯出 */}
        <button className="btn btn-secondary" onClick={() => window.print()}
          style={{ fontSize: 13 }}>列印 / 匯出 PDF</button>
      </div>

      {daysLeft !== null && (
        <div className="card" style={{
          textAlign: 'center', padding: '32px', marginBottom: 24,
          borderColor: daysLeft <= 3 ? 'var(--c-danger)' : daysLeft <= 7 ? 'var(--c-warning)' : 'var(--c-border)'
        }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: daysLeft <= 3 ? 'var(--c-danger)' : daysLeft <= 7 ? 'var(--c-warning)' : 'var(--c-primary)' }}>
            {daysLeft <= 0 ? '已截止' : `${daysLeft} 天`}
          </div>
          <div style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>距離投標截止日 {deadline}</div>
        </div>
      )}

      {/* Tab 切換 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(99,102,241,0.04)', padding: 4, borderRadius: 12, overflowX: 'auto' }}>
        {TABS.map(tab => <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} icon={tab.icon} label={tab.label} />)}
      </div>

      {/* ========== 投標清單 ========== */}
      {activeTab === 'checklist' && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>{t('bid.checklist')}</h3>
          {['企劃書（含裝訂）','報價單 / 經費表','公司登記證影本','營利事業登記證','近三年財務報表','投標標封','押標金'].map((item, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--c-primary)' }} />
              {item}
            </label>
          ))}
        </div>
      )}

      {/* ========== 答詢準備 ========== */}
      {activeTab === 'qa' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={qaLoading} hasData={qaItems.length > 0}
            onClick={gen(api.generateBidQA, r => setQaItems(r), setQaLoading)}
            loadingText="AI 正在模擬評審提問..." generateText="AI 模擬評審提問" regenerateText="重新生成答詢題目" />
          {qaItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {qaItems.map((qa, i) => {
                const expanded = expandedQA[i];
                const catColor = CATEGORY_COLORS[qa.category] || '#6366f1';
                return (
                  <div key={i} className="card" style={{ padding: '16px 20px', cursor: 'pointer', borderLeft: `4px solid ${catColor}`, background: expanded ? 'rgba(99,102,241,0.02)' : 'white', transition: 'all 0.2s' }}
                    onClick={() => setExpandedQA(p => ({ ...p, [i]: !p[i] }))}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${catColor}15`, color: catColor, fontWeight: 700 }}>{qa.category}</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${DIFFICULTY_COLORS[qa.difficulty]}15`, color: DIFFICULTY_COLORS[qa.difficulty], fontWeight: 700 }}>{DIFFICULTY_LABELS[qa.difficulty] || qa.difficulty}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>Q{i + 1}. {qa.question}</div>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--c-text-muted)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                    {expanded && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
                        {qa.intent && <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.06)' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', marginBottom: 4 }}>委員意圖</div><div style={{ fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.6 }}>{qa.intent}</div></div>}
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(16,185,129,0.06)' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4 }}>建議回答策略</div><div style={{ fontSize: 13, color: 'var(--c-text-secondary)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{qa.suggested_answer}</div></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========== 簡報框架 ========== */}
      {activeTab === 'presentation' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={presLoading} hasData={!!presReport}
            onClick={gen(api.generateBidPresentation, r => setPresReport(r), setPresLoading)}
            loadingText="AI 正在設計簡報框架..." generateText="AI 生成 15 分鐘簡報框架" regenerateText="重新生成簡報框架" />
          {presReport && <MdReport title="15 分鐘簡報框架" subtitle="AI 根據企劃書和評選標準設計的完整簡報大綱" color="#8b5cf6" report={presReport} />}
        </div>
      )}

      {/* ========== 預算策略 ========== */}
      {activeTab === 'budget' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={budgetLoading} hasData={!!budgetStrategy}
            onClick={gen(api.generateBudgetStrategy, setBudgetStrategy, setBudgetLoading)}
            loadingText="AI 正在分析預算配置..." generateText="AI 生成預算配分策略" regenerateText="重新生成預算策略" />
          {budgetStrategy && (
            <div className="card" style={{ padding: '28px 32px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>預算配分策略</div>
              {budgetStrategy.strategy_summary && <p style={{ fontSize: 13, color: 'var(--c-text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>{budgetStrategy.strategy_summary}</p>}
              {budgetStrategy.allocations?.map((a, i) => (
                <div key={i} style={{ padding: '14px 18px', borderRadius: 10, border: '1px solid var(--c-border)', marginBottom: 10, background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div><span style={{ fontSize: 14, fontWeight: 700 }}>{a.category}</span>
                      {a.related_criteria && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8 }}>對應：{a.related_criteria} ({a.criteria_weight}%)</span>}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>NT$ {Number(a.suggested_amount || 0).toLocaleString()}</div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.04)', overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: '#10b981', width: `${a.suggested_ratio || 0}%`, transition: 'width 0.8s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>{a.reasoning}</div>
                  {a.key_items?.length > 0 && <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4 }}>包含：{a.key_items.join('、')}</div>}
                  {a.risk_note && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>風險：{a.risk_note}</div>}
                </div>
              ))}
              {budgetStrategy.reserve && (
                <div style={{ padding: '12px 18px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px dashed rgba(245,158,11,0.3)', marginTop: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>預備金 {budgetStrategy.reserve.ratio}%</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309', marginLeft: 12 }}>NT$ {Number(budgetStrategy.reserve.amount || 0).toLocaleString()}</span>
                  <span style={{ fontSize: 12, color: 'var(--c-text-muted)', marginLeft: 8 }}>{budgetStrategy.reserve.purpose}</span>
                </div>
              )}
              {budgetStrategy.optimization_tips?.length > 0 && (
                <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(99,102,241,0.04)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>省錢技巧</div>
                  {budgetStrategy.optimization_tips.map((tip, i) => <div key={i} style={{ fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.8 }}>- {tip}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== 甘特圖 ========== */}
      {activeTab === 'gantt' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={ganttLoading} hasData={!!ganttData}
            onClick={gen(api.generateGantt, setGanttData, setGanttLoading)}
            loadingText="AI 正在規劃時程..." generateText="AI 生成履約時程甘特圖" regenerateText="重新生成甘特圖" />
          {ganttData && (
            <div className="card" style={{ padding: '28px 32px', borderLeft: '4px solid #6366f1', overflowX: 'auto' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>履約時程甘特圖</div>
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 20 }}>{ganttData.start_date} ~ {ganttData.end_date}</p>
              {/* 視覺化甘特圖 */}
              {ganttData.phases?.map((phase, pi) => {
                const projStart = new Date(ganttData.start_date).getTime();
                const projEnd = new Date(ganttData.end_date).getTime();
                const projLen = projEnd - projStart || 1;
                const pStart = new Date(phase.start).getTime();
                const pEnd = new Date(phase.end).getTime();
                const left = Math.max(0, ((pStart - projStart) / projLen) * 100);
                const width = Math.max(5, ((pEnd - pStart) / projLen) * 100);
                return (
                  <div key={pi} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: phase.color || '#6366f1', marginBottom: 6 }}>{phase.name}</div>
                    <div style={{ position: 'relative', height: 24, background: 'rgba(0,0,0,0.03)', borderRadius: 6, marginBottom: 4 }}>
                      <div style={{ position: 'absolute', left: `${left}%`, width: `${width}%`, height: '100%', background: phase.color || '#6366f1', borderRadius: 6, opacity: 0.7 }} />
                      <div style={{ position: 'absolute', left: `${left}%`, top: 4, fontSize: 10, color: 'white', fontWeight: 600, paddingLeft: 6, whiteSpace: 'nowrap' }}>
                        {phase.start} ~ {phase.end}
                      </div>
                    </div>
                    {phase.tasks?.map((task, ti) => {
                      const tStart = new Date(task.start).getTime();
                      const tEnd = new Date(task.end).getTime();
                      const tLeft = Math.max(0, ((tStart - projStart) / projLen) * 100);
                      const tWidth = Math.max(3, ((tEnd - tStart) / projLen) * 100);
                      return (
                        <div key={ti} style={{ position: 'relative', height: 18, marginBottom: 2 }}>
                          <div style={{ position: 'absolute', left: `${tLeft}%`, width: `${tWidth}%`, height: '100%', background: `${phase.color || '#6366f1'}40`, borderRadius: 4, border: `1px solid ${phase.color || '#6366f1'}30` }} />
                          <span style={{ position: 'relative', fontSize: 10, paddingLeft: `${tLeft + 1}%`, color: 'var(--c-text-secondary)', whiteSpace: 'nowrap' }}>{task.name} {task.owner ? `(${task.owner})` : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {/* 里程碑 */}
              {ganttData.milestones?.length > 0 && (
                <div style={{ marginTop: 16, padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.04)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>關鍵里程碑</div>
                  {ganttData.milestones.map((m, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.8 }}><span style={{ fontWeight: 700, color: '#ef4444' }}>{m.date}</span> — {m.name}</div>)}
                </div>
              )}
              {/* 付款節點 */}
              {ganttData.payment_schedule?.length > 0 && (
                <div style={{ marginTop: 12, padding: '14px 18px', borderRadius: 10, background: 'rgba(16,185,129,0.04)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 8 }}>付款節點</div>
                  {ganttData.payment_schedule.map((p, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.8 }}><span style={{ fontWeight: 700 }}>{p.stage} ({p.ratio}%)</span> — {p.trigger} {p.estimated_date ? `(${p.estimated_date})` : ''}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========== 競爭分析 ========== */}
      {activeTab === 'competitor' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={competitorLoading} hasData={!!competitorReport}
            onClick={gen(api.generateCompetitorAnalysis, r => setCompetitorReport(r), setCompetitorLoading)}
            loadingText="AI 正在分析市場競爭..." generateText="AI 生成競爭者分析" regenerateText="重新生成競爭分析" />
          {competitorReport && <MdReport title="市場競爭態勢分析" subtitle="基於此標案類型和預算規模的競爭情報" color="#f59e0b" report={competitorReport} />}
        </div>
      )}

      {/* ========== 輿情範本 ========== */}
      {activeTab === 'sentiment' && (
        <div style={{ marginBottom: 24 }}>
          <GenButton loading={sentimentLoading} hasData={!!sentimentReport}
            onClick={gen(api.generateSentimentTemplate, r => setSentimentReport(r), setSentimentLoading)}
            loadingText="AI 正在生成輿情範本..." generateText="AI 生成輿情監測範本" regenerateText="重新生成輿情範本" />
          {sentimentReport && <MdReport title="輿情監測與分析執行範本" subtitle="含關鍵字策略、KOL 分級、報告範本、危機 SOP" color="#06b6d4" report={sentimentReport} />}
        </div>
      )}

      {/* ========== 投標紀錄 ========== */}
      {activeTab === 'record' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{t('bid.record')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">{t('bid.date')}</label>
              <input className="form-input" type="date" value={bid.bid_date} onChange={set('bid_date')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('bid.result')}</label>
              <select className="form-select" value={bid.result} onChange={set('result')}>
                <option value="">{t('bid.result.pending')}</option>
                <option value="won">得標</option>
                <option value="lost">未得標</option>
                <option value="void">流標</option>
              </select>
            </div>
          </div>
          {bid.result === 'lost' && (
            <div className="form-group">
              <label className="form-label">{t('bid.reviewNotes')}</label>
              <textarea className="form-textarea" value={bid.review_notes} onChange={set('review_notes')} placeholder="記錄未得標原因、可改進之處..." />
            </div>
          )}
          {bid.result === 'won' && (
            <div className="form-group">
              <label className="form-label">{t('bid.presentationDate')}</label>
              <input className="form-input" type="date" value={bid.presentation_date} onChange={set('presentation_date')} />
            </div>
          )}
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? t('bid.saving') : t('common.save')}
          </button>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'venue-sim', label: '場地模擬' }}
        next={{ path: 'execution', label: t('bid.next') }} />
    </>
  );
}

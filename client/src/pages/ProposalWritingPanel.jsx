import { useState, useEffect } from 'react'
import { api } from '../api'
import StepNav from '../components/StepNav'

const GoogleLink = ({ keyword }) => keyword ? (
  <a href={`https://www.google.com/search?q=${encodeURIComponent(keyword)}`}
    target="_blank" rel="noopener noreferrer"
    style={{
      color: 'var(--c-primary)', textDecoration: 'none', fontSize: 12,
      borderBottom: '1px dashed var(--c-primary)', paddingBottom: 1,
    }}
    onMouseEnter={e => { e.target.style.borderBottomStyle = 'solid'; e.target.style.opacity = 0.8; }}
    onMouseLeave={e => { e.target.style.borderBottomStyle = 'dashed'; e.target.style.opacity = 1; }}>
    {keyword}
  </a>
) : null;

/* ── 極簡 Section 元件 ── */
function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
        color: 'var(--c-text-muted)', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ width: 3, height: 14, background: 'var(--c-primary)', borderRadius: 2, display: 'inline-block' }} />
        {title}
        {subtitle && <span style={{ fontWeight: 400, fontSize: 11, textTransform: 'none', letterSpacing: 0 }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/* ── Table 元件 ── */
function DataTable({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--c-border)' }}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--c-bg-warm)' }}>
            {headers.map(h => (
              <th key={h} style={{
                padding: '10px 14px', textAlign: 'left', fontWeight: 600,
                fontSize: 11, letterSpacing: '0.3px', color: 'var(--c-text-muted)',
                borderBottom: '1px solid var(--c-border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, j) => (
            <tr key={j} style={{ borderBottom: j < rows.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
              {cells.map((cell, k) => (
                <td key={k} style={{
                  padding: '10px 14px',
                  fontWeight: k === 0 ? 500 : 400,
                  color: k === cells.length - 1 && cell?.toString().includes('NT') ? '#059669' : 'inherit',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProposalWritingPanel({ projectId, project }) {
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [chapters, setChapters] = useState({});
  const [generating, setGenerating] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);
  const [loading, setLoading] = useState(true);
  // AI 追問
  const [chatOpen, setChatOpen] = useState(null);
  const [chatHistories, setChatHistories] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // 模擬圖
  const [simImages, setSimImages] = useState({}); // { itemName: { url, loading } }

  const handleAiChat = async (subKey, itemName, context) => {
    if (!chatInput.trim()) return;
    const chatKey = `${subKey}:${itemName}`;
    const question = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    const history = chatHistories[chatKey] || [];
    setChatHistories(prev => ({ ...prev, [chatKey]: [...history, { role: 'user', content: question }] }));
    try {
      const result = await api.aiFollowUp(projectId, { context, subActivityName: itemName, question, history });
      setChatHistories(prev => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), { role: 'assistant', content: result.answer }] }));
    } catch (err) {
      setChatHistories(prev => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), { role: 'assistant', content: 'AI 回覆失敗: ' + err.message }] }));
    } finally { setChatLoading(false); }
  };

  const generateSimImage = async (itemName, description) => {
    setSimImages(prev => ({ ...prev, [itemName]: { loading: true } }));
    try {
      const result = await api.generateSimImage(projectId, {
        activity_name: itemName,
        description: description || '',
        style: 'illustration',
      });
      setSimImages(prev => ({ ...prev, [itemName]: { url: result.image_url, loading: false, provider: result.provider } }));
    } catch (err) {
      setSimImages(prev => ({ ...prev, [itemName]: { error: err.message, loading: false } }));
    }
  };

  // 評選標準儀表板
  const [evalCriteria, setEvalCriteria] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getSelectedSubActivities(projectId).catch(() => ({ items: [] })),
      api.getProposalWriting(projectId).catch(() => null),
      api.getAnalysis(projectId).catch(() => null),
    ]).then(([subsData, pwData, analysisData]) => {
      const items = subsData?.items || [];
      setSelectedSubs(items);
      if (pwData?.chapters) setChapters(pwData.chapters);
      if (items.length > 0 && !pwData?.chapters) setExpandedSub(items[0].key);

      // 提取評選標準
      if (analysisData?.analysis_json?.meta?.evaluationCriteria) {
        setEvalCriteria(analysisData.analysis_json.meta.evaluationCriteria);
      }
    }).finally(() => setLoading(false));
  }, [projectId]);

  const generateChapter = async (subKey) => {
    setGenerating(subKey);
    try {
      const result = await api.generateProposalChapter(projectId, encodeURIComponent(subKey));
      setChapters(prev => ({ ...prev, [subKey]: result.chapter }));
      setExpandedSub(subKey);
    } catch (err) { alert('生成失敗: ' + err.message); }
    finally { setGenerating(null); }
  };

  const generateAll = async () => {
    for (const sub of selectedSubs) {
      if (!chapters[sub.key]) {
        setGenerating(sub.key);
        try {
          const result = await api.generateProposalChapter(projectId, encodeURIComponent(sub.key));
          setChapters(prev => ({ ...prev, [sub.key]: result.chapter }));
        } catch (err) { console.error(err); }
      }
    }
    setGenerating(null);
  };

  const exportProposal = () => {
    const now = new Date().toLocaleDateString('zh-TW');
    const projectName = project?.name || '專案';
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${projectName} — 企劃書</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&display=swap');
@page{margin:2.5cm}
body{font-family:'Noto Sans TC',sans-serif;max-width:800px;margin:50px auto;padding:0 24px;color:#2c3e50;line-height:2;font-size:14px}
h1{font-size:26px;font-weight:700;color:#1a1a2e;border-bottom:3px solid #6366f1;padding-bottom:14px;margin-bottom:8px}
.subtitle{color:#64748b;font-size:14px;margin-bottom:40px}
h2{font-size:19px;font-weight:700;color:#1a1a2e;margin-top:48px;padding:14px 20px;background:#f8f9ff;border-radius:12px;border-left:4px solid #6366f1}
h3{font-size:14px;font-weight:600;color:#64748b;margin-top:28px;letter-spacing:0.5px;text-transform:uppercase}
h3::before{content:'';display:inline-block;width:3px;height:12px;background:#6366f1;border-radius:2px;margin-right:8px;vertical-align:middle}
.checkpoint{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:20px 24px;margin:12px 0}
.checkpoint-title{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:8px}
.checkpoint-num{display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:#6366f1;color:#fff;font-size:12px;font-weight:700;margin-right:10px}
.core-msg{background:linear-gradient(135deg,#fef9c3,#fde68a);padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;margin-top:10px;display:inline-block}
.detail{font-size:13px;color:#475569;margin-top:4px}
.detail strong{color:#1a1a2e;font-weight:600}
table{width:100%;border-collapse:collapse;margin:12px 0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden}
th{background:#f8f9ff;padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#64748b;letter-spacing:0.3px;border-bottom:1px solid #e5e7eb}
td{padding:10px 14px;font-size:13px;border-bottom:1px solid #f1f5f9}
.note{background:#fff5f5;border-left:3px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:13px}
.backup{background:#f0f9ff;border-left:3px solid #3b82f6;padding:12px 16px;border-radius:0 8px 8px 0;margin:12px 0;font-size:13px}
.vendor{border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin:8px 0}
.vendor a{color:#6366f1;text-decoration:none;border-bottom:1px dashed #6366f1}
.footer{margin-top:60px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8;text-align:center}
@media print{body{margin:0;padding:0}h2{break-before:page}}
</style></head><body>
<h1>${projectName}</h1>
<div class="subtitle">企劃書 ｜ ${now}${project?.agency ? ' ｜ ' + project.agency : ''}</div>\n`;

    selectedSubs.forEach((sub, i) => {
      const ch = chapters[sub.key];
      if (!ch) return;
      html += `<h2>${i + 1}. ${ch.chapter_title || sub.name}</h2>\n`;
      if (ch.chapter_intro) html += `<p>${ch.chapter_intro}</p>\n`;

      if (ch.activity_items?.length) {
        html += `<h3>活動設計</h3>\n`;
        ch.activity_items.forEach((item, j) => {
          html += `<div class="checkpoint"><div class="checkpoint-title"><span class="checkpoint-num">${j + 1}</span>${item.item_name}</div>\n`;
          html += `<p>${item.description || ''}</p>\n`;
          if (item.rules) html += `<div class="detail"><strong>規則</strong>　${item.rules}</div>\n`;
          if (item.props_list?.length) html += `<div class="detail"><strong>道具</strong>　${item.props_list.join('、')}</div>\n`;
          if (item.space_requirement) html += `<div class="detail"><strong>空間</strong>　${item.space_requirement}</div>\n`;
          if (item.staff) html += `<div class="detail"><strong>人力</strong>　${item.staff}</div>\n`;
          if (item.core_message) html += `<div class="core-msg">傳達理念：${item.core_message}</div>\n`;
          html += `</div>\n`;
        });
      }

      if (ch.suggested_timeline?.length) {
        html += `<h3>活動流程</h3><table><tr><th style="width:120px">時段</th><th>內容</th><th>備註</th></tr>\n`;
        ch.suggested_timeline.forEach(t => html += `<tr><td style="font-weight:600;color:#6366f1">${t.time}</td><td>${t.content}</td><td style="color:#94a3b8">${t.note || ''}</td></tr>\n`);
        html += `</table>\n`;
      }

      if (ch.reward_plan?.rewards?.length) {
        html += `<h3>獎品兌換</h3>`;
        if (ch.reward_plan.participation_rule) html += `<p>${ch.reward_plan.participation_rule}</p>\n`;
        html += `<table><tr><th>品名</th><th>材質</th><th>尺寸</th><th>數量</th><th>估價</th></tr>\n`;
        ch.reward_plan.rewards.forEach(r => html += `<tr><td style="font-weight:500">${r.item_name}</td><td>${r.material}</td><td>${r.size}</td><td>${r.quantity}</td><td style="color:#059669">${r.estimated_price}</td></tr>\n`);
        html += `</table>\n`;
      }

      if (ch.hardware_list?.length) {
        html += `<h3>硬體需求</h3><table><tr><th>品項</th><th>規格</th><th>數量</th><th>用途</th></tr>\n`;
        ch.hardware_list.forEach(h => html += `<tr><td style="font-weight:500">${h.item}</td><td>${h.spec}</td><td>${h.quantity}</td><td>${h.purpose}</td></tr>\n`);
        html += `</table>\n`;
      }

      if (ch.staff_plan?.length) {
        html += `<h3>人力配置</h3><table><tr><th>角色</th><th>人數</th><th>職責</th></tr>\n`;
        ch.staff_plan.forEach(s => html += `<tr><td style="font-weight:500">${s.role}</td><td>${s.count}</td><td>${s.duty}</td></tr>\n`);
        html += `</table>\n`;
      }

      if (ch.budget_detail?.length) {
        html += `<h3>預算明細</h3><table><tr><th>項目</th><th>單位</th><th>數量</th><th>單價</th><th>小計</th></tr>\n`;
        ch.budget_detail.forEach(b => html += `<tr><td style="font-weight:500">${b.item}</td><td>${b.unit}</td><td>${b.quantity}</td><td>${b.unit_price}</td><td style="font-weight:600;color:#059669">${b.subtotal}</td></tr>\n`);
        html += `</table>\n`;
      }

      if (ch.recommended_vendors?.length) {
        html += `<h3>推薦資源</h3>\n`;
        ch.recommended_vendors.forEach(v => {
          html += `<div class="vendor"><strong>${v.category}</strong> — ${v.vendor_type || ''}`;
          if (v.search_keyword) html += `<br><a href="https://www.google.com/search?q=${encodeURIComponent(v.search_keyword)}">${v.search_keyword}</a>`;
          if (v.price_range) html += `<br><span style="color:#059669">${v.price_range}</span>`;
          html += `</div>\n`;
        });
      }

      if (ch.risk_notes) html += `<div class="note"><strong>注意事項</strong>　${ch.risk_notes}</div>\n`;
      if (ch.weather_backup) html += `<div class="backup"><strong>雨備方案</strong>　${ch.weather_backup}</div>\n`;
    });

    html += `<div class="footer">WDMC AI 賦能系統 ｜ ${now}<br>此文件為 AI 初稿，請根據實際情況調整</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName}_企劃書.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loader-container"><div className="loader" /></div>;

  const doneCount = selectedSubs.filter(s => chapters[s.key]).length;

  return (
    <>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 32,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
            架構總表
          </h1>
          <p style={{ fontSize: 13, color: 'var(--c-text-muted)', margin: '6px 0 0', lineHeight: 1.6 }}>
            為每個子活動深度撰寫完整企劃內容
            <span style={{
              marginLeft: 12, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: doneCount === selectedSubs.length && doneCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.08)',
              color: doneCount === selectedSubs.length && doneCount > 0 ? '#059669' : 'var(--c-primary)',
            }}>
              {doneCount} / {selectedSubs.length}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={generateAll}
            disabled={generating !== null}
            style={{
              padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              border: '1px solid var(--c-border)', background: 'white', cursor: 'pointer',
              color: 'var(--c-text)', transition: 'all 0.2s',
              opacity: generating ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!generating) { e.target.style.background = 'var(--c-bg-warm)'; e.target.style.borderColor = 'var(--c-primary)'; }}}
            onMouseLeave={e => { e.target.style.background = 'white'; e.target.style.borderColor = 'var(--c-border)'; }}>
            {generating ? 'AI 撰寫中 ...' : '一鍵全部生成'}
          </button>
          {doneCount > 0 && (
            <button
              onClick={exportProposal}
              style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                border: 'none', background: 'var(--c-primary)', color: 'white', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => e.target.style.opacity = '0.85'}
              onMouseLeave={e => e.target.style.opacity = '1'}>
              匯出企劃書
            </button>
          )}
        </div>
      </div>

      {selectedSubs.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '80px 40px',
          background: 'var(--c-bg-warm)', borderRadius: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>尚未選取子活動</div>
          <p style={{ color: 'var(--c-text-muted)', fontSize: 14 }}>請先前往「架構總表」確認活動架構</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ── 進度條 ── */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              height: 4, borderRadius: 4, background: 'var(--c-border)',
              overflow: 'hidden', marginBottom: 16,
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, var(--c-primary), #10b981)',
                width: `${selectedSubs.length > 0 ? (doneCount / selectedSubs.length * 100) : 0}%`,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedSubs.map(sub => {
                const done = !!chapters[sub.key];
                const active = expandedSub === sub.key;
                return (
                  <button key={sub.key}
                    onClick={() => setExpandedSub(active ? null : sub.key)}
                    style={{
                      padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                      border: active ? '2px solid var(--c-primary)' : '1px solid var(--c-border)',
                      background: active ? 'var(--c-primary)' : done ? 'rgba(16,185,129,0.06)' : 'white',
                      color: active ? 'white' : done ? '#059669' : 'var(--c-text-muted)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {sub.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── 各子活動章節 ── */}
          {selectedSubs.map((sub, i) => {
            const ch = chapters[sub.key];
            const isExpanded = expandedSub === sub.key;

            return (
              <div key={sub.key} style={{
                borderRadius: 14, border: '1px solid var(--c-border)',
                overflow: 'hidden', background: 'white',
                boxShadow: isExpanded ? '0 2px 12px rgba(0,0,0,0.04)' : 'none',
                transition: 'box-shadow 0.2s',
              }}>
                {/* 標題列 */}
                <div
                  onClick={() => setExpandedSub(isExpanded ? null : sub.key)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '18px 28px', cursor: 'pointer',
                    borderLeft: `4px solid ${sub.color || '#6366f1'}`,
                  }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'inline-flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        background: ch ? 'rgba(16,185,129,0.1)' : 'var(--c-bg-warm)',
                        color: ch ? '#059669' : 'var(--c-text-muted)',
                      }}>
                        {ch ? '' : i + 1}
                      </span>
                      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{sub.name}</h3>
                    </div>
                    {sub.description && (
                      <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: '6px 0 0 40px', lineHeight: 1.5 }}>
                        {sub.description.length > 80 ? sub.description.slice(0, 80) + '...' : sub.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); generateChapter(sub.key); }}
                      disabled={generating === sub.key}
                      style={{
                        padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        border: '1px solid var(--c-border)', background: 'white',
                        color: generating === sub.key ? 'var(--c-text-muted)' : 'var(--c-text)',
                        cursor: generating === sub.key ? 'wait' : 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (generating !== sub.key) e.target.style.borderColor = 'var(--c-primary)'; }}
                      onMouseLeave={e => e.target.style.borderColor = 'var(--c-border)'}>
                      {generating === sub.key ? '撰寫中 ...' : ch ? '重新撰寫' : 'AI 撰寫'}
                    </button>
                    <span style={{
                      fontSize: 12, color: 'var(--c-text-muted)',
                      transform: isExpanded ? 'rotate(180deg)' : 'none',
                      transition: '0.2s', display: 'inline-block',
                    }}>▾</span>
                  </div>
                </div>

                {/* ── 展開：已生成 ── */}
                {isExpanded && ch && (
                  <div style={{
                    padding: '8px 28px 32px',
                    borderTop: '1px solid var(--c-border)',
                    background: 'linear-gradient(180deg, rgba(99,102,241,0.008), transparent 200px)',
                  }}>
                    {ch.chapter_intro && (
                      <p style={{
                        fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.9,
                        margin: '20px 0 0', padding: '16px 20px',
                        background: 'var(--c-bg-warm)', borderRadius: 10,
                      }}>
                        {ch.chapter_intro}
                      </p>
                    )}

                    {/* 活動設計 */}
                    {ch.activity_items?.length > 0 && (
                      <Section title="活動設計" subtitle={`共 ${ch.activity_items.length} 項`}>
                        {ch.activity_items.map((item, j) => {
                          const chatKey = `writing:${item.item_name}`;
                          const isChatOpen = chatOpen === chatKey;
                          const chatMsgs = chatHistories[chatKey] || [];
                          const itemCtx = `${item.item_name}: ${item.description || ''} ${item.rules || ''}`;
                          return (
                          <div key={j} style={{
                            background: 'white', borderRadius: 14, padding: '20px 24px', marginBottom: 10,
                            border: `1px solid ${isChatOpen ? 'rgba(236,72,153,0.2)' : 'var(--c-border)'}`,
                            transition: 'border-color 0.2s',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                              <span style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: 'var(--c-primary)', color: 'white',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, flexShrink: 0,
                              }}>{j + 1}</span>
                              <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>{item.item_name}</span>
                              <button
                                onClick={() => { setChatOpen(isChatOpen ? null : chatKey); setChatInput(''); }}
                                style={{
                                  padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                  border: `1px solid ${isChatOpen ? '#ec4899' : 'var(--c-border)'}`,
                                  background: isChatOpen ? 'rgba(236,72,153,0.06)' : 'white',
                                  color: isChatOpen ? '#ec4899' : 'var(--c-text-muted)',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                {isChatOpen ? '收起' : '問更多'}
                              </button>
                            </div>
                            <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--c-text-secondary)', margin: '0 0 8px 42px' }}>
                              {item.description}
                            </p>
                            <div style={{ marginLeft: 42, display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {item.rules && <div style={{ fontSize: 12, color: '#475569' }}><strong style={{ color: '#1a1a2e' }}>規則</strong>　{item.rules}</div>}
                              {item.props_list?.length > 0 && <div style={{ fontSize: 12, color: '#475569' }}><strong style={{ color: '#1a1a2e' }}>道具</strong>　{item.props_list.join('、')}</div>}
                              {item.space_requirement && <div style={{ fontSize: 12, color: '#475569' }}><strong style={{ color: '#1a1a2e' }}>空間</strong>　{item.space_requirement}</div>}
                              {item.staff && <div style={{ fontSize: 12, color: '#475569' }}><strong style={{ color: '#1a1a2e' }}>人力</strong>　{item.staff}</div>}
                            </div>
                            {item.core_message && (
                              <div style={{
                                marginTop: 12, marginLeft: 42, padding: '8px 16px', borderRadius: 8,
                                background: 'linear-gradient(135deg, #fef9c3, #fde68a)',
                                fontSize: 13, fontWeight: 600, display: 'inline-block',
                              }}>
                                傳達理念：{item.core_message}
                              </div>
                            )}
                            {/* 模擬圖按鈕 */}
                            <div style={{ marginTop: 12, marginLeft: 42 }}>
                              {!simImages[item.item_name]?.url && (
                                <button
                                  onClick={() => generateSimImage(item.item_name, item.description)}
                                  disabled={simImages[item.item_name]?.loading}
                                  style={{
                                    padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    border: '1px dashed rgba(139,92,246,0.3)',
                                    background: 'rgba(139,92,246,0.03)', color: '#8b5cf6',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                  }}>
                                  {simImages[item.item_name]?.loading ? '生成中...' : '一鍵產出模擬圖'}
                                </button>
                              )}
                              {simImages[item.item_name]?.error && (
                                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                                  生成失敗：{simImages[item.item_name].error}
                                </div>
                              )}
                              {simImages[item.item_name]?.url && (
                                <div style={{
                                  marginTop: 8, borderRadius: 12, overflow: 'hidden',
                                  border: '1px solid var(--c-border)',
                                }}>
                                  <img
                                    src={simImages[item.item_name].url}
                                    alt={`${item.item_name} 模擬圖`}
                                    style={{ width: '100%', height: 'auto', display: 'block' }}
                                  />
                                  <div style={{
                                    padding: '8px 14px', fontSize: 11, color: 'var(--c-text-muted)',
                                    background: 'var(--c-bg-warm)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  }}>
                                    <span>
                                      {simImages[item.item_name].provider === 'dall-e-3' ? 'DALL-E 3 生成' : 'Placeholder 模擬圖'}
                                    </span>
                                    <button
                                      onClick={() => generateSimImage(item.item_name, item.description)}
                                      style={{
                                        padding: '3px 10px', borderRadius: 4, fontSize: 10,
                                        border: '1px solid var(--c-border)', background: 'white',
                                        cursor: 'pointer', color: 'var(--c-text-muted)',
                                      }}>
                                      重新生成
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* AI 追問 */}
                            {isChatOpen && (
                              <div style={{
                                marginTop: 12, marginLeft: 42, padding: '12px 14px', borderRadius: 8,
                                background: 'linear-gradient(135deg, rgba(236,72,153,0.02), rgba(139,92,246,0.02))',
                                border: '1px solid rgba(236,72,153,0.1)',
                              }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#ec4899', marginBottom: 8 }}>AI 追問 — {item.item_name}</div>
                                {chatMsgs.length > 0 && (
                                  <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {chatMsgs.map((msg, mi) => (
                                      <div key={mi} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.7, background: msg.role === 'user' ? 'rgba(139,92,246,0.06)' : 'white', borderLeft: msg.role === 'user' ? '3px solid #8b5cf6' : '3px solid #10b981' }}>
                                        <div style={{ fontSize: 10, fontWeight: 600, color: msg.role === 'user' ? '#8b5cf6' : '#059669', marginBottom: 2 }}>{msg.role === 'user' ? '你' : 'AI'}</div>
                                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                      </div>
                                    ))}
                                    {chatLoading && <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--c-text-muted)', fontStyle: 'italic' }}>AI 思考中...</div>}
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiChat(sub.key, item.item_name, itemCtx); } }}
                                    placeholder="例：有沒有推薦的片單？" style={{ flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12, border: '1px solid var(--c-border)', outline: 'none' }} />
                                  <button onClick={() => handleAiChat(sub.key, item.item_name, itemCtx)} disabled={chatLoading || !chatInput.trim()}
                                    style={{ padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', background: '#ec4899', color: 'white', cursor: 'pointer', opacity: chatLoading || !chatInput.trim() ? 0.5 : 1 }}>發送</button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </Section>
                    )}

                    {/* 流程表 */}
                    {ch.suggested_timeline?.length > 0 && (
                      <Section title="活動流程">
                        <DataTable
                          headers={['時段', '內容', '備註']}
                          rows={ch.suggested_timeline.map(t => [t.time, t.content, t.note || ''])}
                        />
                      </Section>
                    )}

                    {/* 禮品 */}
                    {ch.reward_plan?.rewards?.length > 0 && (
                      <Section title="獎品兌換">
                        {ch.reward_plan.participation_rule && (
                          <p style={{
                            fontSize: 13, marginBottom: 12, padding: '10px 16px',
                            background: 'var(--c-bg-warm)', borderRadius: 8,
                          }}>
                            {ch.reward_plan.participation_rule}
                          </p>
                        )}
                        <DataTable
                          headers={['品名', '材質', '尺寸', '數量', '估價']}
                          rows={ch.reward_plan.rewards.map(r => [r.item_name, r.material, r.size, r.quantity, r.estimated_price])}
                        />
                      </Section>
                    )}

                    {/* 硬體 */}
                    {ch.hardware_list?.length > 0 && (
                      <Section title="硬體需求" subtitle={`${ch.hardware_list.length} 項`}>
                        <DataTable
                          headers={['品項', '規格', '數量', '用途']}
                          rows={ch.hardware_list.map(h => [h.item, h.spec, h.quantity, h.purpose])}
                        />
                      </Section>
                    )}

                    {/* 人力 */}
                    {ch.staff_plan?.length > 0 && (
                      <Section title="人力配置" subtitle={`${ch.staff_plan.reduce((s, p) => s + Number(p.count || 0), 0)} 人`}>
                        <DataTable
                          headers={['角色', '人數', '職責']}
                          rows={ch.staff_plan.map(s => [s.role, s.count, s.duty])}
                        />
                      </Section>
                    )}

                    {/* 預算 */}
                    {ch.budget_detail?.length > 0 && (
                      <Section title="預算明細">
                        <DataTable
                          headers={['項目', '單位', '數量', '單價', '小計']}
                          rows={ch.budget_detail.map(b => [b.item, b.unit, b.quantity, b.unit_price, b.subtotal])}
                        />
                      </Section>
                    )}

                    {/* 推薦資源 */}
                    {ch.recommended_vendors?.length > 0 && (
                      <Section title="推薦資源">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                          {ch.recommended_vendors.map((v, j) => (
                            <div key={j} style={{
                              padding: '14px 18px', borderRadius: 10,
                              border: '1px solid var(--c-border)', fontSize: 13,
                            }}>
                              <div style={{ fontWeight: 600, marginBottom: 4 }}>{v.category}</div>
                              {v.vendor_type && <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{v.vendor_type}</div>}
                              {v.search_keyword && <div style={{ marginTop: 6 }}><GoogleLink keyword={v.search_keyword} /></div>}
                              {v.price_range && <div style={{ fontSize: 12, color: '#059669', marginTop: 4 }}>{v.price_range}</div>}
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* 參考案例 */}
                    {ch.reference_cases?.length > 0 && (
                      <Section title="參考案例">
                        {ch.reference_cases.map((r, j) => (
                          <div key={j} style={{
                            padding: '14px 18px', marginBottom: 8, borderRadius: 10,
                            border: '1px solid var(--c-border)', fontSize: 13,
                          }}>
                            <div style={{ fontWeight: 600 }}>{r.case_name}
                              {r.organizer && <span style={{ fontWeight: 400, color: 'var(--c-text-muted)' }}> — {r.organizer}</span>}
                            </div>
                            {r.highlight && <div style={{ marginTop: 4, color: 'var(--c-text-secondary)', fontSize: 12 }}>{r.highlight}</div>}
                            {r.search_keyword && <div style={{ marginTop: 6 }}><GoogleLink keyword={r.search_keyword} /></div>}
                          </div>
                        ))}
                      </Section>
                    )}

                    {/* 注意事項 */}
                    {(ch.risk_notes || ch.weather_backup) && (
                      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ch.risk_notes && (
                          <div style={{
                            padding: '14px 18px', borderRadius: 10,
                            background: 'rgba(239,68,68,0.03)', borderLeft: '3px solid #ef4444', fontSize: 13,
                          }}>
                            <strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#ef4444' }}>注意事項</strong>
                            {ch.risk_notes}
                          </div>
                        )}
                        {ch.weather_backup && (
                          <div style={{
                            padding: '14px 18px', borderRadius: 10,
                            background: 'rgba(59,130,246,0.03)', borderLeft: '3px solid #3b82f6', fontSize: 13,
                          }}>
                            <strong style={{ display: 'block', marginBottom: 4, fontSize: 12, color: '#3b82f6' }}>雨備方案</strong>
                            {ch.weather_backup}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── 展開：尚未撰寫 ── */}
                {isExpanded && !ch && (
                  <div style={{
                    padding: '48px 28px', textAlign: 'center',
                    borderTop: '1px solid var(--c-border)', background: 'var(--c-bg-warm)',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>尚未撰寫此章節</div>
                    <p style={{ color: 'var(--c-text-muted)', fontSize: 13, marginBottom: 20 }}>AI 將為您生成完整的企劃內容</p>
                    <button onClick={() => generateChapter(sub.key)}
                      disabled={generating === sub.key}
                      style={{
                        padding: '14px 32px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                        border: 'none', background: 'var(--c-primary)', color: 'white', cursor: 'pointer',
                      }}>
                      {generating === sub.key ? '撰寫中 ...' : '開始 AI 撰寫'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 評選標準儀表板 ── */}
      {evalCriteria.length > 0 && (
        <div className="card" style={{
          marginTop: 24, marginBottom: 20, padding: '24px 28px',
          borderLeft: '4px solid #f59e0b',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.02), rgba(99,102,241,0.02))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#b45309' }}>評選標準配分指引</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
                撰寫企劃書時，請依照以下配分比重分配內容深度
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {evalCriteria
              .sort((a, b) => (b.weight || 0) - (a.weight || 0))
              .map((c, i) => {
                const weight = c.weight || 0;
                const barColor = weight >= 25 ? '#ef4444' : weight >= 20 ? '#f59e0b' : weight >= 10 ? '#6366f1' : '#94a3b8';
                return (
                  <div key={i} style={{
                    padding: '10px 14px', borderRadius: 10, background: 'white',
                    border: '1px solid var(--c-border)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>
                        {c.item_name || c.item || c.name || `項目 ${i + 1}`}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: 800, color: barColor,
                        minWidth: 50, textAlign: 'right',
                      }}>
                        {weight}%
                      </div>
                    </div>
                    <div style={{
                      height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.04)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: barColor,
                        width: `${Math.min(weight * 3.3, 100)}%`,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    {(c.focus || c.description) && (
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                        {c.focus || c.description}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'plan-summary', label: '企劃書架構' }}
        next={{ path: 'venue-sim', label: '前往場地模擬' }}
        nextDisabled={selectedSubs.length === 0} />
    </>
  );
}

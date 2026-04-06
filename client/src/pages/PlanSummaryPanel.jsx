import { useState, useEffect } from 'react'
import { api } from '../api'
import StepNav from '../components/StepNav'

// 工具函式：搜尋關鍵字 → Google 搜尋連結
const GoogleLink = ({ keyword }) => (
  <a href={`https://www.google.com/search?q=${encodeURIComponent(keyword)}`}
    target="_blank" rel="noopener noreferrer"
    style={{ color: 'var(--c-primary)', textDecoration: 'none', cursor: 'pointer' }}
    onMouseEnter={e => e.target.style.textDecoration = 'underline'}
    onMouseLeave={e => e.target.style.textDecoration = 'none'}>
    搜尋：「{keyword}」↗
  </a>
);

export default function PlanSummaryPanel({ projectId, project }) {
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [suggestions, setSuggestions] = useState({});
  const [loadingSuggestion, setLoadingSuggestion] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  // 逐項確認 state — Slide 9
  const [confirmedItems, setConfirmedItems] = useState(new Set());
  // 評審對應 state — Slide 7
  const [criteriaMapping, setCriteriaMapping] = useState({});
  const [evaluationCriteria, setEvaluationCriteria] = useState([]);
  // AI 模擬圖 state — Slide 12
  const [simImages, setSimImages] = useState({});
  const [generatingImage, setGeneratingImage] = useState(null);
  // AI 追問對話 state
  const [chatOpen, setChatOpen] = useState(null);
  const [chatHistories, setChatHistories] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  // 首次載入標記（避免自動儲存觸發）
  const [initialized, setInitialized] = useState(false);

  // 逐項確認/解鎖
  const toggleConfirmItem = (subKey) => {
    setConfirmedItems(prev => {
      const next = new Set(prev);
      if (next.has(subKey)) next.delete(subKey);
      else next.add(subKey);
      return next;
    });
  };

  // AI 追問處理
  const handleAiChat = async (subKey, itemName, context) => {
    if (!chatInput.trim()) return;
    const chatKey = `${subKey}:${itemName}`;
    const question = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    const history = chatHistories[chatKey] || [];
    const newHistory = [...history, { role: 'user', content: question }];
    setChatHistories(prev => ({ ...prev, [chatKey]: newHistory }));

    try {
      const result = await api.aiFollowUp(projectId, {
        context, subActivityName: itemName, question,
        history: history,
      });
      setChatHistories(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), { role: 'assistant', content: result.answer }],
      }));
    } catch (err) {
      setChatHistories(prev => ({
        ...prev,
        [chatKey]: [...(prev[chatKey] || []), { role: 'assistant', content: '抱歉，AI 回覆失敗: ' + err.message }],
      }));
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.getSelectedSubActivities(projectId).catch(() => ({ items: [] })),
      api.getHighlights(projectId).catch(() => []),
      api.getPlanSummary(projectId).catch(() => null),
      api.getEvaluationCriteria(projectId).catch(() => []),
    ]).then(([subsData, hlData, summaryData, criteriaData]) => {
      setSelectedSubs(subsData?.items || []);
      setHighlights(hlData?.filter(h => h.is_selected) || []);
      if (summaryData?.suggestions) {
        setSuggestions(summaryData.suggestions);
        setConfirmed(summaryData.confirmed || false);
      }
      // 載入已確認項目
      if (summaryData?.confirmed_items) {
        try { setConfirmedItems(new Set(JSON.parse(summaryData.confirmed_items))); } catch {}
      }
      // 載入評審對應
      if (summaryData?.criteria_mapping) {
        try { setCriteriaMapping(JSON.parse(summaryData.criteria_mapping)); } catch {}
      }
      // 載入評選標準
      if (criteriaData?.length > 0) {
        setEvaluationCriteria(criteriaData);
      } else if (summaryData?.suggestions) {
        // fallback: 嘗試從 analysis 取得
        api.getAnalysis(projectId).then(data => {
          if (data?.analysis_json?.evaluationCriteria) {
            setEvaluationCriteria(data.analysis_json.evaluationCriteria.map(c => ({
              item_name: c.item, weight: c.weight, description: c.key_focus || '',
            })));
          }
        }).catch(() => {});
      }
      setTimeout(() => setInitialized(true), 500);
    }).finally(() => setLoading(false));
  }, [projectId]);

  // 3A: 自動儲存確認狀態
  useEffect(() => {
    if (!initialized) return;
    const timer = setTimeout(() => {
      api.saveConfirmedItems(projectId, [...confirmedItems], criteriaMapping).catch(console.error);
    }, 600);
    return () => clearTimeout(timer);
  }, [confirmedItems, criteriaMapping, initialized]);

  // 3C: 生成 AI 模擬圖
  const generateSimImage = async (subKey, name, description) => {
    setGeneratingImage(subKey);
    try {
      const result = await api.generateSimImage(projectId, {
        activity_name: name,
        description: description || '',
        style: 'illustration',
      });
      if (result.image_url) {
        setSimImages(prev => ({ ...prev, [subKey]: result.image_url }));
      }
    } catch (err) {
      alert('模擬圖生成失敗: ' + err.message);
    } finally {
      setGeneratingImage(null);
    }
  };

  const getAiSuggestion = async (subKey) => {
    setLoadingSuggestion(subKey);
    try {
      const result = await api.getAiSuggestion(projectId, encodeURIComponent(subKey));
      setSuggestions(prev => ({ ...prev, [subKey]: result.suggestion }));
    } catch (err) {
      alert('取得建議失敗: ' + err.message);
    } finally {
      setLoadingSuggestion(null);
    }
  };

  const getAllSuggestions = async () => {
    for (const sub of selectedSubs) {
      if (!suggestions[sub.key]) {
        setLoadingSuggestion(sub.key);
        try {
          const result = await api.getAiSuggestion(projectId, encodeURIComponent(sub.key));
          setSuggestions(prev => ({ ...prev, [sub.key]: result.suggestion }));
        } catch (err) {
          console.error('建議失敗:', sub.name, err);
        }
      }
    }
    setLoadingSuggestion(null);
  };

  const confirmPlan = async () => {
    try {
      await api.generatePlanSummary(projectId);
      setConfirmed(true);
      alert('企劃架構已確認！');
    } catch (err) {
      alert('確認失敗：' + err.message);
    }
  };

  // 確認單項並儲存
  const confirmedCount = confirmedItems.size;
  const totalCount = selectedSubs.length;

  // 匯出企劃架構為 HTML 檔案
  const exportPlan = () => {
    const now = new Date().toLocaleDateString('zh-TW');
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${project?.name || '企劃架構'} — AI執行建議</title>
<style>
body{font-family:'Microsoft JhengHei',sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#333;line-height:1.8}
h1{color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:10px}
h2{color:#6366f1;margin-top:30px;padding:8px 12px;background:#f0f0ff;border-radius:8px}
h3{color:#059669}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:12px 0}
.item{background:#fafafe;border-left:3px solid #6366f1;padding:10px 14px;margin:8px 0;border-radius:0 8px 8px 0}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left;font-size:13px}
th{background:#f8f8ff}
.warn{background:#fff5f5;border-left:3px solid #ef4444;padding:8px 12px;border-radius:0 8px 8px 0;margin:8px 0}
.footer{margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#999}
</style></head><body>
<h1>${project?.name || '專案'} — 企劃架構總表</h1>
<p>匯出日期：${now} ｜ 子活動：${selectedSubs.length} 個 ｜ 亮點：${highlights.length} 個</p>\n`;

    selectedSubs.forEach((sub, i) => {
      html += `<h2>${i + 1}. ${sub.name}</h2>\n`;
      html += `<p>${sub.description || ''}</p>\n`;
      if (sub.effect) html += `<p>預期：${sub.effect}</p>\n`;

      const s = suggestions[sub.key];
      if (!s || typeof s === 'string') {
        if (s) html += `<div class="card">${s}</div>\n`;
        return;
      }

      if (s.execution_direction) html += `<h3>執行方向</h3><p>${s.execution_direction}</p>\n`;

      if (s.program_content) {
        html += `<h3>企劃撰寫內容</h3>\n`;
        if (s.program_content.概述) html += `<p>${s.program_content.概述}</p>\n`;
        (s.program_content.具體項目 || []).forEach((item, j) => {
          html += `<div class="item"><strong>${j+1}. ${item.項目名稱}</strong><br>\n`;
          if (item.內容說明) html += `${item.內容說明}<br>\n`;
          if (item.遊戲規則或流程) html += `規則：${item.遊戲規則或流程}<br>\n`;
          if (item.所需設備) html += `設備：${item.所需設備}<br>\n`;
          if (item.人力配置) html += `人力：${item.人力配置}\n`;
          html += `</div>\n`;
        });
      }

      if (s.recommended_resources?.length) {
        html += `<h3>推薦資源</h3>\n`;
        s.recommended_resources.forEach(r => {
          if (typeof r === 'string') { html += `<p>• ${r}</p>\n`; return; }
          html += `<div class="card"><strong>${r.類別}</strong>${r.推薦廠商類型 ? ' — ' + r.推薦廠商類型 : ''}\n`;
          if (r.搜尋關鍵字) html += `<br>搜尋：<a href="https://www.google.com/search?q=${encodeURIComponent(r.搜尋關鍵字)}">${r.搜尋關鍵字}</a>\n`;
          if (r.預估單價範圍) html += `<br>行情：${r.預估單價範圍}\n`;
          html += `</div>\n`;
        });
      }

      if (s.reference_cases?.length) {
        html += `<h3>參考案例</h3>\n`;
        s.reference_cases.forEach(r => {
          if (typeof r === 'string') { html += `<p>• ${r}</p>\n`; return; }
          html += `<div class="card"><strong>${r.案例名稱}</strong>${r.舉辦單位 ? ' — ' + r.舉辦單位 : ''}\n`;
          if (r.亮點說明) html += `<br>${r.亮點說明}\n`;
          if (r.搜尋關鍵字) html += `<br><a href="https://www.google.com/search?q=${encodeURIComponent(r.搜尋關鍵字)}">${r.搜尋關鍵字}</a>\n`;
          html += `</div>\n`;
        });
      }

      if (s.budget_breakdown) {
        html += `<h3>預算估算</h3>\n`;
        if (s.budget_breakdown.總預估) html += `<p><strong>${s.budget_breakdown.總預估}</strong></p>\n`;
        if (s.budget_breakdown.明細?.length) {
          html += `<table><tr><th>項目</th><th>數量</th><th>單價範圍</th><th>小計範圍</th></tr>\n`;
          s.budget_breakdown.明細.forEach(row => {
            html += `<tr><td>${row.項目}</td><td>${row.數量}</td><td>${row.單價範圍}</td><td>${row.小計範圍}</td></tr>\n`;
          });
          html += `</table>\n`;
        }
        if (s.budget_breakdown.說明) html += `<p style="color:#999;font-size:12px">ⓘ ${s.budget_breakdown.說明}</p>\n`;
      }

      if (s.timeline_suggestion) html += `<h3>時程建議</h3><p>${s.timeline_suggestion}</p>\n`;
      if (s.key_notes) html += `<div class="warn">${s.key_notes}</div>\n`;
    });

    if (highlights.length) {
      html += `<h2>企劃亮點</h2>\n`;
      highlights.forEach(h => {
        html += `<p><strong>${h.title}</strong>${h.description ? ' — ' + h.description : ''}</p>\n`;
      });
    }

    html += `<div class="footer">由 WDMC AI賦能系統 自動生成 ｜ ${now}</div></body></html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || '企劃架構'}_AI執行建議.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loader-container"><div className="loader" /></div>;

  const isTender = project?.case_type !== 'commercial';

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">企劃書架構</h1>
          <p className="page-subtitle">
            基於您選取的 {selectedSubs.length} 個子活動，組成企劃書架構
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={getAllSuggestions}
            disabled={loadingSuggestion !== null}>
            {loadingSuggestion ? '⏳ AI 分析中...' : '全部 AI 執行建議'}
          </button>
          {Object.keys(suggestions).length > 0 && (
            <button className="btn btn-secondary" onClick={exportPlan}>
              匯出企劃書
            </button>
          )}
          <button className="btn btn-primary" onClick={confirmPlan} disabled={confirmed}>
            {confirmed ? '已確認' : '確認架構'}
          </button>
        </div>
      </div>

      {selectedSubs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">尚未選取子活動</div>
          <p>請先前往「主題策略」，從 AI 生成的主題方案中勾選子活動架構</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 架構總覽 */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>架構總覽</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {selectedSubs.map(sub => {
                const isItemConfirmed = confirmedItems.has(sub.key);
                return (
                  <span key={sub.key} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: isItemConfirmed ? 'rgba(16,185,129,0.1)' : `${sub.color}12`,
                    color: isItemConfirmed ? '#059669' : sub.color,
                    border: `1px solid ${isItemConfirmed ? 'rgba(16,185,129,0.3)' : sub.color + '30'}`,
                    transition: 'all 0.2s',
                  }}>
                    {isItemConfirmed && '✓ '}{sub.name}
                  </span>
                );
              })}
            </div>
            {confirmedCount > 0 && (
              <div style={{ fontSize: 12, color: '#059669', marginTop: 8, fontWeight: 600 }}>
                已確認 {confirmedCount}/{totalCount} 項
              </div>
            )}
          </div>

          {/* 子活動詳細卡片 */}
          {selectedSubs.map((sub, i) => (
            <div key={sub.key} className="card" style={{
              borderLeft: confirmedItems.has(sub.key) ? '4px solid #059669' : `4px solid ${sub.color}`,
              padding: '20px 24px',
              background: confirmedItems.has(sub.key) ? 'rgba(16,185,129,0.02)' : undefined,
              transition: 'all 0.3s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: confirmedItems.has(sub.key) ? '#059669' : sub.color,
                    }} />
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{sub.name}</h3>
                    {confirmedItems.has(sub.key) && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
                        background: 'rgba(16,185,129,0.1)', color: '#059669',
                      }}>已確認</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--c-text-muted)', lineHeight: 1.6, marginBottom: 4 }}>
                    {sub.description}
                  </p>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                    來自：{sub.themeTitle}
                  </div>
                  {sub.effect && (
                    <div style={{ fontSize: 12, color: 'var(--c-accent)', marginTop: 4 }}>{sub.effect}</div>
                  )}
                  {/* 3B: 評審對應下拉選單 */}
                  {evaluationCriteria.length > 0 && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>對應評分項：</span>
                      <select
                        value={criteriaMapping[sub.key] || ''}
                        onChange={e => setCriteriaMapping(prev => ({ ...prev, [sub.key]: e.target.value }))}
                        style={{
                          fontSize: 12, padding: '4px 10px', borderRadius: 8,
                          border: '1px solid var(--c-border)', background: 'white',
                          color: criteriaMapping[sub.key] ? 'var(--c-primary)' : 'var(--c-text-muted)',
                          cursor: 'pointer', minWidth: 160,
                        }}>
                        <option value="">-- 選擇評選項目 --</option>
                        {evaluationCriteria.map((c, ci) => (
                          <option key={ci} value={c.item_name || c.item}>
                            {c.item_name || c.item}（{c.weight}%）
                          </option>
                        ))}
                      </select>
                      {criteriaMapping[sub.key] && (
                        <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>✓ 已對應</span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => getAiSuggestion(sub.key)}
                      disabled={loadingSuggestion === sub.key}>
                      {loadingSuggestion === sub.key ? '...' : suggestions[sub.key] ? '重新建議' : 'AI 建議'}
                    </button>
                    <button className="btn btn-secondary btn-sm"
                      onClick={() => generateSimImage(sub.key, sub.name, sub.description)}
                      disabled={generatingImage === sub.key}
                      style={{ color: '#8b5cf6', borderColor: 'rgba(139,92,246,0.3)' }}>
                      {generatingImage === sub.key ? '生成中...' : simImages[sub.key] ? '重新模擬' : 'AI 模擬圖'}
                    </button>
                  </div>
                  <button
                    onClick={() => toggleConfirmItem(sub.key)}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      border: confirmedItems.has(sub.key) ? '1px solid #059669' : '1px solid var(--c-border)',
                      background: confirmedItems.has(sub.key) ? 'rgba(16,185,129,0.08)' : 'white',
                      color: confirmedItems.has(sub.key) ? '#059669' : 'var(--c-text-muted)',
                      cursor: 'pointer', transition: 'all 0.2s',
                    }}>
                    {confirmedItems.has(sub.key) ? '✓ 已確認' : '確認此項目'}
                  </button>
                </div>
              </div>

              {/* 3C: AI 模擬圖預覽 */}
              {simImages[sub.key] && (
                <div style={{
                  marginTop: 12, borderRadius: 12, overflow: 'hidden',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', padding: '8px 14px', background: 'rgba(139,92,246,0.04)' }}>
                    AI 活動模擬圖
                  </div>
                  <img src={simImages[sub.key]} alt={sub.name}
                    style={{ width: '100%', maxHeight: 300, objectFit: 'cover', display: 'block' }} />
                </div>
              )}

              {/* AI 執行建議 */}
              {suggestions[sub.key] && (
                <div style={{
                  marginTop: 16, padding: '16px 20px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(16,185,129,0.03))',
                  borderRadius: 12, border: '1px solid rgba(99,102,241,0.1)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 10 }}>
                    AI 執行建議
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--c-text-secondary)' }}>
                    {typeof suggestions[sub.key] === 'string' ? (
                      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                        {suggestions[sub.key]}
                      </pre>
                    ) : (
                      <>
                        {/* 執行方向 */}
                        {suggestions[sub.key].execution_direction && (
                          <div style={{ marginBottom: 12 }}>
                            <strong>執行方向：</strong>
                            <p style={{ margin: '2px 0' }}>{suggestions[sub.key].execution_direction}</p>
                          </div>
                        )}

                        {/* 企劃撰寫內容 */}
                        {suggestions[sub.key].program_content && (
                          <div style={{ marginBottom: 12, padding: '12px 16px', background: 'rgba(99,102,241,0.03)', borderRadius: 10 }}>
                            <strong style={{ color: 'var(--c-primary)' }}>企劃撰寫內容：</strong>
                            {suggestions[sub.key].program_content.概述 && (
                              <p style={{ margin: '4px 0 8px', fontSize: 12, color: 'var(--c-text-muted)' }}>
                                {suggestions[sub.key].program_content.概述}
                              </p>
                            )}
                            {suggestions[sub.key].program_content.具體項目?.map((item, j) => {
                              const chatKey = `${sub.key}:${item.項目名稱}`;
                              const isChatOpen = chatOpen === chatKey;
                              const chatMsgs = chatHistories[chatKey] || [];
                              const itemContext = `${item.項目名稱}: ${item.內容說明 || ''} ${item.遊戲規則或流程 || ''} ${item.所需設備 || ''} ${item.人力配置 || ''}`;
                              return (
                              <div key={j} style={{
                                marginTop: 8, padding: '10px 14px', background: 'white', borderRadius: 8,
                                borderLeft: `3px solid ${isChatOpen ? '#ec4899' : 'var(--c-primary)'}`,
                                transition: 'border-color 0.2s',
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                                      {j + 1}. {item.項目名稱}
                                    </div>
                                    {item.內容說明 && <div style={{ fontSize: 12 }}>{item.內容說明}</div>}
                                    {item.遊戲規則或流程 && <div style={{ fontSize: 12, color: '#059669' }}>規則：{item.遊戲規則或流程}</div>}
                                    {item.所需設備 && <div style={{ fontSize: 12, color: '#0284c7' }}>設備：{item.所需設備}</div>}
                                    {item.人力配置 && <div style={{ fontSize: 12, color: '#8b5cf6' }}>人力：{item.人力配置}</div>}
                                  </div>
                                  <button
                                    onClick={() => { setChatOpen(isChatOpen ? null : chatKey); setChatInput(''); }}
                                    style={{
                                      padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                      border: `1px solid ${isChatOpen ? '#ec4899' : 'var(--c-border)'}`,
                                      background: isChatOpen ? 'rgba(236,72,153,0.06)' : 'white',
                                      color: isChatOpen ? '#ec4899' : 'var(--c-text-muted)',
                                      cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, marginLeft: 8,
                                    }}>
                                    {isChatOpen ? '收起' : '問更多'}
                                  </button>
                                </div>

                                {/* AI 追問對話區 */}
                                {isChatOpen && (
                                  <div style={{
                                    marginTop: 10, padding: '12px 14px', borderRadius: 8,
                                    background: 'linear-gradient(135deg, rgba(236,72,153,0.02), rgba(139,92,246,0.02))',
                                    border: '1px solid rgba(236,72,153,0.1)',
                                  }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: '#ec4899', marginBottom: 8 }}>
                                      AI 追問 — {item.項目名稱}
                                    </div>
                                    {/* 對話記錄 */}
                                    {chatMsgs.length > 0 && (
                                      <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {chatMsgs.map((msg, mi) => (
                                          <div key={mi} style={{
                                            padding: '8px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
                                            background: msg.role === 'user' ? 'rgba(139,92,246,0.06)' : 'white',
                                            borderLeft: msg.role === 'user' ? '3px solid #8b5cf6' : '3px solid #10b981',
                                          }}>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: msg.role === 'user' ? '#8b5cf6' : '#059669', marginBottom: 2 }}>
                                              {msg.role === 'user' ? '你' : 'AI'}
                                            </div>
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                          </div>
                                        ))}
                                        {chatLoading && (
                                          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--c-text-muted)', fontStyle: 'italic' }}>
                                            AI 思考中...
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {/* 輸入框 */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <input
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiChat(sub.key, item.項目名稱, itemContext); }}}
                                        placeholder="例：有沒有推薦的片單？有推薦的攤販嗎？"
                                        style={{
                                          flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                                          border: '1px solid var(--c-border)', outline: 'none',
                                        }}
                                      />
                                      <button
                                        onClick={() => handleAiChat(sub.key, item.項目名稱, itemContext)}
                                        disabled={chatLoading || !chatInput.trim()}
                                        style={{
                                          padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                          border: 'none', background: '#ec4899', color: 'white', cursor: 'pointer',
                                          opacity: chatLoading || !chatInput.trim() ? 0.5 : 1,
                                        }}>
                                        發送
                                      </button>
                                    </div>
                                    {chatMsgs.length === 0 && (
                                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 6 }}>
                                        針對「{item.項目名稱}」向 AI 追問更具體的內容，例如推薦資源、細節規劃等
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 推薦資源 — 隱藏，客戶回饋 Slide 10 */}

                        {/* 參考案例 — 隱藏，客戶回饋 Slide 10 */}

                        {/* 預算明細 — 隱藏，客戶回饋 Slide 10 */}

                        {/* 時程建議 — 隱藏，客戶回饋 Slide 10 */}

                        {/* 注意事項 */}
                        {suggestions[sub.key].key_notes && (
                          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.03)', borderRadius: 8, borderLeft: '3px solid var(--c-danger)' }}>
                            <strong>注意事項：</strong>
                            <p style={{ margin: '2px 0', fontSize: 12 }}>{suggestions[sub.key].key_notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 亮點列表 — 隱藏，客戶回饋 Slide 11 */}
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'themes', label: '主題包裝' }}
        next={{ path: 'writing', label: '前往架構總表' }}
        nextDisabled={selectedSubs.length === 0} />
    </>
  );
}

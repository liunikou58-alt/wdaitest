import { useState, useRef, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'

const LAYER_COLORS = { 1: '#8b5cf6', 2: '#8b5cf6', 3: '#8b5cf6' };
const LAYER_LABELS = { 1: 'Gemini 2.5 Flash' };

const QUICK_ACTIONS = [
  { text: '分析最新標案公告，找出適合我們的案子', task: 'match' },
  { text: '幫我寫午時水活動的執行計畫大綱', task: 'proposal' },
  { text: '估算 500 人戶外活動的成本', task: 'analyze' },
  { text: '產生投標檢核清單', task: 'analyze' },
  { text: '建議 3 個活動主題方向', task: 'strategy' },
  { text: '比較我們和競品的優劣勢', task: 'compete' },
];

function ModelBadge({ model, layer }) {
  const c = LAYER_COLORS[layer] || '#64748b';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: `${c}12`, color: c, fontSize: 10, fontWeight: 700 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      {LAYER_LABELS[layer] || model}
    </span>
  );
}

export default function AiAssistant() {
  const { t } = useLang();
  const [tab, setTab] = useState('chat');
  const [messages, setMessages] = useState([{ role: 'system', content: '你好！我是 WDMC AI 助手 \n\n我可以幫你：\n• 搜尋和分析標案\n• 撰寫企劃書和執行計畫\n• 估算成本和預算\n• 分析競爭對手\n\n選擇右側的快速指令，或直接告訴我你需要什麼！' }]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [selectedModel, setSelectedModel] = useState('auto');
  const [models, setModels] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    api.getAiModels().then(setModels).catch(() => {});
    api.getAiUsage().then(setUsageStats).catch(() => {});
  }, []);

  const sendMessage = async (text, taskType) => {
    const msg = text || input;
    if (!msg.trim() || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setThinking(true);

    try {
      const modelParam = selectedModel === 'auto' ? undefined : selectedModel;
      const res = await api.aiChat(msg, modelParam, taskType || 'chat');
      setMessages(prev => [...prev, {
        role: 'assistant', content: res.content,
        model: res.model, modelName: res.modelName, layer: res.layer, tokens: res.tokens,
      }]);
      // Refresh usage
      api.getAiUsage().then(setUsageStats).catch(() => {});
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant', content: `AI 回應失敗：${err.message || '請確認 API Key 設定'}`,
        model: 'error', layer: 0,
      }]);
    } finally { setThinking(false); }
  };

  const TABS = [
    { key: 'chat', label: 'AI 對話' },
    { key: 'guide', label: '系統說明' },
  ];

  return (
    <div className="animate-fadeUp" style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">{t('ai.title')}</h1>
          <p className="page-subtitle">Gemini 2.5 Flash · 每用戶獨立 API Key · 6 人並行</p>
        </div>
        <div style={{ display: 'flex', gap: 3, background: 'rgba(139,92,246,.04)', borderRadius: 10, padding: 3 }}>
          {TABS.map(tb => (
            <button key={tb.key} onClick={() => setTab(tb.key)} style={{
              padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: tab === tb.key ? 700 : 500,
              background: tab === tb.key ? 'var(--c-primary)' : 'transparent', color: tab === tb.key ? '#fff' : 'var(--c-text-muted)', transition: 'all .2s',
            }}>{tb.label}</button>
          ))}
        </div>
      </div>

      {/* ========= TAB: AI 對話 ========= */}
      {tab === 'chat' && (
        <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
          {/* Chat Area */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '82%' }}>
                    {msg.role === 'assistant' && msg.model && msg.model !== 'error' && (
                      <div style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <ModelBadge model={msg.model} layer={msg.layer} />
                        {msg.tokens > 0 && <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{msg.tokens} tokens</span>}
                      </div>
                    )}
                    <div style={{
                      padding: '12px 16px', borderRadius: 18,
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #8b5cf6, var(--c-primary))' : msg.role === 'system' ? 'rgba(16,185,129,.06)' : 'rgba(139,92,246,0.04)',
                      color: msg.role === 'user' ? '#fff' : 'var(--c-text)',
                      fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap',
                      borderBottomRightRadius: msg.role === 'user' ? 4 : 18,
                      borderBottomLeftRadius: msg.role === 'user' ? 18 : 4,
                      boxShadow: msg.role === 'user' ? '0 2px 8px rgba(139,92,246,0.15)' : 'none',
                      borderLeft: msg.role === 'system' ? '3px solid var(--c-success)' : 'none',
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {thinking && (
                <div style={{ display: 'flex', gap: 6, padding: '12px 16px' }}>
                  {[0, 0.15, 0.3].map((d, i) => (
                    <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--c-primary-light)', animation: `pulse 1s ease ${d}s infinite` }} />
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input + Model Selector */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--c-border)', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'var(--c-text-muted)', lineHeight: '24px' }}>模型：</span>
                {[{ key: 'auto', label: 'Gemini 2.5 Flash', color: '#8b5cf6' }].map(m => (
                  <button key={m.key} onClick={() => setSelectedModel(m.key)} style={{
                    padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${m.color}`,
                    background: `${m.color}10`,
                    color: m.color, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                  }}>{m.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="輸入問題... (Enter 發送)" className="form-input" style={{ borderRadius: 9999, padding: '10px 18px' }} />
                <button onClick={() => sendMessage()} className="btn btn-primary" style={{ borderRadius: 9999, padding: '10px 22px' }} disabled={thinking}>
                  {thinking ? '⏳' : '→'}
                </button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>快速指令</h4>
              {QUICK_ACTIONS.map((a, i) => (
                <button key={i} onClick={() => sendMessage(a.text, a.task)} className="btn btn-secondary" style={{
                  width: '100%', fontSize: 11, padding: '10px 12px', marginBottom: 6,
                  textAlign: 'left', justifyContent: 'flex-start', whiteSpace: 'normal', lineHeight: 1.5, borderRadius: 12,
                }}>{a.text}</button>
              ))}
            </div>

            {/* 使用量面板 */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>AI 使用量</h4>
              {usageStats ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(139,92,246,.04)', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-primary)' }}>{usageStats.totalCalls}</div>
                      <div style={{ fontSize: 9, color: 'var(--c-text-muted)' }}>總呼叫</div>
                    </div>
                    <div style={{ padding: '6px 10px', borderRadius: 8, background: 'rgba(5,150,105,.04)', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>${usageStats.estimatedCostNTD}</div>
                      <div style={{ fontSize: 9, color: 'var(--c-text-muted)' }}>預估費用(NT$)</div>
                    </div>
                  </div>
                  {usageStats.models?.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, borderBottom: '1px solid var(--c-border)' }}>
                      <span style={{ color: LAYER_COLORS[models.find(mm => mm.id === m.id)?.layer] }}>{m.name || m.id}</span>
                      <span>{m.calls} 次</span>
                    </div>
                  ))}
                </>
              ) : <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>載入中...</div>}
            </div>

            {/* API 狀態 */}
            <div className="card" style={{ padding: 16 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>通道狀態</h4>
              {models.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.available ? '#10b981' : '#ef4444' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{m.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--c-text-muted)' }}>L{m.layer} · {m.cost}</div>
                  </div>
                  <span style={{ fontSize: 10, color: m.available ? '#10b981' : '#ef4444' }}>{m.available ? '' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========= TAB: 系統說明 ========= */}
      {tab === 'guide' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
            {/* 架構圖 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Gemini 2.5 Flash 多用戶架構</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 16, padding: '18px 22px', borderRadius: 14, background: 'rgba(139,92,246,.04)', border: '1px solid rgba(139,92,246,.15)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#8b5cf6' }}>Google Gemini 2.5 Flash</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,.1)', color: '#059669', fontWeight: 600 }}>唯一引擎</span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 8, color: 'var(--c-text-muted)' }}>每位用戶擁有獨立 API Key，互不限流。支援 1M token 上下文長度。</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                      {['需求分析', '企劃撰寫', '策略建議', '成本估算', '競爭分析', '簡報設計'].map(u => <span key={u} className="capsule" style={{ background: 'rgba(139,92,246,.1)', color: '#8b5cf6', fontSize: 10 }}>{u}</span>)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>品質：⭐⭐⭐⭐⭐ · 速度：極快 · 費用：付費版</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 多用戶架構 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>6 用戶獨立 Key 架構</h3>
              <div style={{ fontSize: 13, lineHeight: 2.0 }}>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(16,185,129,.04)', borderLeft: '4px solid var(--c-success)', marginBottom: 12 }}>
                  每位用戶登入後，系統自動從 JWT Token 中讀取專屬 Key Index，<strong>直接對應到該用戶的 Gemini API Key</strong>。<br/>
                  6 人同時使用時，各自的 API 配額完全獨立，不會互相搶限額。
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                      {['帳號', 'Key Index', '角色'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['mei', 'Key-1', '經理'],
                      ['Conny', 'Key-2', '資深企劃'],
                      ['Andrea', 'Key-3', '資深設計'],
                      ['Alice', 'Key-4', '企劃人員'],
                      ['ceo', 'Key-5', '執行長'],
                      ['test', 'Key-6', '測試帳號'],
                    ].map(([user, key, role], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{user}</td>
                        <td style={{ padding: '8px 12px', color: '#8b5cf6', fontWeight: 600 }}>{key}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--c-text-muted)' }}>{role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 容錯機制 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>503 指數退避重試</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(16,185,129,.04)', borderLeft: '4px solid var(--c-success)', marginBottom: 12 }}>
                  當 Gemini 回傳 503（高需求）或 429（限流）時，系統會自動重試最多 <strong>5 次</strong>，等待時間依指數增長：<br/>
                  3秒 → 6秒 → 12秒 → 24秒 → 48秒，<strong>絕不降級到其他模型</strong>。
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>資料庫</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>SQLite WAL Mode</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>→ 6 人並發讀寫安全</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>AI 引擎</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Gemini 2.5 Flash 專用</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>→ 6 組獨立 API Key</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 效率預估 */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>效率提升預估</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                    {['工作環節', '人工', 'AI 輔助', '效率提升'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['標案搜尋', '3hr/天', '5min', '96%'],
                    ['競爭分析', '5hr/案', '10min', '97%'],
                    ['企劃初稿', '12hr/案', '1.5hr', '88%'],
                    ['預算編列', '3hr/案', '30min', '83%'],
                  ].map(([task, manual, ai, gain], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--c-border)' }}>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{task}</td>
                      <td style={{ padding: '6px 10px', color: '#dc2626' }}>{manual}</td>
                      <td style={{ padding: '6px 10px', color: '#059669' }}>{ai}</td>
                      <td style={{ padding: '6px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 60, height: 6, background: 'rgba(139,92,246,.1)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: gain, height: '100%', background: 'var(--c-primary)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-primary)' }}>{gain}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'

const LAYER_COLORS = { 1: '#059669', 2: '#0284c7', 3: '#8b5cf6' };
const LAYER_LABELS = { 1: 'L1 · Groq', 2: 'L2 · GPT-4o-mini', 3: 'L3 · GPT-4o' };

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
          <p className="page-subtitle">三層 AI 引擎 · Groq + GPT-4o-mini + GPT-4o · 自動路由</p>
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
                {[{ key: 'auto', label: '自動', color: '#64748b' }, { key: 'groq', label: 'Groq', color: '#059669' }, { key: 'gpt-4o-mini', label: 'GPT-4o-mini', color: '#0284c7' }, { key: 'gpt-4o', label: 'GPT-4o', color: '#8b5cf6' }].map(m => (
                  <button key={m.key} onClick={() => setSelectedModel(m.key)} style={{
                    padding: '3px 10px', borderRadius: 999, border: `1.5px solid ${selectedModel === m.key ? m.color : 'var(--c-border)'}`,
                    background: selectedModel === m.key ? `${m.color}10` : 'transparent',
                    color: selectedModel === m.key ? m.color : 'var(--c-text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
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
            {/* 三層架構圖 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>三層 AI 引擎架構</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  { layer: 3, name: 'GPT-4o', icon: '', color: '#8b5cf6', bg: 'rgba(139,92,246,.04)', desc: '最高品質生成', uses: ['企劃書撰寫', '策略報告', '完整提案文件'], speed: '中', cost: '~$2.50/100K tokens (≈NT$0.08/次)', quality: '⭐⭐⭐⭐⭐' },
                  { layer: 2, name: 'GPT-4o-mini', icon: '', color: '#0284c7', bg: 'rgba(2,132,199,.04)', desc: '高效分析引擎', uses: ['競爭分析', '趨勢報告', '深度匹配'], speed: '快', cost: '~$0.15/100K tokens (≈NT$0.005/次)', quality: '⭐⭐⭐⭐' },
                  { layer: 1, name: 'Groq Llama 4', icon: '', color: '#059669', bg: 'rgba(5,150,105,.04)', desc: '極速免費引擎', uses: ['標案匹配', '快速問答', '基礎分類'], speed: '極快 (>500 tok/s)', cost: '免費 (30 RPM)', quality: '⭐⭐⭐' },
                ].map(l => (
                  <div key={l.layer} style={{ display: 'flex', gap: 16, padding: '18px 22px', borderRadius: 14, background: l.bg, border: `1px solid ${l.color}15` }}>
                    <div style={{ fontSize: 32, lineHeight: 1 }}>{l.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: l.color }}>Layer {l.layer}: {l.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{l.quality}</span>
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 6 }}>{l.desc}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                        {l.uses.map(u => <span key={u} className="capsule" style={{ background: `${l.color}10`, color: l.color, fontSize: 10 }}>{u}</span>)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                        速度：{l.speed} · 費用：{l.cost}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 自動路由說明 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>智慧路由機制</h3>
              <div style={{ fontSize: 13, lineHeight: 2.0 }}>
                <p style={{ marginBottom: 12 }}>系統會根據<strong>任務類型</strong>自動選擇最合適的 AI 通道：</p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                      {['任務類型', '自動路由', '原因'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['標案匹配 / 摘要 / 分類', 'Groq', '速度最快，免費，適合大量處理'],
                      ['深度分析 / 趨勢 / 競爭', 'GPT-4o-mini', '精度高但便宜，性價比最佳'],
                      ['企劃書 / 執行計畫 / 策略', 'GPT-4o', '最高品質，適合重要文件'],
                      ['一般對話 / 問答', 'Groq', '快速回應，節省費用'],
                    ].map(([task, route, reason], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{task}</td>
                        <td style={{ padding: '8px 12px' }}>{route}</td>
                        <td style={{ padding: '8px 12px', color: 'var(--c-text-muted)' }}>{reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 降級與容錯 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>自動降級與容錯</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(16,185,129,.04)', borderLeft: '4px solid var(--c-success)', marginBottom: 12 }}>
                  <strong>自動降級鏈</strong>：GPT-4o → GPT-4o-mini → Groq<br/>
                  當高階模型失敗（限速/斷線/餘額不足）時，系統會<strong>自動嘗試下一層</strong>，不需要手動切換。
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>已設定</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>GROQ_API_KEY</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>→ Layer 1 可用</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(139,92,246,.03)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>建議設定</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>OPENAI_API_KEY</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>→ 啟用 Layer 2 & 3</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 費用估算 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>費用估算</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--c-border)' }}>
                    {['方案', '月費', '包含', '適合'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--c-text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['A. 純 Groq', 'NT$0~160', '日常匹配分析', 'MVP 驗證'],
                    ['B. Groq + 4o-mini', 'NT$420', '+ 深度分析', '推薦起步'],
                    ['C. 三層混合', 'NT$1,680', '+ 企劃書生成', '正式營運'],
                    ['D. 全頂配', 'NT$3,400', '+ Claude 3.5', '規模化'],
                  ].map(([plan, cost, includes, fit], i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--c-border)', background: i === 1 ? 'rgba(5,150,105,.03)' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{plan}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#059669' }}>{cost}</td>
                      <td style={{ padding: '10px 12px' }}>{includes}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--c-text-muted)' }}>{fit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(139,92,246,.03)', fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.7 }}>
                日常使用 Groq 完全免費。只有使用 GPT-4o-mini/GPT-4o 時才計費。<br/>
                系統會即時追蹤使用量，顯示在右側面板。
              </div>
            </div>

            {/* 效率預估 */}
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>效率提升預估</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: '月省人力', value: '161 小時', sub: '≈ 1 全職人力', color: '#8b5cf6' },
                  { label: '保守 ROI', value: '341%', sub: '純算人力節省', color: '#059669' },
                  { label: '月 AI 成本', value: 'NT$420起', sub: '方案 B', color: '#0284c7' },
                ].map(k => (
                  <div key={k.label} style={{ padding: '14px 16px', borderRadius: 12, background: `${k.color}06`, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{k.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{k.sub}</div>
                  </div>
                ))}
              </div>
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

            {/* 設定指引 */}
            <div className="card" style={{ padding: 24, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>設定指引</h3>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(139,92,246,.03)', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>.env 檔案設定</div>
                  <code style={{ display: 'block', padding: '10px 14px', borderRadius: 8, background: 'rgba(0,0,0,.03)', fontSize: 12, fontFamily: 'monospace', lineHeight: 2 }}>
                    # Layer 1: Groq (必須)<br/>
                    GROQ_API_KEY=gsk_your_key_here<br/>
                    <br/>
                    # Layer 2 & 3: OpenAI (建議)<br/>
                    OPENAI_API_KEY=sk-your_key_here
                  </code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                  <strong>取得 API Key：</strong><br/>
                  • Groq：<a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color: 'var(--c-primary)' }}>console.groq.com/keys</a>（免費註冊）<br/>
                  • OpenAI：<a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style={{ color: 'var(--c-primary)' }}>platform.openai.com/api-keys</a>（需充值）
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

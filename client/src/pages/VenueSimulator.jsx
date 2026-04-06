import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import StepNav from '../components/StepNav'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function VenueSimulator({ projectId, project }) {
  // 場地規劃報告
  const [planReport, setPlanReport] = useState('');
  const [generating, setGenerating] = useState(false);

  // 模擬圖（保留原功能）
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [keywords, setKeywords] = useState('');
  const [style, setStyle] = useState('realistic');
  const [simResult, setSimResult] = useState(null);
  const [simGenerating, setSimGenerating] = useState(false);
  const fileRef = useRef(null);

  // 上下文摘要
  const [contextSummary, setContextSummary] = useState({ subs: 0, highlights: 0 });

  useEffect(() => {
    // 載入已有報告
    api.getVenuePlan(projectId)
      .then(data => { if (data?.report) setPlanReport(data.report); })
      .catch(() => {});

    // 載入上下文數量
    api.getSelectedSubActivities(projectId)
      .then(data => {
        const items = data?.items || [];
        setContextSummary(prev => ({ ...prev, subs: items.length }));
      })
      .catch(() => {});

    api.getHighlights(projectId)
      .then(data => {
        const selected = (data || []).filter(h => h.is_selected);
        setContextSummary(prev => ({ ...prev, highlights: selected.length }));
      })
      .catch(() => {});
  }, [projectId]);

  // === 生成場地規劃報告 ===
  const generatePlan = async () => {
    setGenerating(true);
    try {
      const result = await api.generateVenuePlan(projectId);
      if (result?.report) setPlanReport(result.report);
    } catch (err) {
      alert('場地規劃報告生成失敗：' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // === 模擬圖生成（保留） ===
  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const generateSim = async () => {
    if (!keywords.trim()) return;
    setSimGenerating(true);
    try {
      const res = await api.generateVenueSim(projectId, {
        keywords: keywords.trim(), style,
        photo_base64: photoPreview || undefined,
        venue_description: photo ? '參考照片已上傳' : '',
        project_context: { name: project?.name || '', event_type: project?.event_type || '', venue: project?.venue || '' },
      });
      setSimResult(res);
    } catch (err) {
      alert('模擬圖生成失敗：' + err.message);
    } finally {
      setSimGenerating(false);
    }
  };

  const STYLE_OPTIONS = [
    { id: 'realistic', label: '擬真風格', desc: '接近實際佈置效果' },
    { id: 'illustration', label: '插畫風格', desc: '清新手繪風' },
    { id: '3d_render', label: '3D 渲染', desc: '專業效果圖' },
    { id: 'blueprint', label: '平面配置', desc: '俯視配置圖' },
  ];

  const QUICK_KEYWORDS = [
    '舞台 + Truss 桁架 + LED螢幕', '攤販帳篷 + 市集擺設', '報到區 + 拱門',
    '觀眾區 + 桌椅', '休息區 + 遮陽', '醫護站', '燈光音響設備', '主題打卡牆',
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">場地佈圖規劃</h1>
          <p className="page-subtitle">
            AI 根據已選子活動與亮點，自動生成完整的場地規劃報告與模擬圖
          </p>
        </div>
        {planReport && (
          <button className="btn btn-secondary" onClick={generatePlan} disabled={generating}>
            重新生成報告
          </button>
        )}
      </div>

      {/* ===== 上下文摘要 ===== */}
      <div className="card" style={{ padding: '16px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
            AI 將基於以下內容生成場地規劃：
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: contextSummary.subs > 0 ? 'rgba(99,102,241,0.08)' : 'rgba(0,0,0,0.04)',
              color: contextSummary.subs > 0 ? 'var(--c-primary)' : 'var(--c-text-muted)',
            }}>子活動：{contextSummary.subs} 個</span>
            <span style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: contextSummary.highlights > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(0,0,0,0.04)',
              color: contextSummary.highlights > 0 ? '#f59e0b' : 'var(--c-text-muted)',
            }}>亮點：{contextSummary.highlights} 個</span>
            <span style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: 'rgba(16,185,129,0.08)', color: '#10b981',
            }}>場地：{project?.venue || '未指定'}</span>
            <span style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              background: 'rgba(16,185,129,0.08)', color: '#10b981',
            }}>人數：{project?.headcount || '未指定'}</span>
          </div>
        </div>
      </div>

      {/* ===== 場地規劃報告 ===== */}
      {!planReport && !generating && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px', marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.1 }}>&#9633;</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>生成場地佈圖規劃報告</h2>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            AI 根據子活動、亮點構想、需求文件，自動規劃 10 個章節：舞台設計、場地布置、報到區、燈光音響、電力、醫療、環境、雨備、人力、拍攝。
          </p>
          <button className="btn btn-primary" onClick={generatePlan}
            style={{ padding: '14px 40px', fontSize: 16 }}>
            AI 生成場地規劃報告
          </button>
        </div>
      )}

      {generating && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px', marginBottom: 20 }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>AI 正在規劃場地...</h3>
          <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>
            正在整合子活動、亮點、需求文件，生成 10 個章節的場地規劃報告
          </p>
          <p style={{ color: 'var(--c-text-muted)', fontSize: 12, marginTop: 8 }}>
            約需 1-2 分鐘，請稍候
          </p>
        </div>
      )}

      {planReport && (
        <div className="card" style={{
          padding: '32px', marginBottom: 24,
          borderLeft: '4px solid #8b5cf6',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#8b5cf6', marginBottom: 6 }}>
            活動會場佈圖規劃報告
          </div>
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 24 }}>
            包含硬體規劃（舞台/場地/報到/燈光/電力）+ 活動規劃（醫療/環境/雨備/人力/拍攝）
          </p>
          <div className="markdown-report">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{planReport}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ===== 模擬圖生成（輔助工具） ===== */}
      {planReport && (
        <div className="card" style={{ padding: '24px', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>場地模擬圖生成</div>
          <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 16 }}>
            根據規劃報告內容，生成場地佈置模擬圖（選填，可搭配上傳實際場地照片）
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 左：輸入 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* 照片上傳 */}
              <div style={{
                border: '2px dashed var(--c-border)', borderRadius: 10, padding: photoPreview ? 0 : '24px',
                textAlign: 'center', cursor: 'pointer', overflow: 'hidden',
              }} onClick={() => fileRef.current?.click()}>
                {photoPreview ? (
                  <img src={photoPreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                    點擊上傳場地照片（選填）
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

              {/* 關鍵字 */}
              <textarea value={keywords} onChange={e => setKeywords(e.target.value)}
                placeholder="描述佈置效果，例如：舞台正面 + 兩側攤位帳篷 + 中央觀眾區..."
                rows={2} style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8, boxSizing: 'border-box',
                  border: '1px solid var(--c-border)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {QUICK_KEYWORDS.map(kw => (
                  <button key={kw} onClick={() => setKeywords(prev => prev ? `${prev}、${kw}` : kw)}
                    className="btn btn-sm btn-secondary" style={{ fontSize: 10, padding: '3px 10px' }}>{kw}</button>
                ))}
              </div>

              {/* 風格 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {STYLE_OPTIONS.map(opt => (
                  <div key={opt.id} onClick={() => setStyle(opt.id)} style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    border: `2px solid ${style === opt.id ? '#8b5cf6' : 'var(--c-border)'}`,
                    background: style === opt.id ? 'rgba(139,92,246,0.04)' : 'white',
                    color: style === opt.id ? '#8b5cf6' : 'var(--c-text-secondary)',
                    fontWeight: style === opt.id ? 600 : 400,
                  }}>
                    {opt.label}
                    <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary" onClick={generateSim}
                disabled={simGenerating || !keywords.trim()}
                style={{ width: '100%' }}>
                {simGenerating ? 'AI 生成中...' : '生成模擬圖'}
              </button>
            </div>

            {/* 右：結果 */}
            <div style={{
              minHeight: 280, borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--c-border)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg-warm)',
            }}>
              {simGenerating ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 13, color: '#8b5cf6' }}>AI 正在生成模擬圖...</div>
                </div>
              ) : simResult?.image_url ? (
                <img src={simResult.image_url} alt="模擬圖" style={{ width: '100%', height: 'auto' }} />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
                  輸入關鍵字後點擊「生成模擬圖」
                </div>
              )}
            </div>
          </div>

          {simResult?.image_url && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="btn btn-sm btn-secondary" onClick={generateSim}>重新生成</button>
              <a href={simResult.image_url} download className="btn btn-sm btn-primary" style={{ textDecoration: 'none' }}>
                下載模擬圖
              </a>
            </div>
          )}
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'writing', label: '返回架構總表' }}
        next={{ path: 'bid', label: '前往投標管理' }} />
    </>
  );
}

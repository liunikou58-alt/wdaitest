import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function AnalysisPanel({ projectId, project }) {
  const { t } = useLang();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getAnalysis(projectId).then(data => {
      if (data?.analysis_json) setAnalysis(data.analysis_json);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    try {
      const result = await api.analyze(projectId);
      setAnalysis(result.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <div className="loader-container"><div className="loader" /></div>;

  const isCommercial = project?.case_type === 'commercial';

  // 取得摘要 — 優先 AI 產生的 meta，次之 project 本身資料
  const meta = analysis?.meta || {};
  const aiSummary = meta.summary || analysis?.summary || null;
  const summary = aiSummary || (project ? {
    budget: project.budget ? `${Number(project.budget).toLocaleString()} 元` : null,
    duration: project.duration || null,
    location: project.location || project.agency || null,
    event_date: project.event_date || null,
  } : null);
  const report = analysis?.report || null;

  // 偵測是否為舊格式（沒有 report 欄位）
  const isLegacyFormat = analysis && !report && !analysis.rawResponse;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('analysis.title')}</h1>
          <p className="page-subtitle">
            {isCommercial
              ? 'AI 自動分析文字需求，萃取關鍵資訊並提供企劃方向建議'
              : t('analysis.subtitle')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={runAnalysis} disabled={analyzing}>
          {analyzing ? t('analysis.running') : analysis ? t('analysis.rerun') : t('analysis.start')}
        </button>
      </div>

      {analyzing && (
        <div className="loader-container">
          <div className="loader" />
          <span style={{ color: 'var(--c-primary)' }}>{t('analysis.runningHint')}</span>
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--c-danger)', marginBottom: 16 }}>
          <p style={{ color: 'var(--c-danger)' }}>{error}</p>
        </div>
      )}

      {analysis && !analyzing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 專案摘要卡片 */}
          {summary && (
            <div className="analysis-section">
              <div className="analysis-section-title">{t('analysis.summary')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <InfoItem label="預算金額" value={summary.budget} />
                <InfoItem label="專案期程" value={summary.duration} />
                <InfoItem label="活動地點" value={summary.location} />
                <InfoItem label="活動日期" value={summary.event_date} />
              </div>
              {isCommercial && summary.client_info && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(16,185,129,0.04)', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)' }}>客戶資訊：</span>
                  <p style={{ fontSize: 13, margin: '4px 0 0', lineHeight: 1.6 }}>{summary.client_info}</p>
                </div>
              )}
            </div>
          )}

          {/* 新格式：Markdown 分析報告 */}
          {report && (
            <div className="analysis-section analysis-report">
              <div className="analysis-section-title">AI 分析報告</div>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* 舊格式相容：原來的卡片式渲染 */}
          {isLegacyFormat && (
            <>
              {/* 核心需求 */}
              {analysis.coreRequirements?.length > 0 && (
                <div className="analysis-section">
                  <div className="analysis-section-title">{t('analysis.coreReqs')}</div>
                  {Array.isArray(analysis.coreRequirements) && typeof analysis.coreRequirements[0] === 'object' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {analysis.coreRequirements.map((req, i) => (
                        <div key={i} style={{
                          padding: '12px 16px', borderRadius: 8,
                          background: 'var(--c-bg-card)', border: '1px solid var(--c-border)',
                          borderLeft: `3px solid ${req.weight === '高' ? '#ef4444' : req.weight === '中' ? '#f59e0b' : '#6366f1'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{req.title}</span>
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--c-text-secondary)' }}>
                            {(req.points || []).map((p, j) => <li key={j}>{p}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul>{analysis.coreRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  )}
                </div>
              )}

              {/* 交付成果 */}
              {analysis.keyDeliverables?.length > 0 && (
                <div className="analysis-section">
                  <div className="analysis-section-title">{t('analysis.deliverables')}</div>
                  <ul>{analysis.keyDeliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
              )}

              {/* 潛在風險 */}
              {analysis.risks?.length > 0 && (
                <div className="analysis-section">
                  <div className="analysis-section-title">{t('analysis.risks')}</div>
                  <ul>{analysis.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}

              {/* AI 建議 */}
              {analysis.aiNotes && (
                <div className="analysis-section" style={{ borderColor: 'var(--c-primary)', background: 'var(--c-primary-bg)' }}>
                  <div className="analysis-section-title">{t('analysis.aiNotes')}</div>
                  <p style={{ fontSize: 14, lineHeight: 1.6 }}>{analysis.aiNotes}</p>
                </div>
              )}
            </>
          )}

          {/* 評選標準 — 新舊通用 */}
          {(meta.evaluationCriteria?.length > 0 || analysis.evaluationCriteria?.length > 0) && (
            <div className="analysis-section">
              <div className="analysis-section-title">{t('analysis.evalCriteria')}</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                {(meta.evaluationCriteria || analysis.evaluationCriteria || []).map((c, i) => (
                  <div key={i} style={{
                    background: 'var(--c-bg-card)', border: '1px solid var(--c-border)',
                    borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 120
                  }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--c-primary)' }}>{c.weight}%</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 4 }}>{c.item_name || c.item}</div>
                    {(c.description || c.key_focus) && <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>{c.description || c.key_focus}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 原始回應 (fallback) */}
          {analysis.rawResponse && (
            <div className="analysis-section">
              <div className="analysis-section-title">{t('analysis.rawResponse')}</div>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis.rawResponse}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {!analysis && !analyzing && (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('analysis.empty')}</div>
          <p>{isCommercial ? '請先在「文件庫」貼上客戶需求文字，然後回來點擊「開始 AI 分析」' : t('analysis.emptyHint')}</p>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'documents', label: t('analysis.prev') }}
        next={{ path: 'themes', label: '前往主題策略' }}
        nextDisabled={!analysis} />
    </>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', background: 'var(--c-bg-card)', borderRadius: 6, border: '1px solid var(--c-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value || '未載明'}</div>
    </div>
  );
}

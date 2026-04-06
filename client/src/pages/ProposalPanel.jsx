import { useState } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'

export default function ProposalPanel({ projectId }) {
  const { t } = useLang();
  const [proposal, setProposal] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const result = await api.generateProposal(projectId);
      setProposal(result);
    } catch (err) { setError(err.message); }
    finally { setGenerating(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('proposal.title')}</h1>
          <p className="page-subtitle">{t('proposal.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? t('proposal.generating') : proposal ? t('proposal.regenerate') : t('proposal.generate')}
        </button>
      </div>

      {generating && (
        <div className="loader-container">
          <div className="loader" />
          <span style={{ color: 'var(--c-primary)' }}>{t('proposal.generatingHint')}</span>
        </div>
      )}

      {error && <div className="card" style={{ borderColor: 'var(--c-danger)' }}><p style={{ color: 'var(--c-danger)' }}>{error}</p></div>}

      {proposal && !generating && (
        <div>
          {/* 封面預覽 */}
          {proposal.cover && (
            <div className="card" style={{
              textAlign: 'center', padding: '60px 40px', marginBottom: 20,
              background: 'linear-gradient(135deg, var(--c-bg-card) 0%, rgba(99,102,241,0.1) 100%)',
              borderColor: 'var(--c-primary)'
            }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{proposal.cover.title}</h2>
              {proposal.cover.subtitle && <p style={{ fontSize: 16, color: 'var(--c-text-muted)' }}>{proposal.cover.subtitle}</p>}
            </div>
          )}

          {/* 章節內容 */}
          {proposal.chapters?.map((ch, i) => (
            <div key={i} className="card" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <span style={{
                  background: 'var(--c-primary)', color: 'white', width: 32, height: 32,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, flexShrink: 0
                }}>{ch.number || i + 1}</span>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>{ch.title}</h3>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--c-text-muted)', whiteSpace: 'pre-wrap' }}>
                {ch.content}
              </div>
            </div>
          ))}

          {/* 原始回應 fallback */}
          {proposal.rawResponse && (
            <div className="card">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--c-text-muted)' }}>{proposal.rawResponse}</pre>
            </div>
          )}
        </div>
      )}

      {!proposal && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('proposal.empty')}</div>
          <p>{t('proposal.emptyHint')}</p>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'highlights', label: t('proposal.prev') }}
        next={{ path: 'print', label: t('proposal.next') }}
        nextDisabled={!proposal} />
    </>
  );
}

import { useState, useEffect, useCallback } from 'react'
import { useParams, NavLink, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useLang } from '../LangContext'
import { api } from '../api'
import DocumentsPanel from './DocumentsPanel'
import AnalysisPanel from './AnalysisPanel'
import ThemesPanel from './ThemesPanel'
import HighlightsPanel from './HighlightsPanel'
import PlanSummaryPanel from './PlanSummaryPanel'
import CostsPanel from './CostsPanel'
import ProposalPanel from './ProposalPanel'
import PrintPanel from './PrintPanel'
import BidPanel from './BidPanel'
import PresentationPanel from './PresentationPanel'
import ExecutionPanel from './ExecutionPanel'
import ProposalWritingPanel from './ProposalWritingPanel'
import VenueSimulator from './VenueSimulator'
import DeptIntelCard from '../components/DeptIntelCard'

function useSteps() {
  const { t } = useLang();
  return [
    { path: 'documents', label: t('ws.documents') },
    { path: 'analysis', label: t('ws.analysis') },
    { path: 'themes', label: t('ws.themes') },
    // { path: 'highlights', label: t('ws.highlights') }, // 隱藏 — 客戶回饋 Slide 7
    { path: 'plan-summary', label: '企劃書架構' },
    { path: 'writing', label: '架構總表' },
    { path: 'venue-sim', label: '場地模擬 (Beta)' },
    // { path: 'costs', label: t('ws.costs') }, // 隱藏 — 客戶回饋 Slide 14
    // { path: 'proposal', label: t('ws.proposal') }, // 隱藏 — 客戶回饋 Slide 14
    // { path: 'print', label: t('ws.print') }, // 隱藏 — 客戶回饋 Slide 14
    { path: 'bid', label: t('ws.bid') },
    // { path: 'presentation', label: t('ws.presentation') }, // 隱藏 — 客戶回饋 Slide 14
    { path: 'execution', label: t('ws.execution'), requiresWon: true },
  ];
}

export default function ProjectWorkspace() {
  const { id } = useParams();
  const { t } = useLang();
  const STEPS = useSteps();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProject = useCallback(() => {
    api.getProject(id).then(setProject).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  if (loading) return <div className="loader-container"><div className="loader" /></div>;
  if (!project) return <div className="empty-state"><div className="empty-state-title">{t('ws.notFound')}</div></div>;

  const isTender = project.case_type !== 'commercial';
  const subtitleText = isTender
    ? [project.agency, project.department].filter(Boolean).join(' · ')
    : [project.company, project.company_industry].filter(Boolean).join(' · ');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg-warm)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--c-border)', padding: '14px 32px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Link to="/" className="btn btn-ghost btn-sm" style={{ fontSize: 13 }}>{t('common.back')}</Link>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: isTender ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                  color: isTender ? 'var(--c-primary)' : 'var(--c-success)',
                }}>{isTender ? '標案' : '商案'}</span>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{project.name}</h2>
              </div>
              <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: 0 }}>
                {isTender ? '' : ''} {subtitleText}
              </p>
            </div>
          </div>
        </div>
        {/* 科室情報卡 */}
        <DeptIntelCard projectId={id} project={project} />
        <div className="step-list">
          {STEPS.map((step, idx) => {
            if (step.requiresWon && project.status !== 'won') return null;
            return (
              <NavLink key={step.path} to={`/project/${id}/${step.path}`}
                className={({ isActive }) => `step-item ${isActive ? 'active' : ''}`}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%', fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(99,102,241,0.08)', color: 'var(--c-primary)',
                  flexShrink: 0,
                }}>{idx + 1}</span>
                <span>{step.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
      <main style={{ padding: '28px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <Routes>
          <Route index element={<Navigate to="documents" replace />} />
          <Route path="documents" element={<DocumentsPanel projectId={id} project={project} />} />
          <Route path="analysis" element={<AnalysisPanel projectId={id} project={project} />} />
          <Route path="themes" element={<ThemesPanel projectId={id} project={project} />} />
          <Route path="highlights" element={<HighlightsPanel projectId={id} />} />
          <Route path="plan-summary" element={<PlanSummaryPanel projectId={id} project={project} />} />
          <Route path="writing" element={<ProposalWritingPanel projectId={id} project={project} />} />
          <Route path="venue-sim" element={<VenueSimulator projectId={id} project={project} />} />
          <Route path="costs" element={<CostsPanel projectId={id} project={project} />} />
          <Route path="proposal" element={<ProposalPanel projectId={id} />} />
          <Route path="print" element={<PrintPanel projectId={id} />} />
          <Route path="bid" element={<BidPanel projectId={id} />} />
          <Route path="presentation" element={<PresentationPanel projectId={id} />} />
          <Route path="execution" element={<ExecutionPanel projectId={id} />} />
        </Routes>
      </main>
    </div>
  );
}

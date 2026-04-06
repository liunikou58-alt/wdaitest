import { useNavigate } from 'react-router-dom'

export default function StepNav({ projectId, prev, next, nextLabel, nextDisabled }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', justifyContent: prev ? 'space-between' : 'flex-end',
      marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--c-border)'
    }}>
      {prev && (
        <button className="btn btn-secondary" onClick={() => navigate(`/project/${projectId}/${prev.path}`)}>
          ← {prev.label}
        </button>
      )}
      {next && (
        <button className="btn btn-primary" disabled={nextDisabled}
          onClick={() => navigate(`/project/${projectId}/${next.path}`)}>
          {nextLabel || next.label} →
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react'
import { api } from '../api'

const SECTION_CONFIG = [
  { key: 'mission_summary', label: '業務職掌', icon: '' },
  { key: 'core_programs', label: '核心計畫', icon: '', isList: true },
  { key: 'key_issues', label: '領域痛點', icon: '', isList: true },
  { key: 'creative_directions', label: '創意方向建議', icon: '', isList: true },
  { key: 'past_events_reference', label: '過去活動案例', icon: '', isList: true },
  { key: 'international_benchmarks', label: '國際標竿', icon: '', isList: true },
  { key: 'evaluation_focus', label: '評審重視要素', icon: '', isList: true },
  { key: 'sensitive_terms', label: '用語注意事項', icon: '', isList: true },
  { key: 'domain_keywords', label: '專業術語', icon: '', isKeywords: true },
];

export default function DeptIntelCard({ projectId, project }) {
  const [intel, setIntel] = useState(null);
  const [status, setStatus] = useState('loading');
  const [expanded, setExpanded] = useState(false);
  const [researching, setResearching] = useState(false);
  const [polling, setPolling] = useState(false);

  const isTender = project?.case_type !== 'commercial';
  const entityLabel = isTender
    ? [project?.agency, project?.department].filter(Boolean).join(' / ')
    : [project?.company, project?.company_industry].filter(Boolean).join(' / ');

  const fetchIntel = () => {
    api.getDeptIntelligence(projectId).then(data => {
      setIntel(data?.intel || null);
      setStatus(data?.status || 'none');
      if (data?.status === 'researching') {
        setPolling(true);
      } else {
        setPolling(false);
      }
    }).catch(() => setStatus('error'));
  };

  useEffect(() => { fetchIntel(); }, [projectId]);

  // 研究中時輪詢
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(fetchIntel, 3000);
    return () => clearInterval(interval);
  }, [polling]);

  const handleResearch = async () => {
    setResearching(true);
    try {
      await api.triggerDeptResearch(projectId, '');
      fetchIntel();
    } catch (err) {
      console.error(err);
    } finally {
      setResearching(false);
    }
  };

  // 不顯示的情況
  if (!entityLabel) return null;

  const statusColor = {
    'completed': '#10b981',
    'researching': '#f59e0b',
    'failed': '#ef4444',
    'none': '#94a3b8',
  }[status] || '#94a3b8';

  const statusLabel = {
    'completed': '情報就緒',
    'researching': '研究中...',
    'failed': '研究失敗',
    'none': '尚未研究',
    'loading': '載入中...',
  }[status] || '未知';

  return (
    <div style={{
      background: 'rgba(99,102,241,0.03)',
      border: '1px solid rgba(99,102,241,0.1)',
      borderRadius: 16,
      marginBottom: 20,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {/* Header - always visible */}
      <div
        onClick={() => status === 'completed' && setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px',
          cursor: status === 'completed' ? 'pointer' : 'default',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { if (status === 'completed') e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {isTender ? '' : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text)' }}>
            {isTender ? '科室情報' : '企業情報'}
          </div>
          <div style={{
            fontSize: 11, color: 'var(--c-text-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entityLabel}
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 999,
          background: `${statusColor}10`,
          fontSize: 11, fontWeight: 600, color: statusColor,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: statusColor,
            ...(status === 'researching' ? { animation: 'pulse 1.5s ease infinite' } : {}),
          }} />
          {statusLabel}
        </div>

        {/* Actions */}
        {(status === 'none' || status === 'failed') && (
          <button
            onClick={(e) => { e.stopPropagation(); handleResearch(); }}
            disabled={researching}
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11, padding: '6px 14px', borderRadius: 10, whiteSpace: 'nowrap' }}
          >
            {researching ? 'AI 研究中...' : 'AI 研究'}
          </button>
        )}
        {status === 'completed' && (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
            ▼
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && intel && (
        <div style={{
          padding: '0 20px 20px',
          animation: 'slideDown 0.3s ease',
        }}>
          <div style={{ borderTop: '1px solid rgba(99,102,241,0.08)', paddingTop: 16 }}>
            {SECTION_CONFIG.map(sec => {
              const value = intel[sec.key];
              if (!value || (Array.isArray(value) && value.length === 0)) return null;

              return (
                <div key={sec.key} style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--c-primary)',
                    marginBottom: 6, letterSpacing: 0.3,
                  }}>
                    {sec.icon} {sec.label}
                  </div>
                  {sec.isList ? (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.8, color: 'var(--c-text-secondary)' }}>
                      {value.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  ) : sec.isKeywords ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {value.map((kw, i) => (
                        <span key={i} style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 11,
                          background: 'rgba(99,102,241,0.08)', color: 'var(--c-primary)', fontWeight: 500,
                        }}>{kw}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--c-text-secondary)' }}>
                      {value}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Target audience */}
            {intel.target_audience && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 6 }}>
                  目標受眾
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: '主要', value: intel.target_audience.primary },
                    { label: '次要', value: intel.target_audience.secondary },
                    { label: '決策鏈', value: intel.target_audience.decision_makers },
                  ].map(t => (
                    <div key={t.label} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(99,102,241,0.04)', fontSize: 11 }}>
                      <div style={{ fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 2, fontSize: 10 }}>{t.label}</div>
                      <div style={{ color: 'var(--c-text-secondary)' }}>{t.value || '--'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget reference */}
            {intel.budget_reference && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 6 }}>
                  預算參考
                </div>
                <div style={{ fontSize: 12, color: 'var(--c-text-secondary)', lineHeight: 1.8 }}>
                  常見範圍：{intel.budget_reference.typical_range || '--'}
                  {intel.budget_reference.cost_sensitive_items?.length > 0 && (
                    <span> / 注意：{intel.budget_reference.cost_sensitive_items.join('、')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Re-research button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button
                onClick={handleResearch}
                disabled={researching}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: 11, padding: '6px 14px', borderRadius: 10 }}
              >
                {researching ? 'AI 重新研究中...' : '重新研究'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react'
import { useLang } from '../LangContext'

const RISK_ITEMS = [
  { id: 1, project: '午時水活動', category: '時程風險', level: 'high', score: 85,
    description: '投標截止僅剩 5 天，但企劃書完成度僅 68%',
    suggestion: '立即安排 2 位企劃人員加入，啟動 48 小時衝刺模式', impact: '延遲提交將喪失投標資格',
  },
  { id: 2, project: '午時水活動', category: '成本風險', level: 'medium', score: 62,
    description: '場地搭建費用比預算高出 18%，總成本可能超標',
    suggestion: '重新議價或尋找替代供應商', impact: '超出預算 20% 以上，利潤率降至 5% 以下',
  },
  { id: 3, project: '午時水活動', category: '競爭風險', level: 'medium', score: 55,
    description: '競品「奧美」也在準備同案投標，過往勝率 65%',
    suggestion: '強化差異化亮點，報價策略可降低 5%', impact: '未做差異化，估勝率僅 35%',
  },
  { id: 4, project: '午時水活動', category: '人力風險', level: 'low', score: 30,
    description: '燈光組需要外部支援',
    suggestion: '提前聯繫合作燈光廠商鎖定檔期', impact: '輕微影響，可透過外包解決',
  },
  { id: 5, project: '台中花博', category: '法規風險', level: 'high', score: 78,
    description: '戶外活動需取得環評許可，尚未啟動申請',
    suggestion: '立即啟動環評申請，審理約 30 天', impact: '未取得環評，方案需大幅修改',
  },
];

const LEVEL_STYLE = {
  high: { label: '高風險', color: 'var(--c-danger)', bg: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))', emoji: '' },
  medium: { label: '中風險', color: 'var(--c-warning)', bg: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))', emoji: '' },
  low: { label: '低風險', color: 'var(--c-success)', bg: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))', emoji: '' },
};

const CATEGORY_ICONS = { '時程風險': '⏰', '成本風險': '', '競爭風險': '', '人力風險': '', '法規風險': '' };

export default function RiskRadar() {
  const { t } = useLang();
  const [filterLevel, setFilterLevel] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = filterLevel === 'all' ? RISK_ITEMS : RISK_ITEMS.filter(r => r.level === filterLevel);
  const highCount = RISK_ITEMS.filter(r => r.level === 'high').length;
  const avgScore = Math.round(RISK_ITEMS.reduce((s, r) => s + r.score, 0) / RISK_ITEMS.length);

  return (
    <div className="animate-fadeUp">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('risk.title')}</h1>
          <p className="page-subtitle">{t('risk.subtitle')}</p>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { l: '總風險項', v: RISK_ITEMS.length, c: '#8b5cf6', i: '', bg: 'rgba(139,92,246,0.06)' },
          { l: '高風險', v: highCount, c: 'var(--c-danger)', i: '', bg: 'rgba(239,68,68,0.06)' },
          { l: '平均風險分', v: avgScore, c: avgScore > 60 ? 'var(--c-warning)' : 'var(--c-success)', i: '', bg: avgScore > 60 ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.06)' },
          { l: '需即刻處理', v: RISK_ITEMS.filter(r => r.score >= 70).length, c: 'var(--c-danger)', i: '', bg: 'rgba(239,68,68,0.06)' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ background: k.bg }}>
            <div className="kpi-label">{k.l}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="kpi-value" style={{ color: k.c, fontSize: 28 }}>{k.v}</span>
              <span className="kpi-icon" style={{ fontSize: 24 }}>{k.i}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'high', 'medium', 'low'].map(l => (
          <button key={l} onClick={() => setFilterLevel(l)} className={`btn btn-sm ${filterLevel === l ? 'btn-primary' : 'btn-secondary'}`}>
            {l === 'all' ? '全部' : `${LEVEL_STYLE[l].emoji} ${LEVEL_STYLE[l].label}`}
          </button>
        ))}
      </div>

      {/* Risk Cards */}
      {filtered.map(r => {
        const ls = LEVEL_STYLE[r.level];
        const isExpanded = expandedId === r.id;
        return (
          <div key={r.id} className="card" onClick={() => setExpandedId(isExpanded ? null : r.id)}
            style={{ padding: '20px 24px', marginBottom: 12, cursor: 'pointer', background: ls.bg, borderLeft: `4px solid ${ls.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? 14 : 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                <span className="capsule" style={{ background: `${ls.color}15`, color: ls.color }}>{ls.emoji} {ls.label}</span>
                <span className="capsule" style={{ background: 'rgba(139,92,246,0.04)', color: 'var(--c-text-muted)' }}>{CATEGORY_ICONS[r.category]} {r.category}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>— {r.project}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: ls.color }}>{r.score}</span>
                <span style={{ fontSize: 12, color: 'var(--c-text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--c-text)', margin: isExpanded ? '0 0 14px' : 0, lineHeight: 1.6 }}>{r.description}</p>

            {isExpanded && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animation: 'fadeUp 0.3s ease' }}>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.04)', borderLeft: '3px solid var(--c-success)' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-success)', fontWeight: 700, marginBottom: 6 }}>{t('risk.aiSuggestion')}</div>
                  <p style={{ fontSize: 12, color: 'var(--c-text)', margin: 0, lineHeight: 1.6 }}>{r.suggestion}</p>
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(239,68,68,0.03)', borderLeft: '3px solid var(--c-danger)' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-danger)', fontWeight: 700, marginBottom: 6 }}>{t('risk.impactAssessment')}</div>
                  <p style={{ fontSize: 12, color: 'var(--c-text)', margin: 0, lineHeight: 1.6 }}>{r.impact}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

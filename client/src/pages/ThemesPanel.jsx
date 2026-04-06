import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const DEFAULT_STYLE_TAGS = ['創新科技', '文化傳承', '永續環保', '國際視野', '在地深耕', '青年參與', '親子同樂', '數位轉型'];
const PRESET_KEYWORDS = ['活動', '宣導', '晚會', '行銷', '論壇', '表揚', '節慶', '母親節', '父親節', '中秋節', '聖誕節', '端午節', '兒童節', '元宵節', '燈會'];
const THEME_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ThemesPanel({ projectId, project }) {
  const { t } = useLang();

  // Phase: 'idle' | 'phase1-loading' | 'phase1' | 'phase2-loading' | 'phase2' | 'phase3-loading' | 'phase4-loading'
  const [phase, setPhase] = useState('idle');

  // Phase 1
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  // Phase 2
  const [report, setReport] = useState('');

  // Phase 3
  const [extractedActivities, setExtractedActivities] = useState([]);
  const [selectedSubs, setSelectedSubs] = useState([]);
  const [subsSaved, setSubsSaved] = useState(false);

  // Phase 4 亮點
  const [highlightsReport, setHighlightsReport] = useState('');
  const [highlightItems, setHighlightItems] = useState([]);

  // 風格
  const [styles, setStyles] = useState([]);
  const [showStylePicker, setShowStylePicker] = useState(false);

  const isTender = project?.case_type !== 'commercial';
  const contextLabel = isTender
    ? [project?.agency, project?.department].filter(Boolean).join(' · ')
    : [project?.company, project?.company_industry].filter(Boolean).join(' · ');

  // === 載入已存資料 ===
  useEffect(() => {
    // 載入主題報告
    api.getThemes(projectId).then(data => {
      if (data?.length > 0) {
        const withReport = data.find(t => t.report);
        if (withReport) {
          setReport(withReport.report);
          setPhase('phase2');
        }
      }
    }).catch(console.error);

    // 載入已選子活動
    api.getSelectedSubActivities(projectId)
      .then(data => {
        if (data?.items?.length) {
          setSelectedSubs(data.items);
          setSubsSaved(true);
        }
      })
      .catch(() => {});

    // 載入已有亮點報告
    api.getHighlightsReport(projectId)
      .then(data => { if (data?.report) setHighlightsReport(data.report); })
      .catch(() => {});

    // 載入已有亮點清單
    api.getHighlights(projectId)
      .then(data => { if (data?.length) setHighlightItems(data); })
      .catch(() => {});
  }, [projectId]);

  // === Phase 1 ===
  const startPhase1 = async () => {
    setPhase('phase1-loading');
    setQuestions([]); setAnswers({});
    try {
      const result = await api.getDirectionQuestions(projectId);
      setQuestions(result.questions || []);
      setPhase('phase1');
    } catch (err) {
      alert('定向選擇題生成失敗：' + err.message);
      setPhase('idle');
    }
  };

  // === Phase 2 ===
  const startPhase2 = async () => {
    setPhase('phase2-loading');
    try {
      const directions = questions.map((q, i) => ({
        question: q.question, answer: answers[i] || ''
      })).filter(d => d.answer);
      const result = await api.generateThemes(projectId, styles, directions);
      if (result?.[0]?.report) setReport(result[0].report);
      setPhase('phase2');
    } catch (err) {
      alert('主題生成失敗：' + err.message);
      setPhase('phase1');
    }
  };

  // === Phase 3 ===
  const extractActivities = async () => {
    setPhase('phase3-loading');
    try {
      const result = await api.extractActivities(projectId);
      if (result?.activities?.length) setExtractedActivities(result.activities);
    } catch (err) { alert('子活動提取失敗：' + err.message); }
    setPhase('phase2');
  };

  const toggleSubActivity = (activity, themeIndex) => {
    const key = `theme-${themeIndex}::${activity.name}`;
    setSelectedSubs(prev => {
      const exists = prev.find(s => s.key === key);
      if (exists) return prev.filter(s => s.key !== key);
      return [...prev, {
        key, themeId: `theme-${themeIndex}`,
        themeTitle: activity.theme || `方案 ${themeIndex + 1}`,
        name: activity.name, description: activity.description,
        effect: activity.effect,
        color: THEME_COLORS[themeIndex % THEME_COLORS.length]
      }];
    });
    setSubsSaved(false);
  };

  const isSubSelected = (activity, themeIndex) => {
    const key = `theme-${themeIndex}::${activity.name}`;
    return selectedSubs.some(s => s.key === key);
  };

  const saveSelection = async () => {
    try {
      await api.saveSelectedSubActivities(projectId, selectedSubs);
      setSubsSaved(true);
    } catch (err) { alert(err.message); }
  };

  // === Phase 4: 生成亮點 ===
  const generateHighlights = async () => {
    setPhase('phase4-loading');
    try {
      const result = await api.generateHighlights(projectId);
      if (result?.report) setHighlightsReport(result.report);
      if (result?.items?.length) setHighlightItems(result.items);
      setPhase('phase2');
    } catch (err) {
      alert('亮點生成失敗：' + err.message);
      setPhase('phase2');
    }
  };

  // === 亮點勾選 ===
  const toggleHighlight = async (h) => {
    const newVal = h.is_selected ? 0 : 1;
    try {
      await api.updateHighlight(projectId, h.id, { is_selected: newVal });
      setHighlightItems(prev => prev.map(item =>
        item.id === h.id ? { ...item, is_selected: newVal } : item
      ));
    } catch {}
  };

  const allAnswered = questions.length > 0 && questions.every((_, i) => answers[i]);

  const restart = () => {
    setPhase('idle'); setQuestions([]); setAnswers({});
    setReport(''); setExtractedActivities([]);
    setHighlightsReport(''); setHighlightItems([]);
  };

  // 子活動分組
  const groupedActivities = {};
  extractedActivities.forEach((act) => {
    const themeKey = act.theme || '未分類';
    if (!groupedActivities[themeKey]) groupedActivities[themeKey] = [];
    groupedActivities[themeKey].push(act);
  });

  const selectedHLCount = highlightItems.filter(h => h.is_selected).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">主題包裝工作坊</h1>
          <p className="page-subtitle">AI 閱讀需求文件，產出主題方案、子活動、殺手級亮點</p>
          {contextLabel && (
            <p style={{ fontSize: 12, color: 'var(--c-accent)', marginTop: 4 }}>
              主題基於：{contextLabel}
            </p>
          )}
        </div>
        {phase === 'phase2' && (
          <button className="btn btn-secondary" onClick={restart}>重新發想</button>
        )}
      </div>

      {/* ========== IDLE ========== */}
      {phase === 'idle' && (
        <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.15 }}>&#9672;</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>開始主題包裝</h2>
          <p style={{ color: 'var(--c-text-muted)', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            AI 閱讀需求文件 → 方向選擇 → 主題方案 → 子活動勾選 → 殺手級亮點
          </p>
          <div style={{ marginBottom: 24 }}>
            <button className="btn btn-sm btn-secondary"
              onClick={() => setShowStylePicker(!showStylePicker)} style={{ marginBottom: 12 }}>
              {showStylePicker ? '收合風格選擇' : '選擇偏好風格（可選）'}
            </button>
            {showStylePicker && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {[...DEFAULT_STYLE_TAGS, ...PRESET_KEYWORDS].map(s => (
                  <button key={s} className={`btn btn-sm ${styles.includes(s) ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStyles(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    style={{ transition: 'all 0.2s ease' }}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={startPhase1}
            style={{ padding: '12px 36px', fontSize: 16 }}>
            開始 AI 創意工作坊
          </button>
        </div>
      )}

      {/* ========== PHASE 1 LOADING ========== */}
      {phase === 'phase1-loading' && (
        <LoadingCard title="AI 正在閱讀需求文件..." desc="正在分析文件內容，產出 3 個方向選擇題" />
      )}

      {/* ========== PHASE 1 ========== */}
      {phase === 'phase1' && (
        <>
          <div className="card" style={{
            padding: '20px 24px', marginBottom: 20,
            borderLeft: '4px solid var(--c-primary)',
            background: 'rgba(99,102,241,0.02)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-primary)', marginBottom: 8 }}>
              WDMC 創意總監
            </div>
            <p style={{ fontSize: 14, color: 'var(--c-text-secondary)', lineHeight: 1.7, margin: 0 }}>
              需求文件已閱讀完畢。請先回答 3 個方向問題，幫助我精準抓到你想要的主題方向。
            </p>
          </div>
          {questions.map((q, qi) => (
            <div key={qi} className="card" style={{ marginBottom: 16, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: answers[qi] ? 'var(--c-primary)' : 'var(--c-border)',
                  color: answers[qi] ? 'white' : 'var(--c-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0, transition: 'all 0.3s ease',
                }}>{answers[qi] ? '\u2713' : qi + 1}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{q.question}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(q.options || []).map((opt, oi) => {
                  const selected = answers[qi] === opt;
                  return (
                    <button key={oi} onClick={() => setAnswers(prev => ({ ...prev, [qi]: opt }))}
                      style={{
                        padding: '12px 16px', borderRadius: 10,
                        border: selected ? '2px solid var(--c-primary)' : '2px solid var(--c-border)',
                        background: selected ? 'rgba(99,102,241,0.06)' : 'white',
                        color: selected ? 'var(--c-primary)' : 'var(--c-text-secondary)',
                        fontWeight: selected ? 600 : 400, fontSize: 14,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                      }}>{opt}</button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button className="btn btn-primary" onClick={startPhase2} disabled={!allAnswered}
              style={{ padding: '14px 48px', fontSize: 16, opacity: allAnswered ? 1 : 0.5 }}>
              {allAnswered ? '開始生成主題方案' : `還有 ${questions.length - Object.keys(answers).length} 題未選擇`}
            </button>
          </div>
        </>
      )}

      {/* ========== PHASE 2 LOADING ========== */}
      {phase === 'phase2-loading' && (
        <LoadingCard title="AI 正在創作主題方案..."
          desc="基於需求文件與方向選擇，正在生成 3 套完整的主題包裝方案"
          extra="約需 1-2 分鐘，請稍候" />
      )}

      {/* ========== PHASE 3 LOADING ========== */}
      {phase === 'phase3-loading' && (
        <LoadingCard title="AI 正在提取子活動..."
          desc="從 3 套主題方案中萃取具體可執行的子活動清單" />
      )}

      {/* ========== PHASE 4 LOADING ========== */}
      {phase === 'phase4-loading' && (
        <LoadingCard title="AI 正在發想殺手級亮點..."
          desc="根據已選子活動與主題方案，產出 6 個具競爭力的亮點構想"
          extra="約需 1-2 分鐘，請稍候" />
      )}

      {/* ========== PHASE 2+ — 主報告 + 子活動 + 亮點 ========== */}
      {phase === 'phase2' && report && (
        <>
          {/* ===== 主題方案報告 ===== */}
          <SectionCard title="主題包裝方案報告" subtitle="AI 根據需求文件與方向選擇，產出以下 3 套主題方案" color="var(--c-primary)">
            <div className="markdown-report">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          </SectionCard>

          {/* ===== 子活動提取按鈕 ===== */}
          {extractedActivities.length === 0 && selectedSubs.length === 0 && (
            <div className="card" style={{ textAlign: 'center', padding: '24px 32px' }}>
              <p style={{ fontSize: 14, color: 'var(--c-text-muted)', marginBottom: 16 }}>
                閱讀完方案後，點擊下方按鈕從報告中提取子活動
              </p>
              <button className="btn btn-primary" onClick={extractActivities}
                style={{ padding: '12px 36px', fontSize: 15 }}>
                AI 提取子活動清單
              </button>
            </div>
          )}

          {/* ===== 子活動勾選區 ===== */}
          {(extractedActivities.length > 0 || selectedSubs.length > 0) && (
            <SectionCard title="子活動選取" subtitle={`從方案中勾選子活動，可跨方案混搭（已選 ${selectedSubs.length} 個）`} color="#10b981">
              {Object.entries(groupedActivities).map(([themeTitle, activities], gi) => (
                <div key={themeTitle} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, marginBottom: 10,
                    padding: '8px 14px', borderRadius: 8,
                    background: `${THEME_COLORS[gi % THEME_COLORS.length]}08`,
                    borderLeft: `3px solid ${THEME_COLORS[gi % THEME_COLORS.length]}`,
                    color: THEME_COLORS[gi % THEME_COLORS.length],
                  }}>{themeTitle}</div>
                  {activities.map((act, ai) => {
                    const checked = isSubSelected(act, gi);
                    return (
                      <div key={ai} onClick={() => toggleSubActivity(act, gi)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          background: checked ? `${THEME_COLORS[gi % THEME_COLORS.length]}08` : 'var(--c-bg)',
                          borderRadius: 8, padding: '10px 12px', marginBottom: 6,
                          cursor: 'pointer', transition: 'all 0.2s ease',
                          border: checked ? `2px solid ${THEME_COLORS[gi % THEME_COLORS.length]}` : '2px solid transparent',
                        }}>
                        <input type="checkbox" checked={checked} readOnly
                          style={{ marginTop: 3, accentColor: THEME_COLORS[gi % THEME_COLORS.length], cursor: 'pointer' }} />
                        <div>
                          <strong style={{ fontSize: 13 }}>{act.name}</strong>
                          <p style={{ color: 'var(--c-text-muted)', margin: '2px 0 0', fontSize: 12 }}>{act.description}</p>
                          {act.effect && <p style={{ color: 'var(--c-accent)', margin: '2px 0 0', fontSize: 11 }}>{act.effect}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 儲存選取 */}
              {selectedSubs.length > 0 && !subsSaved && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={saveSelection}
                    style={{ padding: '10px 32px' }}>
                    確認子活動選取（{selectedSubs.length} 個）
                  </button>
                </div>
              )}
              {subsSaved && selectedSubs.length > 0 && (
                <div style={{
                  textAlign: 'center', marginTop: 12, fontSize: 13,
                  color: '#059669', fontWeight: 600,
                }}>
                  已儲存 {selectedSubs.length} 個子活動
                </div>
              )}
            </SectionCard>
          )}

          {/* ===== Phase 4: 亮點發想 ===== */}
          {subsSaved && selectedSubs.length > 0 && !highlightsReport && (
            <div className="card" style={{
              textAlign: 'center', padding: '32px',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.03), rgba(239,68,68,0.03))',
              border: '2px dashed rgba(245,158,11,0.3)',
            }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>殺手級亮點發想</div>
              <p style={{ color: 'var(--c-text-muted)', marginBottom: 20, maxWidth: 500, margin: '0 auto 20px' }}>
                根據你選的 {selectedSubs.length} 個子活動，AI 將發想 6 個能在{isTender ? '評選中製造差異化' : '客戶面前製造記憶點'}的殺手級亮點。
              </p>
              <button className="btn btn-primary" onClick={generateHighlights}
                style={{
                  padding: '14px 40px', fontSize: 16,
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  border: 'none',
                }}>
                生成殺手級亮點
              </button>
            </div>
          )}

          {/* ===== 亮點 Markdown 報告 ===== */}
          {highlightsReport && (
            <SectionCard title="殺手級亮點構想報告"
              subtitle={`AI 根據已選 ${selectedSubs.length} 個子活動，發想以下亮點`}
              color="#f59e0b">
              <div className="markdown-report">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{highlightsReport}</ReactMarkdown>
              </div>
            </SectionCard>
          )}

          {/* ===== 亮點勾選管理 ===== */}
          {highlightItems.length > 0 && (
            <SectionCard title="亮點管理"
              subtitle={`勾選要納入企劃書的亮點（已選 ${selectedHLCount}/${highlightItems.length}）`}
              color="#ef4444">
              {highlightItems.map((h) => {
                const checked = !!h.is_selected;
                return (
                  <div key={h.id} onClick={() => toggleHighlight(h)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      background: checked ? 'rgba(245,158,11,0.04)' : 'var(--c-bg)',
                      border: checked ? '2px solid rgba(245,158,11,0.4)' : '2px solid transparent',
                      opacity: checked ? 1 : 0.6,
                    }}>
                    <input type="checkbox" checked={checked} readOnly
                      style={{ marginTop: 3, accentColor: '#f59e0b', cursor: 'pointer' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{h.title}</div>
                      {h.description && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: '2px 0' }}>{h.description}</p>}
                      {h.expected_effect && <p style={{ fontSize: 11, color: 'var(--c-accent)', margin: '2px 0' }}>{h.expected_effect}</p>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        {h.cost_level && (
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 4,
                            background: h.cost_level === 'low' ? '#dcfce7' : h.cost_level === 'high' ? '#fee2e2' : '#fef3c7',
                            color: h.cost_level === 'low' ? '#166534' : h.cost_level === 'high' ? '#991b1b' : '#92400e',
                          }}>成本：{h.cost_level === 'low' ? '低' : h.cost_level === 'high' ? '高' : '中'}</span>
                        )}
                        {h.mapped_criteria && (
                          <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>
                            對應：{h.mapped_criteria}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </SectionCard>
          )}

          {/* 重新生成亮點按鈕 */}
          {highlightsReport && (
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={generateHighlights}>
                重新生成亮點
              </button>
            </div>
          )}
        </>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'analysis', label: 'AI 分析' }}
        next={{ path: 'plan-summary', label: '前往企劃書架構' }}
        nextDisabled={phase !== 'phase2' || selectedSubs.length === 0} />
    </>
  );
}

// === 共用元件 ===
function LoadingCard({ title, desc, extra }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
      <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>{desc}</p>
      {extra && <p style={{ color: 'var(--c-text-muted)', fontSize: 12, marginTop: 8 }}>{extra}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, color, children }) {
  return (
    <div className="card" style={{
      padding: '28px 32px', marginBottom: 20,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      {subtitle && <p style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 20 }}>{subtitle}</p>}
      {children}
    </div>
  );
}

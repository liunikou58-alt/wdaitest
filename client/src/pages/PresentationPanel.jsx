import { useState } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'

export default function PresentationPanel({ projectId }) {
  const { t } = useLang();
  const [slides, setSlides] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [error, setError] = useState('');

  const generate = async () => {
    setGenerating(true); setError('');
    try {
      const result = await api.generatePresentation(projectId);
      setSlides(result);
      setActiveSlide(0);
    } catch (err) { setError(err.message); }
    finally { setGenerating(false); }
  };

  const totalDuration = slides ? slides.reduce((s, sl) => s + (sl.duration_seconds || 30), 0) : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('pres.title')}</h1>
          <p className="page-subtitle">{t('pres.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={generate} disabled={generating}>
          {generating ? t('pres.generating') : slides ? t('pres.regenerate') : t('pres.generate')}
        </button>
      </div>

      {generating && (
        <div className="loader-container"><div className="loader" />
          <span style={{ color: 'var(--c-primary)' }}>{t('pres.generatingHint')}</span>
        </div>
      )}

      {error && <div className="card" style={{ borderColor: 'var(--c-danger)' }}><p style={{ color: 'var(--c-danger)' }}>{error}</p></div>}

      {slides && !generating && (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* 左側投影片列表 */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>
              共 {slides.length} 頁 · 預估 {Math.ceil(totalDuration / 60)} 分鐘
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {slides.map((sl, i) => (
                <button key={i} onClick={() => setActiveSlide(i)}
                  className={`step-item ${activeSlide === i ? 'active' : ''}`}
                  style={{ border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                  <span className="step-dot" />
                  <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sl.page || i + 1}. {sl.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 右側投影片預覽 */}
          <div style={{ flex: 1 }}>
            {slides[activeSlide] && (
              <>
                {/* 投影片預覽 */}
                <div className="card" style={{
                  padding: '40px 48px', marginBottom: 16,
                  background: 'linear-gradient(135deg, #2d1b69 0%, rgba(139,92,246,0.15) 100%)', color: '#e4e6ed',
                  aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'center'
                }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 12 }}>
                    SLIDE {slides[activeSlide].page || activeSlide + 1} / {slides.length}
                    <span style={{ marginLeft: 12 }}>⏱{slides[activeSlide].duration_seconds || 30}s</span>
                  </div>
                  <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 20 }}>{slides[activeSlide].title}</h2>
                  {slides[activeSlide].bullets?.map((b, j) => (
                    <div key={j} style={{ fontSize: 15, padding: '6px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--c-primary)', flexShrink: 0 }}>●</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>

                {/* 講者筆記 */}
                <div className="card" style={{ borderColor: 'var(--c-accent)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--c-accent)' }}>{t('pres.speakerNotes')}</div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--c-text-muted)' }}>
                    {slides[activeSlide].speaker_notes}
                  </p>
                </div>

                {/* 前後頁導航 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
                  <button className="btn btn-secondary" disabled={activeSlide === 0}
                    onClick={() => setActiveSlide(activeSlide - 1)}>{t('pres.prevSlide')}</button>
                  <button className="btn btn-secondary" disabled={activeSlide === slides.length - 1}
                    onClick={() => setActiveSlide(activeSlide + 1)}>{t('pres.nextSlide')}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!slides && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('pres.empty')}</div>
          <p>{t('pres.emptyHint')}</p>
        </div>
      )}

      <StepNav projectId={projectId}
        prev={{ path: 'bid', label: t('pres.prev') }} />
    </>
  );
}

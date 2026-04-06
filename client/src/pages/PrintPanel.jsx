import StepNav from '../components/StepNav'
import { useLang } from '../LangContext'

export default function PrintPanel({ projectId }) {
  const { t } = useLang();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('print.title')}</h1>
          <p className="page-subtitle">{t('print.subtitle')}</p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="form-group">
          <label className="form-label">{t('print.copies')}</label>
          <input className="form-input" type="number" defaultValue={20} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">{t('print.paperSize')}</label>
            <select className="form-select" defaultValue="A4">
              <option>A4</option><option>A3</option><option>B4</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{t('print.binding')}</label>
            <select className="form-select" defaultValue="膠裝">
              <option>膠裝</option><option>騎馬釘</option><option>線裝</option><option>活頁</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{t('print.status')}</label>
          <select className="form-select" defaultValue="pending">
            <option value="pending">⏳ 待印</option>
            <option value="printing">印製中</option>
            <option value="done">已完成</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('print.notes')}</label>
          <textarea className="form-textarea" placeholder="特殊印製需求..." />
        </div>
        <button className="btn btn-primary">{t('print.saveBtn')}</button>
      </div>

      <StepNav projectId={projectId}
        prev={{ path: 'proposal', label: t('print.prev') }}
        next={{ path: 'bid', label: t('print.next') }} />
    </>
  );
}

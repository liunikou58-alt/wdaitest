import { useState, useEffect, useRef } from 'react'
import { useLang } from '../LangContext'
import { api } from '../api'
import StepNav from '../components/StepNav'

const getCATEGORIES = (t) => [
  { value: 'requirement', label: t('doc.cat.requirement') },
  { value: 'contract', label: t('doc.cat.contract') },
  { value: 'budget_sheet', label: '預算表' },
  { value: 'evaluation', label: t('doc.cat.evaluation') },
  { value: 'attachment', label: t('doc.cat.attachment') },
  { value: 'other', label: t('doc.cat.other') },
];

// 智能分類：根據檔名自動判斷文件類別
function autoDetectCategory(filename) {
  const name = (filename || '').toLowerCase();
  // 評審須知
  if (name.includes('評審') || name.includes('審查') || name.includes('評選') || name.includes('須知')) return 'evaluation';
  // 標價清單 / 預算表
  if (name.includes('標價') || name.includes('預算') || name.includes('報價') || name.includes('經費') || name.includes('價格')) return 'budget_sheet';
  // 契約
  if (name.includes('契約') || name.includes('合約') || name.includes('contract')) return 'contract';
  // 需求說明書
  if (name.includes('需求') || name.includes('說明') || name.includes('規格') || name.includes('服務建議')) return 'requirement';
  // 其他保持用戶選的
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function DocumentsPanel({ projectId, project }) {
  const { t } = useLang();
  const CATEGORIES = getCATEGORIES(t);
  const [docs, setDocs] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('requirement');
  const fileRef = useRef();

  // 文字需求（商業案用）
  const [textMode, setTextMode] = useState(false);
  const [textContent, setTextContent] = useState('');
  const [textReqs, setTextReqs] = useState([]);
  const [savingText, setSavingText] = useState(false);

  const isCommercial = project?.case_type === 'commercial';
  const isTender = !isCommercial;

  const loadDocs = () => {
    api.getDocuments(projectId).then(setDocs).catch(console.error);
  };

  const loadTextReqs = () => {
    api.getTextRequirements(projectId).then(setTextReqs).catch(() => setTextReqs([]));
  };

  useEffect(() => { loadDocs(); loadTextReqs(); }, [projectId]);

  const handleUpload = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      // 逐檔上傳，每個檔案自動偵測分類
      for (const file of Array.from(files)) {
        const detectedCat = autoDetectCategory(file.name) || category;
        await api.uploadDocuments(projectId, [file], detectedCat);
      }
      loadDocs();
    } catch (err) {
      alert(t('doc.uploadFail') + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async (docId) => {
    if (!confirm(t('doc.deleteConfirm'))) return;
    await api.deleteDocument(projectId, docId);
    loadDocs();
  };

  const handleSaveText = async () => {
    if (!textContent.trim()) return;
    setSavingText(true);
    try {
      await api.saveTextRequirement(projectId, textContent);
      setTextContent('');
      setTextMode(false);
      loadTextReqs();
    } catch (err) {
      alert('儲存失敗: ' + err.message);
    } finally {
      setSavingText(false);
    }
  };

  const handleDeleteText = async (id) => {
    if (!confirm('確定要刪除這筆文字需求？')) return;
    await api.deleteTextRequirement(projectId, id);
    loadTextReqs();
  };

  const hasContent = docs.length > 0 || textReqs.length > 0;

  // 文件完整性檢查
  const DOC_CHECKLIST = [
    { category: 'requirement', label: '需求說明書', icon: '📋', critical: true },
    { category: 'evaluation', label: '評審須知', icon: '📊', critical: true },
    { category: 'budget_sheet', label: '標價清單 / 預算表', icon: '💰', critical: true },
    { category: 'contract', label: '契約範本', icon: '📝', critical: false },
    { category: 'attachment', label: '附件資料', icon: '📎', critical: false },
  ];

  const categoryStatus = DOC_CHECKLIST.map(item => ({
    ...item,
    uploaded: docs.some(d => d.category === item.category),
    count: docs.filter(d => d.category === item.category).length,
  }));
  const missingCritical = categoryStatus.filter(c => c.critical && !c.uploaded);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('doc.title')}</h1>
          <p className="page-subtitle">
            {isCommercial
              ? '上傳相關文件，或直接貼上客戶對話紀錄 / 電話筆記讓 AI 分析'
              : t('doc.subtitle')}
          </p>
        </div>
      </div>

      {/* 模式切換（商案顯示） */}
      {isCommercial && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button className={`btn btn-sm ${!textMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTextMode(false)}>檔案上傳</button>
          <button className={`btn btn-sm ${textMode ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTextMode(true)}>文字貼上</button>
        </div>
      )}

      {/* 文字貼上模式 */}
      {textMode && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <label className="form-label">貼上客戶需求文字</label>
            <p style={{ fontSize: 12, color: 'var(--c-text-muted)', margin: '4px 0 12px' }}>
              可貼上 LINE 對話紀錄、電話筆記、客戶 Email 等內容，AI 會自動理解並分析需求
            </p>
          </div>
          <textarea className="form-textarea" value={textContent} onChange={e => setTextContent(e.target.value)}
            placeholder="例：\n公司/機關名稱：在宅醫療學會\n聯絡窗口：林小姐\n活動日期：預計八月中下旬\n地點：雲林或台中\n預算：18萬\n人數：15~20人\n需求：預計舉辦兩天一夜的醫療營隊..."
            style={{ minHeight: 200, fontSize: 14, lineHeight: 1.8 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setTextMode(false); setTextContent(''); }}>取消</button>
            <button className="btn btn-primary" onClick={handleSaveText} disabled={savingText || !textContent.trim()}>
              {savingText ? '⏳ 儲存中...' : '儲存需求文字'}
            </button>
          </div>
        </div>
      )}

      {/* 檔案上傳模式 */}
      {!textMode && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">{t('doc.category')}</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}>
            <div className="upload-zone-icon">{uploading ? '⏳' : ''}</div>
            <div className="upload-zone-text">
              {uploading ? t('doc.uploading') : t('doc.dropzone')}
            </div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.xlsx,.xls"
              style={{ display: 'none' }} onChange={e => handleUpload(e.target.files)} />
          </div>
        </div>
      )}

      {/* 文件完整性檢查（標案顯示） */}
      {isTender && docs.length > 0 && (
        <div className="card" style={{
          marginBottom: 24, padding: '20px 24px',
          borderLeft: missingCritical.length > 0 ? '4px solid #f59e0b' : '4px solid #10b981',
          background: missingCritical.length > 0 ? 'rgba(245,158,11,0.03)' : 'rgba(16,185,129,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: missingCritical.length > 0 ? '#b45309' : '#059669' }}>
              {missingCritical.length > 0
                ? `文件完整性檢查 — 缺少 ${missingCritical.length} 項核心文件`
                : '文件完整性檢查 — 核心文件齊全'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {categoryStatus.map(item => (
              <div key={item.category} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8,
                background: item.uploaded ? 'rgba(16,185,129,0.06)' : item.critical ? 'rgba(239,68,68,0.06)' : 'rgba(0,0,0,0.02)',
                border: item.uploaded ? '1px solid rgba(16,185,129,0.2)' : item.critical ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(0,0,0,0.05)',
              }}>
                <span style={{ fontSize: 16 }}>{item.uploaded ? '✅' : item.critical ? '❌' : '⬜'}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: item.uploaded ? '#059669' : item.critical ? '#dc2626' : 'var(--c-text-muted)' }}>
                    {item.label}
                  </div>
                  {item.uploaded && (
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{item.count} 份已上傳</div>
                  )}
                  {!item.uploaded && item.critical && (
                    <div style={{ fontSize: 11, color: '#dc2626' }}>建議上傳</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          {missingCritical.length > 0 && (
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 10, lineHeight: 1.6 }}>
              提示：上傳文件時請選擇正確的文件分類，AI 分析時會根據分類角色（需求書 / 評審須知 / 標價清單）進行差異化解讀。
            </div>
          )}
        </div>
      )}

      {/* 已儲存的文字需求 */}
      {textReqs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 8 }}>
            文字需求紀錄（{textReqs.length}）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {textReqs.map(tr => (
              <div key={tr.id} className="card" style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <pre style={{
                      fontSize: 13, color: 'var(--c-text-secondary)', whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit', margin: 0, lineHeight: 1.6,
                      maxHeight: 120, overflow: 'auto'
                    }}>{tr.content}</pre>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 8 }}>
                      {new Date(tr.created_at).toLocaleString('zh-TW')}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteText(tr.id)}></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件列表 */}
      {docs.length === 0 && textReqs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"></div>
          <div className="empty-state-title">{t('doc.empty')}</div>
          <p>{isCommercial ? '請上傳檔案或貼上客戶對話紀錄' : t('doc.emptyHint')}</p>
        </div>
      ) : docs.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 8 }}>
            已上傳文件（{docs.length}）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {docs.map(doc => (
              <div key={doc.id} className="card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>{doc.file_type === 'pdf' ? '' : doc.file_type === 'docx' ? '' : doc.file_type === 'xlsx' || doc.file_type === 'xls' ? '' : ''}</span>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{doc.filename}</div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                      {formatSize(doc.file_size)} · {CATEGORIES.find(c => c.value === doc.category)?.label || doc.category}
                    </div>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}></button>
              </div>
            ))}
          </div>
        </>
      )}

      <StepNav projectId={projectId}
        next={{ path: 'analysis', label: t('doc.next') }}
        nextDisabled={!hasContent} />
    </>
  );
}

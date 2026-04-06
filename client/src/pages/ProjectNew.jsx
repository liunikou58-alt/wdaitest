import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const EVENT_TYPES = [
  '晚會活動', '頒獎典禮', '宣導活動', '行銷活動', '記者會',
  '開工動土', '開幕剪綵', '年度活動', '家庭日/親子日', '產品宣傳',
  '尾牙/春酒', '運動會', '音樂祭', '論壇', '展覽/快閃櫃',
  '數位行銷', '輿情監測', '品牌推廣', '社群經營', '影音製作'
];

const INDUSTRY_OPTIONS = [
  '科技/半導體', '醫療/生技', '金融/保險', '零售/電商', '製造業',
  '教育/學術', '政府/公部門', '非營利組織', '餐飲/旅宿', '文創/媒體',
  '建設/營造', '能源/環保', '交通/物流', '其他'
];

const STEPS = [
  { title: '專案資料', subtitle: '填寫基本資訊與預算時程', icon: '' },
  { title: '確認送出', subtitle: '檢查資料後送出建立專案', icon: '' },
];

export default function ProjectNew() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    case_type: 'tender',       // 'tender' 標案 | 'commercial' 商案
    name: '',
    // 標案欄位
    agency: '',
    department: '',
    // 商案欄位
    company: '',
    company_industry: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    headcount: '',
    venue: '',
    // 共用欄位
    event_type: '晚會活動',
    budget: '',
    deadline: '',
    announcement_date: '',
    event_date: '',
    notes: '',
    lead_planner: ''
  });
  const [customIndustry, setCustomIndustry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [planners, setPlanners] = useState([]);

  useEffect(() => {
    api.getPlanners().then(setPlanners).catch(console.error);
  }, []);

  const isTender = form.case_type === 'tender';

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const project = await api.createProject({
        ...form,
        budget: form.budget ? Number(form.budget) : null,
        headcount: form.headcount ? Number(form.headcount) : null,
        lead_planner: form.lead_planner || null
      });
      navigate(`/project/${project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const canNext = () => {
    if (step === 0) {
      if (isTender) return form.name.trim() && form.agency.trim() && form.deadline;
      return form.name.trim() && form.company.trim();
    }
    return true;
  };

  const getSummaryItems = () => {
    const items = [
      { l: '案件類型', v: isTender ? '標案' : '商案', i: '' },
      { l: '專案名稱', v: form.name, i: '' },
    ];

    if (form.lead_planner) {
      const p = planners.find(p => p.id === form.lead_planner);
      items.push({ l: '主寫企劃', v: p?.display_name || '（未選）', i: '' });
    }

    if (isTender) {
      items.push(
        { l: '機關', v: form.agency, i: '' },
        { l: '科室', v: form.department || '（未填）', i: '' },
      );
    } else {
      items.push(
        { l: '公司', v: form.company, i: '' },
        { l: '公司產業', v: form.company_industry || '（未填）', i: '' },
        { l: '聯絡窗口', v: form.contact_name || '（未填）', i: '' },
        { l: '聯絡電話', v: form.contact_phone || '（未填）', i: '' },
      );
    }

    items.push(
      { l: '活動類型', v: form.event_type, i: '' },
      { l: '公告預算', v: form.budget ? `${Number(form.budget).toLocaleString()} 元` : '（未填）', i: '' },
      { l: '活動日期', v: form.event_date || '（未填）', i: '' },
    );

    if (isTender) {
      items.push(
        { l: '投標公告日', v: form.announcement_date || '（未填）', i: '' },
        { l: '投標截止日', v: form.deadline, i: '' },
      );
    } else {
      items.push(
        { l: '提案截止日', v: form.deadline || '（未填）', i: '' },
        { l: '活動人數', v: form.headcount || '（未填）', i: '' },
        { l: '活動地點', v: form.venue || '（未填）', i: '' },
      );
    }

    return items;
  };

  return (
    <div className="animate-fadeUp">
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <h1 className="page-title">新建專案</h1>
        <p className="page-subtitle">輕鬆建立標案或商業案件專案</p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div onClick={() => i < step && setStep(i)} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 9999,
              background: i === step ? 'linear-gradient(135deg, #8b5cf6, var(--c-primary))' : i < step ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.04)',
              color: i === step ? 'white' : i < step ? 'var(--c-success)' : 'var(--c-text-muted)',
              fontSize: 13, fontWeight: i === step ? 700 : 500,
              cursor: i < step ? 'pointer' : 'default',
              boxShadow: i === step ? '0 2px 12px rgba(139,92,246,0.3)' : 'none',
              transition: 'all 0.3s ease',
            }}>
              <span>{i < step ? '' : s.icon}</span>
              <span>{s.title}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 40, height: 2, background: i < step ? 'var(--c-success)' : 'rgba(139,92,246,0.1)', borderRadius: 2, transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <div className="card" style={{ maxWidth: 680, margin: '0 auto', padding: '36px 40px' }}>

        {step === 0 && (
          <div className="animate-fadeUp">
            {/* 案件類型切換 */}
            <div style={{ marginBottom: 28 }}>
              <label className="form-label" style={{ marginBottom: 12, display: 'block' }}>案件類型</label>
              <div style={{ display: 'flex', gap: 0, borderRadius: 12, overflow: 'hidden', border: '2px solid var(--c-border)' }}>
                {[
                  { value: 'tender', label: '標案（公部門）', desc: '政府採購 / 標案需求書' },
                  { value: 'commercial', label: '商案（企業）', desc: '企業客戶 / 電話筆記' }
                ].map(opt => (
                  <button key={opt.value} onClick={() => setForm({ ...form, case_type: opt.value })}
                    style={{
                      flex: 1, padding: '16px 20px', border: 'none', cursor: 'pointer',
                      background: form.case_type === opt.value
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08))'
                        : 'transparent',
                      borderRight: opt.value === 'tender' ? '1px solid var(--c-border)' : 'none',
                      transition: 'all 0.3s ease',
                    }}>
                    <div style={{
                      fontSize: 15, fontWeight: form.case_type === opt.value ? 700 : 500,
                      color: form.case_type === opt.value ? 'var(--c-primary)' : 'var(--c-text-secondary)',
                      marginBottom: 4,
                    }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{opt.desc}</div>
                    {form.case_type === opt.value && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--c-primary)', margin: '8px auto 0',
                        animation: 'pulse 1.5s ease infinite',
                      }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '20px 0 24px' }} />

            {/* 專案名稱 */}
            <div className="form-group">
              <label className="form-label">專案名稱 *</label>
              <input className="form-input" value={form.name} onChange={set('name')}
                placeholder={isTender ? '例：2026 大甲媽祖山海服務建議書' : '例：世芯電子 115年度尾牙活動'}
                style={{ fontSize: 15 }} />
            </div>

            {/* 主寫企劃 */}
            <div className="form-group">
              <label className="form-label">主寫企劃</label>
              <select className="form-select" value={form.lead_planner} onChange={set('lead_planner')}
                style={{ fontSize: 15 }}>
                <option value="">-- 請選擇主寫企劃 --</option>
                {planners.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>

            {/* 標案: 機關 + 科室 */}
            {isTender && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">機關 *</label>
                    <input className="form-input" value={form.agency} onChange={set('agency')}
                      placeholder="例：臺中市政府觀光旅遊局" style={{ fontSize: 15 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">科室</label>
                    <input className="form-input" value={form.department} onChange={set('department')}
                      placeholder="例：觀光行銷科" style={{ fontSize: 15 }} />
                  </div>
                </div>
                {(form.agency || form.department) && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 10, marginTop: 4,
                    background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.08)',
                    fontSize: 11, color: 'var(--c-primary)', lineHeight: 1.6,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 14 }}>&#x1F50D;</span>
                    <span>建立後，AI 將自動深度研究「{[form.agency, form.department].filter(Boolean).join(' / ')}」的業務背景、歷史活動、核心議題，讓後續主題發想和企劃書撰寫更具針對性。</span>
                  </div>
                )}
              </>
            )}

            {/* 商案: 公司 + 產業 */}
            {!isTender && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">公司名稱 *</label>
                    <input className="form-input" value={form.company} onChange={set('company')}
                      placeholder="例：世芯電子股份有限公司" style={{ fontSize: 15 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">公司產業</label>
                    {customIndustry ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="form-input" value={form.company_industry}
                          onChange={set('company_industry')} placeholder="輸入產業名稱" style={{ fontSize: 15, flex: 1 }} />
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => { setCustomIndustry(false); setForm({ ...form, company_industry: '' }); }}>選項</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select className="form-select" value={form.company_industry}
                          onChange={set('company_industry')} style={{ fontSize: 15, flex: 1 }}>
                          <option value="">-- 請選擇 --</option>
                          {INDUSTRY_OPTIONS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                        </select>
                        <button className="btn btn-secondary btn-sm"
                          onClick={() => setCustomIndustry(true)} title="自訂輸入"></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 聯絡窗口 */}
                <div style={{
                  background: 'rgba(139,92,246,0.03)', borderRadius: 12,
                  padding: '16px 20px', marginBottom: 16, border: '1px solid rgba(139,92,246,0.08)'
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 12 }}>
                    客戶聯絡資訊（選填）
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>聯絡窗口</label>
                      <input className="form-input" value={form.contact_name} onChange={set('contact_name')}
                        placeholder="例：林小姐" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>聯絡電話</label>
                      <input className="form-input" value={form.contact_phone} onChange={set('contact_phone')}
                        placeholder="例：0912-345-678" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12 }}>電子信箱</label>
                      <input className="form-input" value={form.contact_email} onChange={set('contact_email')}
                        placeholder="例：client@mail.com" />
                    </div>
                  </div>
                </div>
              </>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--c-border)', margin: '8px 0 20px' }} />

            {/* 活動類型 */}
            <div className="form-group">
              <label className="form-label">活動類型</label>
              <select className="form-select" value={form.event_type} onChange={set('event_type')}
                style={{ fontSize: 15 }}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* 預算 + 活動日期 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">公告預算（選填）</label>
                <input className="form-input" type="number" value={form.budget} onChange={set('budget')}
                  placeholder="金額（元）" style={{ fontSize: 15 }} />
              </div>
              <div className="form-group">
                <label className="form-label">活動日期（選填）</label>
                <input className="form-input" type="date" value={form.event_date} onChange={set('event_date')}
                  style={{ fontSize: 15 }} />
              </div>
            </div>

            {/* 標案: 公告日 + 截止日 */}
            {isTender && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">投標公告日（選填）</label>
                  <input className="form-input" type="date" value={form.announcement_date}
                    onChange={set('announcement_date')} style={{ fontSize: 15 }} />
                </div>
                <div className="form-group">
                  <label className="form-label">投標截止日 *</label>
                  <input className="form-input" type="date" value={form.deadline}
                    onChange={set('deadline')} style={{ fontSize: 15 }} />
                </div>
              </div>
            )}

            {/* 商案: 截止日 + 人數 + 地點 */}
            {!isTender && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">提案截止日（選填）</label>
                    <input className="form-input" type="date" value={form.deadline}
                      onChange={set('deadline')} style={{ fontSize: 15 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">活動人數（選填）</label>
                    <input className="form-input" type="number" value={form.headcount}
                      onChange={set('headcount')} placeholder="例：150" style={{ fontSize: 15 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">活動地點（選填）</label>
                    <input className="form-input" value={form.venue} onChange={set('venue')}
                      placeholder="例：台中" style={{ fontSize: 15 }} />
                  </div>
                </div>
              </>
            )}

            {/* 備註 */}
            <div className="form-group">
              <label className="form-label">備註（選填）</label>
              <textarea className="form-textarea" value={form.notes} onChange={set('notes')}
                placeholder="內部備忘、特殊注意事項..." />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fadeUp">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}></div>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>確認送出</h2>
              <p style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>檢查資料後送出建立專案</p>
            </div>
            <div style={{ background: 'rgba(139,92,246,0.04)', borderRadius: 16, padding: '20px 24px', marginBottom: 20 }}>
              {getSummaryItems().map(item => (
                <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
                  <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>{item.i} {item.l}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{item.v}</span>
                </div>
              ))}
            </div>
            {form.notes && (
              <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,0.05)', fontSize: 13, color: 'var(--c-text-secondary)' }}>
                {form.notes}
              </div>
            )}
          </div>
        )}

        {error && <p style={{ color: 'var(--c-danger)', fontSize: 13, marginTop: 16, textAlign: 'center', padding: '10px 14px', borderRadius: 12, background: 'rgba(239,68,68,0.05)' }}>{error}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          <button className="btn btn-secondary" onClick={() => step === 0 ? navigate('/') : setStep(step - 1)}>
            {step === 0 ? '← 取消' : '← 上一步'}
          </button>
          {step < 1 ? (
            <button className="btn btn-primary" disabled={!canNext()} onClick={() => setStep(step + 1)}>
              下一步 →
            </button>
          ) : (
            <button className="btn btn-accent" disabled={submitting} onClick={handleSubmit}
              style={{ padding: '12px 32px', fontSize: 15 }}>
              {submitting ? '⏳ 建立中...' : '建立專案'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

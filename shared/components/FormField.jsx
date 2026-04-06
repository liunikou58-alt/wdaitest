/**
 * FormField — 通用表單欄位元件
 * 
 * Props:
 *   label: string
 *   required: boolean
 *   type: 'text' | 'number' | 'date' | 'email' | 'select' | 'textarea' | 'color'
 *   value, onChange
 *   options: [{ value, label }] — for select
 *   placeholder, rows, min, max, step
 *   error: string
 */
export default function FormField({ label, required, type = 'text', value, onChange, options, placeholder, rows = 3, min, max, step, error, disabled }) {
  const id = `field-${label}`;
  const handleChange = (e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value);

  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label} {required && <span style={{ color: 'var(--c-danger)' }}>*</span>}</label>}

      {type === 'select' ? (
        <select id={id} className="form-select" value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
          <option value="">— 請選擇 —</option>
          {(options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={id} className="form-textarea" value={value || ''} onChange={handleChange} placeholder={placeholder} rows={rows} disabled={disabled} />
      ) : type === 'color' ? (
        <input id={id} type="color" value={value || '#6366f1'} onChange={handleChange} style={{ width: '100%', height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} disabled={disabled} />
      ) : (
        <input id={id} className="form-input" type={type} value={value ?? ''} onChange={handleChange}
          placeholder={placeholder} min={min} max={max} step={step} disabled={disabled}
          style={error ? { borderColor: 'var(--c-danger)' } : {}} />
      )}

      {error && <div style={{ fontSize: 11, color: 'var(--c-danger)', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

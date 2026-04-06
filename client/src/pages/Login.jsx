import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { useLang } from '../LangContext'

export default function Login() {
  const { login } = useAuth();
  const { t } = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try { await login(username, password); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #faf8ff 0%, #ede5ff 30%, #fce7f3 60%, #f5f0ff 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-15%', left: '-8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '40%', left: '60%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <form onSubmit={handleSubmit} className="animate-fadeUp" style={{
        background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(139, 92, 246, 0.1)',
        borderRadius: 28, padding: '52px 44px', width: 420,
        boxShadow: '0 20px 60px rgba(139, 92, 246, 0.1), 0 4px 20px rgba(0,0,0,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: 'white',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
          }}></div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#2d1b69', marginBottom: 6 }}>
            {t('login.welcome')}
          </h1>
          <p style={{ color: '#8b7fb8', fontSize: 13 }}>{t('login.subtitle')}</p>
        </div>

        <div className="form-group">
          <label className="form-label">{t('login.username')}</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)}
            placeholder={t('login.usernamePlaceholder')} autoFocus required
            style={{ fontSize: 15, padding: '14px 18px' }} />
        </div>

        <div className="form-group">
          <label className="form-label">{t('login.password')}</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder={t('login.passwordPlaceholder')} required
            style={{ fontSize: 15, padding: '14px 18px' }} />
        </div>

        {error && <p style={{ color: 'var(--c-danger)', fontSize: 13, marginBottom: 16, textAlign: 'center', padding: '8px 12px', borderRadius: 12, background: 'rgba(239,68,68,0.06)' }}>{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={loading}
          style={{
            width: '100%', justifyContent: 'center', padding: 14, fontSize: 16,
            borderRadius: 14, marginTop: 4,
            background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
          }}>
          {loading ? t('login.submitting') : t('login.submit')}
        </button>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#b8acd4', marginTop: 24 }}>
          {t('login.hint')}
        </p>
      </form>
    </div>
  );
}

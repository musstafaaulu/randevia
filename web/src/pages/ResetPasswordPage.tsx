import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';
import { FieldError } from '../components/FieldError';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordError =
    touched && password.length < 8 ? 'Şifre en az 8 karakter olmalı.' : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (password.length < 8) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Şifre sıfırlanamadı');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-layout">
          <AuthHero />
          <div className="auth-card">
            <h1>Geçersiz Bağlantı</h1>
            <p className="auth-subtitle">
              Bu sıfırlama bağlantısı geçersiz. "Şifremi unuttum" sayfasından yeni bir bağlantı
              isteyebilirsiniz.
            </p>
            <p className="auth-footer">
              <Link to="/sifremi-unuttum">Şifremi unuttum</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthHero />
        <div className="auth-card">
          <h1>Şifreyi Sıfırla</h1>
          {done ? (
            <>
              <p className="auth-subtitle">
                Şifreniz sıfırlandı. Artık yeni şifrenizle giriş yapabilirsiniz.
              </p>
              <button className="primary-button full-width" onClick={() => navigate('/giris')}>
                Giriş Yap
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-subtitle">Hesabınız için yeni bir şifre belirleyin.</p>

              {error && <div className="form-error">{error}</div>}

              <label>
                Yeni Şifre
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setTouched(true)}
                  autoComplete="new-password"
                />
                <FieldError message={passwordError} />
              </label>

              <button className="primary-button full-width" type="submit" disabled={submitting}>
                {submitting ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

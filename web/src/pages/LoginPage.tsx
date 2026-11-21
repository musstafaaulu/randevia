import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';
import { FieldError } from '../components/FieldError';
import { isValidEmail } from '../utils/validators';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/doktorlar" replace />;

  const emailError = touched.email
    ? !email
      ? 'E-posta gerekli.'
      : !isValidEmail(email)
        ? 'Geçerli bir e-posta adresi girin.'
        : undefined
    : undefined;
  const passwordError = touched.password && !password ? 'Şifre gerekli.' : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !isValidEmail(email) || !password) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const from = (location.state as { from?: { pathname: string } } | null)?.from;
      navigate(from?.pathname ?? '/doktorlar', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Giriş yapılamadı');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthHero />
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Giriş Yap</h1>
          <p className="auth-subtitle">Randevia hesabınızla devam edin.</p>

          {error && <div className="form-error">{error}</div>}

          <label>
            E-posta
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              autoComplete="email"
            />
            <FieldError message={emailError} />
          </label>

          <label>
            Şifre
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              autoComplete="current-password"
            />
            <FieldError message={passwordError} />
          </label>

          <button className="primary-button full-width" type="submit" disabled={submitting}>
            {submitting ? 'Giriş yapılıyor…' : 'Giriş Yap'}
          </button>

          <p className="auth-footer">
            Hesabınız yok mu? <Link to="/kayit">Kayıt olun</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

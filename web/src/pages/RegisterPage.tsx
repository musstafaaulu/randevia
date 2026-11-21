import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';
import { FieldError } from '../components/FieldError';
import { isValidEmail } from '../utils/validators';

type Touched = { name?: boolean; email?: boolean; password?: boolean };

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Touched>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/doktorlar" replace />;

  const nameError =
    touched.name && name.trim().length < 2 ? 'Ad en az 2 karakter olmalı.' : undefined;
  const emailError = touched.email
    ? !email
      ? 'E-posta gerekli.'
      : !isValidEmail(email)
        ? 'Geçerli bir e-posta adresi girin.'
        : undefined
    : undefined;
  const passwordError =
    touched.password && password.length < 8 ? 'Şifre en az 8 karakter olmalı.' : undefined;

  const hasErrors = Boolean(nameError || emailError || passwordError);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true });
    if (name.trim().length < 2 || !isValidEmail(email) || password.length < 8) return;
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/doktorlar', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kayıt oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthHero />
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Kayıt Ol</h1>
          <p className="auth-subtitle">
            Yeni hesaplar hasta olarak oluşturulur; doktor rolü yönetici tarafından atanır.
          </p>

          {error && <div className="form-error">{error}</div>}

          <label>
            Ad Soyad
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            <FieldError message={nameError} />
          </label>

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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              autoComplete="new-password"
            />
            <FieldError message={passwordError} />
          </label>

          <button
            className="primary-button full-width"
            type="submit"
            disabled={submitting || hasErrors}
          >
            {submitting ? 'Kayıt oluşturuluyor…' : 'Kayıt Ol'}
          </button>

          <p className="auth-footer">
            Zaten hesabınız var mı? <Link to="/giris">Giriş yapın</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

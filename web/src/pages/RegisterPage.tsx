import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/doktorlar" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label>
            E-posta
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          <label>
            Şifre
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          <button className="primary-button full-width" type="submit" disabled={submitting}>
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

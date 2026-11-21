import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';
import { FieldError } from '../components/FieldError';
import { isValidEmail } from '../utils/validators';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const emailError = touched
    ? !email
      ? 'E-posta gerekli.'
      : !isValidEmail(email)
        ? 'Geçerli bir e-posta adresi girin.'
        : undefined
    : undefined;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!isValidEmail(email)) return;
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İstek gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthHero />
        <div className="auth-card">
          <h1>Şifremi Unuttum</h1>
          {sent ? (
            <>
              <p className="auth-subtitle">
                E-posta adresiniz sistemde kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen
                kutunuzu kontrol edin.
              </p>
              <p className="auth-footer">
                <Link to="/giris">Giriş sayfasına dön</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-subtitle">
                Hesabınızla ilişkili e-posta adresini girin, size bir sıfırlama bağlantısı
                gönderelim.
              </p>

              {error && <div className="form-error">{error}</div>}

              <label>
                E-posta
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched(true)}
                  autoComplete="email"
                />
                <FieldError message={emailError} />
              </label>

              <button className="primary-button full-width" type="submit" disabled={submitting}>
                {submitting ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
              </button>

              <p className="auth-footer">
                <Link to="/giris">Giriş sayfasına dön</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

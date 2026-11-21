import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { ApiError } from '../api/client';
import { AuthHero } from '../components/AuthHero';
import { Spinner } from '../components/Spinner';

type Status = 'checking' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'error');
  const [error, setError] = useState<string | null>(null);
  const ranOnce = useRef(false);

  useEffect(() => {
    if (!token || ranOnce.current) return;
    ranOnce.current = true;
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'E-posta doğrulanamadı');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <AuthHero />
        <div className="auth-card">
          <h1>E-posta Doğrulama</h1>
          {status === 'checking' && <Spinner label="Doğrulanıyor…" />}
          {status === 'success' && (
            <p className="auth-subtitle">E-posta adresiniz doğrulandı, teşekkürler!</p>
          )}
          {status === 'error' && (
            <div className="form-error">{error ?? 'Bu doğrulama bağlantısı geçersiz.'}</div>
          )}
          <p className="auth-footer">
            <Link to="/doktorlar">Devam et</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

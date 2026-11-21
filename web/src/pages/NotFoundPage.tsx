import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page page-centered">
      <h1>Sayfa bulunamadı</h1>
      <p>Aradığınız sayfa mevcut değil.</p>
      <Link to="/" className="primary-button">
        Ana sayfaya dön
      </Link>
    </div>
  );
}

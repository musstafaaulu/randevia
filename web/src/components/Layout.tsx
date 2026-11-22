import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { EmailVerificationBanner } from './EmailVerificationBanner';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { ToastStack } from './ToastStack';
import { TopLoadingBar } from './TopLoadingBar';

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="app-shell">
      <TopLoadingBar />
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
            <img src="/favicon.svg" alt="" className="brand-icon" aria-hidden="true" />
            Randevia
          </Link>

          <button
            className="menu-toggle"
            aria-label="Menüyü aç/kapat"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>

          <nav className={menuOpen ? 'nav-links nav-links-open' : 'nav-links'}>
            {user && (
              <>
                <NavLink to="/doktorlar" onClick={() => setMenuOpen(false)}>
                  Doktorlar
                </NavLink>
                <NavLink to="/randevularim" onClick={() => setMenuOpen(false)}>
                  Randevularım
                </NavLink>
                {user.role === 'doctor' && (
                  <NavLink to="/doktor-paneli" onClick={() => setMenuOpen(false)}>
                    Doktor Paneli
                  </NavLink>
                )}
                {user.role === 'admin' && (
                  <NavLink to="/admin" onClick={() => setMenuOpen(false)}>
                    Admin Paneli
                  </NavLink>
                )}
              </>
            )}
          </nav>

          <div className="nav-actions">
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <Link to="/profilim" className="user-chip" onClick={() => setMenuOpen(false)}>
                  {user.name}
                </Link>
                <button className="secondary-button" onClick={logout}>
                  Çıkış
                </button>
              </>
            ) : (
              <>
                <Link to="/giris" className="secondary-button">
                  Giriş
                </Link>
                <Link to="/kayit" className="primary-button">
                  Kayıt Ol
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <EmailVerificationBanner />

      <main className="app-content">
        <div className="page-transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      <ToastStack />
    </div>
  );
}

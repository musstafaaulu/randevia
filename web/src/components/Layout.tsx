import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from './NotificationBell';
import { ToastStack } from './ToastStack';

export function Layout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
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
            {user ? (
              <>
                <NotificationBell />
                <span className="user-chip">{user.name}</span>
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

      <main className="app-content">
        <Outlet />
      </main>

      <ToastStack />
    </div>
  );
}

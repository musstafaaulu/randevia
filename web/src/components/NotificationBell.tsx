import { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="notification-bell">
      <button
        className="bell-button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Bildirimler"
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <span>Bildirimler</span>
            {unreadCount > 0 && (
              <button className="link-button" onClick={() => void markAllAsRead()}>
                Tümünü okundu say
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="bell-empty">Henüz bildiriminiz yok.</p>
          ) : (
            <ul className="bell-list">
              {notifications.map((notification) => (
                <li
                  key={notification._id}
                  className={notification.read ? 'bell-item' : 'bell-item bell-item-unread'}
                  onClick={() => !notification.read && void markAsRead(notification._id)}
                >
                  <strong>{notification.title}</strong>
                  <p>{notification.message}</p>
                  <time>{formatDate(notification.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

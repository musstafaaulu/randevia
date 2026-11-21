import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  listMyNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api/notifications';
import { useAuth } from '../auth/AuthContext';
import { useSocket } from '../socket/SocketContext';
import type { AppNotification } from '../types/api';

export interface Toast {
  id: string;
  title: string;
  message: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  toasts: Toast[];
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socket = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    listMyNotifications({ limit: 20 })
      .then((page) => {
        setNotifications(page.notifications);
        setUnreadCount(page.unreadCount);
      })
      .catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    function onNotification(payload: { notification: AppNotification; unreadCount: number }) {
      setNotifications((prev) => [payload.notification, ...prev]);
      setUnreadCount(payload.unreadCount);

      const toastId = payload.notification._id;
      setToasts((prev) => [
        ...prev,
        { id: toastId, title: payload.notification.title, message: payload.notification.message },
      ]);
      setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== toastId)), 6000);
    }

    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
    };
  }, [socket]);

  const markAsRead = useCallback(async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead, toasts, dismissToast }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider');
  return ctx;
}

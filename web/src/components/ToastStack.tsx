import { useNotifications } from '../context/NotificationContext';

export function ToastStack() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" onClick={() => dismissToast(toast.id)}>
          <strong>{toast.title}</strong>
          <p>{toast.message}</p>
        </div>
      ))}
    </div>
  );
}

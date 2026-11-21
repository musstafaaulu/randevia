import { apiRequest } from './client';
import type { AppNotification, Pagination } from '../types/api';

export function listMyNotifications(params: {
  page?: number;
  limit?: number;
}): Promise<{ notifications: AppNotification[]; unreadCount: number; pagination: Pagination }> {
  return apiRequest('/api/v1/notifications/me', { query: params });
}

export function markNotificationAsRead(id: string): Promise<{ notification: AppNotification }> {
  return apiRequest(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsAsRead(): Promise<{ modified: number }> {
  return apiRequest('/api/v1/notifications/read-all', { method: 'PATCH' });
}

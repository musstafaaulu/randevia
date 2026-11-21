import { apiRequest } from './client';
import type { Pagination, Role, User } from '../types/api';

export interface AuthResult {
  user: User;
  accessToken: string;
}

export function register(name: string, email: string, password: string): Promise<AuthResult> {
  return apiRequest('/api/v1/auth/register', { method: 'POST', body: { name, email, password } });
}

export function login(email: string, password: string): Promise<AuthResult> {
  return apiRequest('/api/v1/auth/login', { method: 'POST', body: { email, password } });
}

export function fetchMe(): Promise<{ user: User }> {
  return apiRequest('/api/v1/auth/me');
}

export function updateProfile(name: string): Promise<{ user: User }> {
  return apiRequest('/api/v1/auth/me', { method: 'PATCH', body: { name } });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest('/api/v1/auth/me/password', {
    method: 'PATCH',
    body: { currentPassword, newPassword },
  });
}

export function listUsers(params: {
  role?: Role;
  page?: number;
  limit?: number;
}): Promise<{ users: User[]; pagination: Pagination }> {
  return apiRequest('/api/v1/auth/users', { query: params });
}

export function updateUserRole(userId: string, role: Role): Promise<{ user: User }> {
  return apiRequest(`/api/v1/auth/users/${userId}/role`, { method: 'PATCH', body: { role } });
}

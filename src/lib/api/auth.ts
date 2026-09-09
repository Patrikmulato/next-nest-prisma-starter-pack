import { apiClient } from '@/lib/api/client';
import type { AuthCredentials, AuthResponse, AuthUser } from '@/types/auth';

export function register(credentials: AuthCredentials) {
  return apiClient.post<AuthResponse>('/api/auth/register', credentials);
}

export function login(credentials: AuthCredentials) {
  return apiClient.post<AuthResponse>('/api/auth/login', credentials);
}

export function refresh() {
  return apiClient.post<AuthResponse>('/api/auth/refresh');
}

export function getMe() {
  return apiClient.get<AuthUser>('/api/auth/me');
}

export function logout() {
  return apiClient.post<{ revoked: true }>('/api/auth/logout');
}

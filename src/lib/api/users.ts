import { apiClient } from '@/lib/api/client';
import type { User } from '@/types/user';

export function listUsers() {
  return apiClient.get<User[]>('/api/users');
}

export function deleteUserById(id: string) {
  return apiClient.delete<{ id: string; deleted: true }>(`/api/users/${id}`);
}

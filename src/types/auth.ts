export type UserRole = 'USER' | 'CREATOR' | 'ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

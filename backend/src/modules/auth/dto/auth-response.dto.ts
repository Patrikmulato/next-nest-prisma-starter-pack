import { UserRole } from '../../../../generated/prisma/index.js';

export class AuthResponseDto {
  accessToken!: string;
  user!: {
    id: string;
    email: string;
    role: UserRole;
  };
}

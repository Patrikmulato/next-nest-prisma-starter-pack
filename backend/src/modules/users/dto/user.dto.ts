export class UserDto {
  id!: string;
  email!: string;
  role!: 'USER' | 'CREATOR' | 'ADMIN';
  createdAt!: Date;
  updatedAt!: Date;
}

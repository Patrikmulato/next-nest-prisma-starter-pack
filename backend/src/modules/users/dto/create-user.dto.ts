import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const USER_ROLES = ['USER', 'CREATOR', 'ADMIN'] as const;

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: (typeof USER_ROLES)[number];
}

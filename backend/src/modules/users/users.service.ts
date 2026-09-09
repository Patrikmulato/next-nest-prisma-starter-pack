import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../../generated/prisma/index.js';
import { hashPassword } from '../../common/utils/password-hash';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UserDto } from './dto/user.dto.js';

@Injectable()
export class UsersService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  private toUserDto(user: {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  }): UserDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createUser(dto: CreateUserDto): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        role: dto.role ?? UserRole.USER,
        passwordHash: dto.password ? await hashPassword(dto.password) : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return this.toUserDto(created);
  }

  async getUserById(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserDto(user);
  }

  async listUsers(): Promise<UserDto[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return users.map((user) => this.toUserDto(user));
  }

  async deleteUserById(id: string, actorUserId: string): Promise<{ id: string; deleted: true }> {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const uploadedUsefulMapsCount = await this.prisma.usefulMap.count({
      where: { uploadedById: id },
    });

    if (uploadedUsefulMapsCount > 0) {
      throw new BadRequestException(
        'Cannot delete user with uploaded useful maps. Delete those useful maps first.'
      );
    }

    await this.prisma.user.delete({ where: { id } });
    return { id, deleted: true };
  }
}

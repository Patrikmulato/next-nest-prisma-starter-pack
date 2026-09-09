import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../../../generated/prisma/index.js';
import { hashPassword, verifyPassword } from '../../common/utils/password-hash.js';
import { getAppConfig } from '../../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  resolveAccessTokenSecret,
  resolveRefreshTokenSecret,
} from './auth.constants.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

type AuthUserWithSecrets = AuthUser & {
  passwordHash?: string | null;
  refreshTokenHash?: string | null;
};

type RefreshTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

type IssuedAuthSession = {
  response: AuthResponseDto;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  private readonly prisma: PrismaService;
  private readonly jwtService: JwtService;

  constructor(
    @Inject(PrismaService) prisma: PrismaService,
    @Inject(JwtService) jwtService: JwtService
  ) {
    this.prisma = prisma;
    this.jwtService = jwtService;
  }

  private roleForEmail(email: string, currentRole: UserRole = UserRole.USER): UserRole {
    return getAppConfig().adminEmails.has(email.trim().toLowerCase())
      ? UserRole.ADMIN
      : currentRole;
  }

  async register(dto: RegisterDto): Promise<IssuedAuthSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hashPassword(dto.password),
        role: this.roleForEmail(dto.email),
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    return this.issueAndPersistTokens(user);
  }

  async login(dto: LoginDto): Promise<IssuedAuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await verifyPassword(dto.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const role = this.roleForEmail(user.email, user.role);
    if (role !== user.role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }

    return this.issueAndPersistTokens({ ...user, role });
  }

  async refresh(refreshToken: string): Promise<IssuedAuthSession> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: resolveRefreshTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        refreshTokenHash: true,
      },
    });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const isValidRefreshToken = await verifyPassword(refreshToken, user.refreshTokenHash);
    if (!isValidRefreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.issueAndPersistTokens(user);
  }

  async logoutByRefreshToken(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: resolveRefreshTokenSecret(),
      });
    } catch {
      // An invalid or expired refresh token cannot be used anyway, so there is
      // nothing to revoke server-side. The cookie has already been cleared.
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { refreshTokenHash: true },
    });

    if (!user?.refreshTokenHash) {
      return;
    }

    const matchesCurrentSession = await verifyPassword(refreshToken, user.refreshTokenHash);
    if (!matchesCurrentSession) {
      return;
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { refreshTokenHash: null },
    });
  }

  private toAuthUser(user: AuthUserWithSecrets): AuthUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private async issueAndPersistTokens(user: AuthUserWithSecrets): Promise<IssuedAuthSession> {
    const safeUser = this.toAuthUser(user);
    const tokenPayload = {
      sub: safeUser.id,
      email: safeUser.email,
      role: safeUser.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(tokenPayload, {
        secret: resolveAccessTokenSecret(),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(tokenPayload, {
        secret: resolveRefreshTokenSecret(),
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    await this.prisma.user.update({
      where: { id: safeUser.id },
      data: {
        refreshTokenHash: await hashPassword(refreshToken),
      },
    });

    return {
      response: {
        accessToken,
        user: safeUser,
      },
      refreshToken,
    };
  }
}

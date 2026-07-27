import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrgRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/types/auth-user';
import { uniqueSlug } from '../common/utils/slug';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

type SafeUser = Prisma.UserGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    avatarUrl: true;
    createdAt: true;
    memberships: {
      select: {
        id: true;
        organizationId: true;
        role: true;
        organization: { select: { id: true; name: true; slug: true; logoUrl: true } };
      };
    };
  };
}>;

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtl: string;
  private readonly refreshTtl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessSecret = config.getOrThrow('JWT_ACCESS_SECRET');
    this.refreshSecret = config.getOrThrow('JWT_REFRESH_SECRET');
    this.accessTtl = config.get('JWT_ACCESS_TTL', '15m');
    this.refreshTtl = config.get('JWT_REFRESH_TTL', '7d');
  }

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('An account already exists for this email');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, name: dto.name.trim(), passwordHash },
      });
      if (dto.organizationName) {
        await tx.organization.create({
          data: {
            name: dto.organizationName.trim(),
            slug: uniqueSlug(dto.organizationName, 120),
            createdById: created.id,
            memberships: {
              create: { userId: created.id, role: OrgRole.ORG_ADMIN },
            },
          },
        });
      }
      return created;
    });
    return this.createSession(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    return this.createSession(user.id);
  }

  async refresh(rawToken?: string) {
    if (!rawToken) throw new UnauthorizedException('Refresh token is missing');
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(rawToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    const valid =
      stored &&
      !stored.revokedAt &&
      stored.expiresAt > new Date() &&
      stored.userId === payload.sub &&
      (await bcrypt.compare(rawToken, stored.tokenHash));
    if (!valid || !stored) throw new UnauthorizedException('Refresh token has been revoked');

    return this.createSession(stored.userId, stored.id);
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(rawToken, {
        secret: this.refreshSecret,
        ignoreExpiration: true,
      });
      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Clearing cookies is enough for malformed/expired tokens.
    }
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.safeUser(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async createSession(userId: string, rotatedTokenId?: string) {
    const user = await this.safeUser(userId);
    if (!user) throw new UnauthorizedException();

    const refreshId = randomUUID();
    const accessPayload: JwtPayload = { sub: user.id, email: user.email, type: 'access' };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: 'refresh',
      jti: refreshId,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtl as never,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl as never,
      }),
    ]);
    const decoded = this.jwt.decode(refreshToken) as { exp: number };
    const tokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.$transaction(async (tx) => {
      if (rotatedTokenId) {
        const claimed = await tx.refreshToken.updateMany({
          where: {
            id: rotatedTokenId,
            userId,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date() },
        });
        if (claimed.count !== 1) {
          throw new UnauthorizedException('Refresh token has already been used');
        }
      }
      await tx.refreshToken.create({
        data: {
          id: refreshId,
          userId,
          tokenHash,
          expiresAt: new Date(decoded.exp * 1000),
        },
      });
      if (rotatedTokenId) {
        await tx.refreshToken.update({
          where: { id: rotatedTokenId },
          data: { replacedByTokenId: refreshId },
        });
      }
    });

    return {
      user,
      accessToken,
      refreshToken,
      accessTokenExpiresIn: 15 * 60,
    };
  }

  private safeUser(userId: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            organizationId: true,
            role: true,
            organization: {
              select: { id: true, name: true, slug: true, logoUrl: true },
            },
          },
        },
      },
    });
  }
}

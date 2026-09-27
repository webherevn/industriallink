import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserStatus } from '@industriallink/contracts';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import type { AuthenticatedUser, JwtPayload } from './security.types';

/** Khoá tài khoản có hiệu lực với access token đang mở sau tối đa khoảng này. */
const STATUS_CACHE_MS = 30_000;
const STATUS_CACHE_MAX = 10_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly blockedCache = new Map<string, { blocked: boolean; at: number }>();

  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
    });
  }

  /** Giá trị trả về được Passport gắn vào request.user. */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (await this.isBlocked(payload.sub)) {
      throw new UnauthorizedException('Tài khoản đã bị khoá hoặc không còn tồn tại');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      displayName: payload.displayName,
      status: payload.status,
    };
  }

  private async isBlocked(userId: string): Promise<boolean> {
    const now = Date.now();
    const hit = this.blockedCache.get(userId);
    if (hit && now - hit.at < STATUS_CACHE_MS) return hit.blocked;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, isDeleted: true },
    });
    const blocked =
      !user ||
      user.isDeleted ||
      user.status === UserStatus.Locked ||
      user.status === UserStatus.Deleted;

    if (this.blockedCache.size >= STATUS_CACHE_MAX) this.blockedCache.clear();
    this.blockedCache.set(userId, { blocked, at: now });
    return blocked;
  }
}

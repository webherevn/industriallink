import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './public.decorator';

/** Guard JWT. Endpoint @Public() cho phép khách; nếu có token thì vẫn gán user. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override handleRequest<TUser>(
    err: Error | undefined,
    user: TUser,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return (user ?? null) as TUser;
    }
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}

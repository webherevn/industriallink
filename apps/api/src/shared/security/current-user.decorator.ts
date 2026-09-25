import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './security.types';

/** Lấy người dùng đã xác thực từ request (có thể undefined trên @Public()). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
  },
);

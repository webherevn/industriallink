import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Lấy Correlation-Id đã gắn bởi middleware. */
export const CorrelationId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<{ correlationId?: string }>();
  return req.correlationId ?? 'unknown';
});

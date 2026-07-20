import { Injectable, NestMiddleware } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { NextFunction, Request, Response } from 'express';
import { v7 as uuidv7 } from 'uuid';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Gắn Correlation-Id cho mọi request để lần theo toàn bộ luồng xử lý
 * (API -> Queue -> Worker -> Event). Nếu client đã gửi thì tôn trọng giá trị đó.
 * Đồng thời gắn lên span OTEL đang active (nếu có).
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers[CORRELATION_ID_HEADER];
    const correlationId = (Array.isArray(incoming) ? incoming[0] : incoming) || uuidv7();
    (req as Request & { correlationId: string }).correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    const span = trace.getSpan(context.active());
    span?.setAttribute('correlation.id', correlationId);

    next();
  }
}

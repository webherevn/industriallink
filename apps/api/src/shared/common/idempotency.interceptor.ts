import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Redis } from 'ioredis';
import { Observable, from, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { REDIS_CLIENT } from '../infrastructure/redis/redis.provider';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const TTL_SECONDS = 60 * 60 * 24; // 24h

/**
 * Chống xử lý trùng cho các POST quan trọng (tạo Job, Apply, Offer, thanh toán...).
 *
 * Client gửi header Idempotency-Key. Lần đầu: xử lý và cache kết quả.
 * Lần lặp lại cùng key: trả kết quả cũ (nếu xong) hoặc báo 409 (nếu đang xử lý).
 * Bật cho endpoint bằng cách gắn @UseInterceptors(IdempotencyInterceptor).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const headerValue = req.headers[IDEMPOTENCY_HEADER];
    const key = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!key || req.method !== 'POST') {
      return next.handle();
    }

    const redisKey = `idempotency:${key}`;

    return from(this.redis.get(redisKey)).pipe(
      switchMap((cached) => {
        if (cached === 'PROCESSING') {
          throw new ConflictException('Yêu cầu đang được xử lý (Idempotency-Key trùng)');
        }
        if (cached) {
          return of(JSON.parse(cached) as unknown);
        }
        return from(this.redis.set(redisKey, 'PROCESSING', 'EX', TTL_SECONDS, 'NX')).pipe(
          switchMap(() =>
            next.handle().pipe(
              tap((result) => {
                void this.redis.set(redisKey, JSON.stringify(result), 'EX', TTL_SECONDS);
              }),
            ),
          ),
        );
      }),
    );
  }
}

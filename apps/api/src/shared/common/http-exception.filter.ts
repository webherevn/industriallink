import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Định dạng lỗi trả về nhất quán, luôn kèm correlationId để debug. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { correlationId?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: unknown = 'Đã xảy ra lỗi hệ thống';
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as { message?: unknown }).message ?? res;
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}: ${String(exception)}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
    });
  }
}

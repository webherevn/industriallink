import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Trả message rõ hơn cho lỗi DB (thiếu cột, unique, FK…)
      if (exception.code === 'P2002') {
        message = 'Dữ liệu bị trùng (slug/email đã tồn tại)';
      } else if (exception.code === 'P2022') {
        message = 'Cơ sở dữ liệu thiếu cột — cần chạy migration';
      } else {
        message = `Lỗi dữ liệu (${exception.code})`;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      // Thường do Prisma Client chưa generate lại sau khi đổi schema
      const detail = exception.message.split('\n').find((l) => l.trim()) || exception.message;
      message = `Dữ liệu không hợp lệ với schema hiện tại (${detail.slice(0, 180)})`;
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${
          exception instanceof Error ? exception.stack || exception.message : String(exception)
        }`,
      );
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

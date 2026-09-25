import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { AppConfig } from './config/configuration';
import { AppModule } from './app.module';
import { startOtel } from './observability/otel';

async function bootstrap(): Promise<void> {
  await startOtel();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);

  // Nginx proxy — req.ip lấy từ X-Forwarded-For (tránh mọi user chung 1 bucket throttle)
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api/v1');
  // cross-origin: web (localhost:3000) cần fetch binary (avatar) từ API.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  const webOrigins = config.get('webOrigins', { infer: true });
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || webOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('inlink API')
    .setDescription('API nền tảng tuyển dụng công nghiệp tích hợp AI')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get('port', { infer: true });
  await app.listen(port);
  const logger = app.get(Logger);
  const otel = config.get('otel', { infer: true });
  logger.log(`inlink API chạy tại http://localhost:${port} (docs: /docs)`);
  if (otel.enabled) {
    logger.log(
      `OpenTelemetry: traces→${otel.otlpEndpoint} metrics→:${otel.metricsPort}/metrics`,
    );
  }
}

void bootstrap();

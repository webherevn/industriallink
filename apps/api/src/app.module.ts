import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'node:path';
import configuration from './config/configuration';
import { AllExceptionsFilter } from './shared/common/http-exception.filter';
import { CorrelationIdMiddleware } from './shared/common/correlation-id.middleware';
import { SharedModule } from './shared/shared.module';
import { AiModule } from './modules/ai/ai.module';
import { CopilotModule } from './modules/ai/copilot.module';
import { CandidateModule } from './modules/candidate/candidate.module';
import { CompanyModule } from './modules/company/company.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { NotificationModule } from './modules/notification/notification.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { SearchModule } from './modules/search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      // .env đặt ở gốc monorepo; hỗ trợ cả khi chạy từ apps/api.
      envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        autoLogging: true,
        customProps: (req) => ({ correlationId: (req as { correlationId?: string }).correlationId }),
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    SharedModule,
    AiModule,
    CopilotModule,
    KnowledgeModule,
    IdentityModule,
    CandidateModule,
    CompanyModule,
    RecruitmentModule,
    NotificationModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

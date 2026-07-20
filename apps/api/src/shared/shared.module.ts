import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppEventBus } from './events/event-bus';
import { AuditService } from './infrastructure/audit.service';
import { CodeGeneratorService } from './infrastructure/code-generator.service';
import { EmailService } from './infrastructure/email/email.service';
import { OpenSearchService } from './infrastructure/opensearch/opensearch.service';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { redisProvider } from './infrastructure/redis/redis.provider';
import { StorageService } from './infrastructure/storage/storage.service';
import { JwtStrategy } from './security/jwt.strategy';
import { PasswordService } from './security/password.service';

/**
 * Module hạ tầng dùng chung (@Global): Prisma, Redis, Storage, EventBus, Email, OpenSearch, Security.
 */
@Global()
@Module({
  imports: [ConfigModule, PassportModule, JwtModule.register({})],
  providers: [
    PrismaService,
    redisProvider,
    StorageService,
    CodeGeneratorService,
    AuditService,
    AppEventBus,
    PasswordService,
    JwtStrategy,
    EmailService,
    OpenSearchService,
  ],
  exports: [
    PrismaService,
    redisProvider,
    StorageService,
    CodeGeneratorService,
    AuditService,
    AppEventBus,
    PasswordService,
    JwtModule,
    EmailService,
    OpenSearchService,
  ],
})
export class SharedModule {}

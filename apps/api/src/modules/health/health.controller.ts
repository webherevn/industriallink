import { Controller, Get, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Redis } from 'ioredis';
import { AppEventBus } from '../../shared/events/event-bus';
import { OpenSearchService } from '../../shared/infrastructure/opensearch/opensearch.service';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { REDIS_CLIENT } from '../../shared/infrastructure/redis/redis.provider';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly openSearch: OpenSearchService,
    private readonly events: AppEventBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra tình trạng hệ thống (liveness)' })
  async check(): Promise<{
    status: string;
    db: string;
    redis: string;
    opensearch: string;
    rabbitmq: string;
    eventBus: string;
    time: string;
  }> {
    const [db, redis, opensearch, rabbitmq] = await Promise.all([
      this.pingDb(),
      this.pingRedis(),
      this.pingOpenSearch(),
      this.events.ping(),
    ]);
    return {
      status: 'ok',
      db,
      redis,
      opensearch,
      rabbitmq,
      eventBus: this.events.provider,
      time: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness: yêu cầu DB + Redis sẵn sàng (200/503)' })
  async ready(): Promise<{ status: string; db: string; redis: string; time: string }> {
    const [db, redis] = await Promise.all([this.pingDb(), this.pingRedis()]);
    if (db !== 'up' || redis !== 'up') {
      throw new HttpException(
        { status: 'not_ready', db, redis, time: new Date().toISOString() },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', db, redis, time: new Date().toISOString() };
  }

  private async pingDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async pingRedis(): Promise<'up' | 'down'> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }

  private async pingOpenSearch(): Promise<'up' | 'down' | 'disabled'> {
    if (!this.openSearch.enabled) return 'disabled';
    return (await this.openSearch.ping()) ? 'up' : 'down';
  }
}

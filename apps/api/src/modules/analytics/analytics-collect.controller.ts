import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { CollectHitDto } from './dto/collect-hit.dto';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsCollectController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('collect')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ghi một lượt xem trang (beacon, không cần đăng nhập)' })
  collect(@Body() dto: CollectHitDto, @Req() req: Request) {
    return this.analytics.collect(dto, req);
  }
}

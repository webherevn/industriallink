import { Module } from '@nestjs/common';
import { AnalyticsAdminController } from './analytics-admin.controller';
import { AnalyticsCollectController } from './analytics-collect.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  controllers: [AnalyticsCollectController, AnalyticsAdminController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

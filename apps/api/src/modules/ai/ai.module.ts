import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';

/**
 * AI Domain - độc lập với nghiệp vụ. Export AI Gateway ra ngoài.
 * AiSettingsController cho phép SuperAdmin đổi provider/API key runtime.
 */
@Module({
  controllers: [AiSettingsController],
  providers: [AiGatewayService, AiSettingsService],
  exports: [AiGatewayService, AiSettingsService],
})
export class AiModule {}

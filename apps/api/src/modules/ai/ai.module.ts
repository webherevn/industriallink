import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';

/**
 * AI Domain - độc lập với nghiệp vụ. Chỉ export AI Gateway ra ngoài.
 */
@Module({
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiModule {}

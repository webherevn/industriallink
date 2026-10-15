import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import type { BillingPublicConfig } from '@industriallink/contracts';

@ApiTags('Billing - Public')
@Controller('billing')
export class BillingPublicController {
  constructor(private readonly billing: BillingService) {}

  /**
   * Bundle cấu hình billing cho UI bảng giá public.
   * Endpoint này được phép truy cập không cần auth (chỉ trả về plan isActive=true).
   */
  @Get('public-config')
  @ApiOperation({ summary: 'Lấy cấu hình bảng giá công khai (gói, top-up, policy, tiền tệ)' })
  async getPublicConfig(): Promise<BillingPublicConfig> {
    return this.billing.getPublicConfig();
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CaptureCrmReferralRequest, CaptureCrmReferralResponse } from '@industriallink/contracts';
import { Public } from '../../shared/security/public.decorator';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@Controller('crm/referrals')
export class CrmReferralController {
  constructor(private readonly crm: CrmService) {}

  @Public()
  @Post('leads')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Khách để lại thông tin qua mã giới thiệu. Không gán gói.' })
  capture(@Body() body: CaptureCrmReferralRequest): Promise<CaptureCrmReferralResponse> {
    return this.crm.captureReferral(body);
  }
}

import { Body, Controller, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { CaptureCrmReferralRequest, CaptureCrmReferralResponse } from '@industriallink/contracts';
import type { AppConfig } from '../../config/configuration';
import { Public } from '../../shared/security/public.decorator';
import { CrmService } from './crm.service';
import {
  formatReferralCookie,
  REFERRAL_COOKIE,
  referralCookieClearOptions,
  referralCookieOptions,
} from './referral-cookie';

@ApiTags('CRM')
@Controller('crm/referrals')
export class CrmReferralController {
  constructor(
    private readonly crm: CrmService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('click')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Ghi cookie mã giới thiệu 14 ngày. Không tạo lead và không gán gói.' })
  async click(
    @Body() body: { code?: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<CaptureCrmReferralResponse> {
    const domain = this.config.get('cookieDomain', { infer: true });
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    const code = await this.crm.referralCodeForCookie(body?.code);
    if (code) {
      res.cookie(REFERRAL_COOKIE, formatReferralCookie(code), referralCookieOptions(isProd, domain));
    } else if (body?.code?.trim()) {
      res.clearCookie(REFERRAL_COOKIE, referralCookieClearOptions(isProd, domain));
    }
    return { ok: true };
  }

  @Public()
  @Post('leads')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Khách để lại thông tin qua mã giới thiệu. Không gán gói.' })
  capture(@Body() body: CaptureCrmReferralRequest): Promise<CaptureCrmReferralResponse> {
    return this.crm.captureReferral(body);
  }
}

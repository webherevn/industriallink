import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  AuthUserView,
  LoginResponse,
  TotpSetupResponse,
} from '@industriallink/contracts';
import { Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendLoginOtpDto } from './dto/resend-login-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { UpdateMfaDto } from './dto/update-mfa.dto';
import { VerifyLoginOtpDto } from './dto/verify-login-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { IdentityService } from './identity.service';

const REFRESH_COOKIE = 'il_refresh';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly identity: IdentityService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản (ứng viên hoặc nhà tuyển dụng)' })
  register(@Body() dto: RegisterDto, @Req() req: Request, @CorrelationId() correlationId: string) {
    return this.identity.register(dto, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('verify-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác thực OTP sau khi đăng ký' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.identity.verifyOtp(dto.email, dto.otp);
  }

  @Post('resend-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi lại OTP đăng ký (tối đa 3 lần / phút)' })
  resendOtp(
    @Body() dto: ResendOtpDto,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ) {
    return this.identity.resendOtp(dto.email, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đăng nhập — trả JWT hoặc challenge MFA (OTP email) nếu đã bật MFA',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ): Promise<LoginResponse> {
    const result = await this.identity.login(dto.email, dto.password, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (result.kind === 'mfa') {
      return result.response;
    }
    this.setRefreshCookie(res, result.refreshToken);
    return result.response;
  }

  @Post('verify-login-otp')
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác thực OTP MFA để hoàn tất đăng nhập' })
  async verifyLoginOtp(
    @Body() dto: VerifyLoginOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CorrelationId() correlationId: string,
  ): Promise<LoginResponse> {
    const { response, refreshToken } = await this.identity.verifyLoginOtp(dto.mfaToken, dto.otp, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, refreshToken);
    return response;
  }

  @Post('resend-login-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Gửi lại OTP MFA đăng nhập (tối đa 3 lần / phút)' })
  resendLoginOtp(
    @Body() dto: ResendLoginOtpDto,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ) {
    return this.identity.resendLoginOtp(dto.mfaToken, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cấp lại access token bằng refresh token trong cookie' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const result = await this.identity.refresh(token ?? '');
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, expiresIn: result.expiresIn };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Đăng xuất, thu hồi refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.identity.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { message: 'Đã đăng xuất' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thông tin người dùng hiện tại' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUserView> {
    return this.identity.getProfile(user);
  }

  @Patch('me/mfa')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Bật/tắt MFA (OTP email khi đăng nhập)' })
  setMfa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMfaDto,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<AuthUserView> {
    return this.identity.setMfaEnabled(user, dto.enabled, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('me/totp/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Khởi tạo TOTP: sinh secret + QR để quét bằng app xác thực' })
  setupTotp(@CurrentUser() user: AuthenticatedUser): Promise<TotpSetupResponse> {
    return this.identity.setupTotp(user);
  }

  @Post('me/totp/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Xác nhận mã TOTP đầu tiên → bật MFA phương thức TOTP' })
  confirmTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyTotpDto,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<AuthUserView> {
    return this.identity.confirmTotp(user, dto.code, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('me/totp/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'Tắt MFA TOTP' })
  disableTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<AuthUserView> {
    return this.identity.disableTotp(user, {
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: this.config.get('jwt', { infer: true }).refreshTtl * 1000,
    });
  }
}

import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseFilePipeBuilder,
  Put,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  UserRole,
  type CrmKycProfileView,
  type CrmKycReviewListView,
  type CrmKycReviewResultView,
  type CrmKycUploadResult,
  type ReviewCrmKycRequest,
  type UpdateCrmKycRequest,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CtvKycService, KYC_MAX_IMAGE_BYTES } from './ctv-kyc.service';

/** Cổng CTV — hồ sơ xác thực CCCD & ngân hàng của chính tài khoản đang đăng nhập. */
@ApiTags('CTV')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller(['ctv/kyc', 'partner/kyc'])
export class CtvKycSelfController {
  constructor(private readonly kyc: CtvKycService) {}

  @Get()
  @ApiOperation({ summary: 'Hồ sơ xác thực CCCD của CTV đang đăng nhập.' })
  myProfile(@CurrentUser() user: AuthenticatedUser): Promise<CrmKycProfileView> {
    return this.kyc.myProfile(user);
  }

  @Put()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Lưu hồ sơ xác thực. Cần đủ 2 ảnh CCCD và số CCCD 12 chữ số.' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCrmKycRequest,
  ): Promise<CrmKycProfileView> {
    return this.kyc.submit(user, body);
  }

  @Post('upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        side: { type: 'string', enum: ['front', 'back'] },
      },
    },
  })
  @ApiOperation({ summary: 'Tải ảnh CCCD mặt trước hoặc mặt sau. Lưu ở kho private.' })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: KYC_MAX_IMAGE_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Query('side') side: 'front' | 'back' = 'front',
  ): Promise<CrmKycUploadResult> {
    return this.kyc.uploadImage(user, side === 'back' ? 'back' : 'front', file);
  }

  @Get('image/:partnerId/:side')
  @Header('Cache-Control', 'private, no-store')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  @ApiOperation({ summary: 'Ảnh CCCD. Chỉ chính chủ hoặc kế toán CRM được xem.' })
  async image(
    @CurrentUser() user: AuthenticatedUser,
    @Param('partnerId') partnerId: string,
    @Param('side') side: 'front' | 'back',
  ): Promise<StreamableFile> {
    const result = await this.kyc.readImage(user, partnerId, side === 'back' ? 'back' : 'front');
    return new StreamableFile(result.buffer, {
      type: result.mime,
      disposition: 'inline',
    });
  }
}

/** CRM Admin — duyệt hồ sơ xác thực CTV. */
@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.SalesManager)
@Controller('crm/ctv/kyc')
export class CrmKycAdminController {
  constructor(private readonly kyc: CtvKycService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách hồ sơ xác thực CTV + số hồ sơ đang chờ duyệt.' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status = '',
    @Query('query') query = '',
  ): Promise<CrmKycReviewListView> {
    return this.kyc.reviewList(user, { status, query });
  }

  @Patch(':partnerId/review')
  @ApiOperation({ summary: 'Phê duyệt hoặc từ chối hồ sơ xác thực CTV.' })
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('partnerId') partnerId: string,
    @Body() body: ReviewCrmKycRequest,
  ): Promise<CrmKycReviewResultView> {
    return this.kyc.review(user, partnerId, body);
  }
}

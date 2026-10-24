import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { IdempotencyInterceptor } from '../../shared/common/idempotency.interceptor';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Public } from '../../shared/security/public.decorator';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { SubmitCompanyVerificationDto } from './dto/submit-company-verification.dto';
import { UpdateCompanyBrandDto } from './dto/update-company-brand.dto';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...RECRUITER_ROLES)
@Controller('companies')
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Tạo hồ sơ công ty (người tạo trở thành chủ sở hữu)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.companies.createCompany(user, dto, correlationId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Công ty của tôi' })
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.getMyCompany(user);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Sửa hồ sơ công ty (chỉ owner/admin)' })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCompanyDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.companies.updateMyCompany(user, dto, correlationId);
  }

  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên logo công ty (chỉ owner/admin)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.companies.uploadLogo(user, file);
  }

  @Patch('me/brand')
  @ApiOperation({ summary: 'Cập nhật nội dung trang công khai (banner chữ, văn hóa, phúc lợi)' })
  updateBrand(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyBrandDto) {
    return this.companies.updateBrand(user, dto);
  }

  @Post('me/banner')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải ảnh banner trang công ty' })
  uploadBanner(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    return this.companies.uploadBanner(user, file);
  }

  @Delete('me/banner')
  @ApiOperation({ summary: 'Gỡ ảnh banner trang công ty' })
  deleteBanner(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.deleteBanner(user);
  }

  @Post('me/culture')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Thêm ảnh văn hóa công ty' })
  uploadCulture(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
    @Body('caption') caption?: string,
  ) {
    return this.companies.uploadCulture(user, file, title, caption);
  }

  @Delete('me/culture/:itemId')
  @ApiOperation({ summary: 'Xóa một ảnh văn hóa' })
  deleteCulture(@CurrentUser() user: AuthenticatedUser, @Param('itemId') itemId: string) {
    return this.companies.deleteCulture(user, itemId);
  }

  @Get('me/logo')
  @ApiOperation({ summary: 'Lấy logo công ty của tôi (binary)' })
  @Header('Cache-Control', 'private, max-age=300')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getMyLogo(@CurrentUser() user: AuthenticatedUser): Promise<StreamableFile> {
    const logo = await this.companies.getMyLogoBuffer(user);
    if (!logo) {
      throw new NotFoundException('Chưa có logo công ty');
    }
    return new StreamableFile(logo.buffer, {
      type: logo.mime,
      disposition: 'inline',
    });
  }

  @Get('me/verification')
  @ApiOperation({ summary: 'Trạng thái xác minh NTD (huy hiệu do SuperAdmin cấp)' })
  getMyVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.getMyVerification(user);
  }

  @Post('me/verification')
  @ApiOperation({ summary: 'Gửi đơn xin xác minh — không tự bật verified / trustedEmployer' })
  submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitCompanyVerificationDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.companies.submitVerification(user, dto, correlationId);
  }

  @Get('me/members')
  @ApiOperation({ summary: 'Danh sách thành viên công ty của tôi' })
  listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.companies.listMembers(user);
  }

  @Post('me/members/invite')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Mời người dùng đã đăng ký vào công ty (chỉ owner/admin)' })
  inviteMember(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.companies.inviteMember(user, dto, correlationId);
  }

  @Delete('me/members/:id')
  @ApiOperation({ summary: 'Gỡ thành viên khỏi công ty (chỉ owner/admin)' })
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.companies.removeMember(user, id, correlationId);
  }

  @Get(':id/logo')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Logo công ty (binary, công khai trong app)' })
  @Header('Cache-Control', 'private, max-age=300')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getLogo(@Param('id') id: string): Promise<StreamableFile> {
    const logo = await this.companies.getCompanyLogoBuffer(id);
    if (!logo) {
      throw new NotFoundException('Chưa có logo công ty');
    }
    return new StreamableFile(logo.buffer, {
      type: logo.mime,
      disposition: 'inline',
    });
  }

  @Get(':id/banner')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Banner công ty (binary, công khai)' })
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getBanner(@Param('id') id: string): Promise<StreamableFile> {
    const banner = await this.companies.getCompanyBannerBuffer(id);
    if (!banner) throw new NotFoundException('Chưa có banner công ty');
    return new StreamableFile(banner.buffer, { type: banner.mime, disposition: 'inline' });
  }

  @Get(':id/culture/:itemId')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Ảnh văn hóa công ty (binary, công khai)' })
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getCulture(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<StreamableFile> {
    const image = await this.companies.getCompanyCultureBuffer(id, itemId);
    if (!image) throw new NotFoundException('Không tìm thấy ảnh văn hóa');
    return new StreamableFile(image.buffer, { type: image.mime, disposition: 'inline' });
  }

  @Get(':id/profile')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Hồ sơ công khai công ty (banner, việc làm, văn hóa…)' })
  getPublicProfile(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.companies.getPublicProfile(id, user);
  }

  @Get(':id')
  @Public()
  @Roles()
  @ApiOperation({ summary: 'Xem hồ sơ công ty theo id' })
  getById(@Param('id') id: string) {
    return this.companies.getById(id);
  }
}

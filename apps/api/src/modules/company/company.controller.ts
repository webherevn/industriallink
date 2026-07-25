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
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

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
  @Roles(
    UserRole.Candidate,
    UserRole.Recruiter,
    UserRole.HiringManager,
    UserRole.CompanyAdmin,
    UserRole.SuperAdmin,
  )
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

  @Get(':id/profile')
  @Roles(
    UserRole.Candidate,
    UserRole.Recruiter,
    UserRole.HiringManager,
    UserRole.CompanyAdmin,
    UserRole.SuperAdmin,
  )
  @ApiOperation({ summary: 'Hồ sơ công khai công ty (banner, việc làm, văn hóa…)' })
  getPublicProfile(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.companies.getPublicProfile(id, user);
  }

  @Get(':id')
  @Roles()
  @ApiOperation({ summary: 'Xem hồ sơ công ty theo id' })
  getById(@Param('id') id: string) {
    return this.companies.getById(id);
  }
}

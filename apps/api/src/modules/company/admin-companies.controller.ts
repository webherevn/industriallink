import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CompanyStatus, UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AdminCompaniesService } from './admin-companies.service';
import { ReviewCompanyVerificationDto } from './dto/review-company-verification.dto';
import { UpdateAdminCompanyDto } from './dto/update-admin-company.dto';

@ApiTags('Admin Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/companies')
export class AdminCompaniesController {
  constructor(private readonly adminCompanies: AdminCompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách công ty (SuperAdmin)' })
  @ApiQuery({ name: 'status', required: false, enum: CompanyStatus })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @Query('status') status?: CompanyStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminCompanies.list({
      status,
      q: q || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('verification')
  @ApiOperation({ summary: 'Hàng đợi xác minh NTD' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected', 'all'] })
  listVerification(@Query('status') status?: string) {
    const allowed = new Set(['pending', 'approved', 'rejected', 'all']);
    const next = allowed.has(status ?? '') ? status : 'pending';
    return this.adminCompanies.listVerification(next as 'pending' | 'approved' | 'rejected' | 'all');
  }

  @Post(':id/verification')
  @ApiOperation({ summary: 'Duyệt hoặc từ chối đơn xác minh NTD' })
  reviewVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewCompanyVerificationDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adminCompanies.reviewVerification(user, id, dto, correlationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết công ty + thành viên + tin' })
  get(@Param('id') id: string) {
    return this.adminCompanies.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Treo/cấm, chỉnh trust, bật verified / trustedEmployer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminCompanyDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.adminCompanies.update(user, id, dto, correlationId);
  }
}

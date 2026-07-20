import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CreateOfferDto, RespondOfferDto, UpdateOfferDto } from './dto/offer.dto';
import { OfferService } from './offer.service';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Offers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('offers')
export class OfferController {
  constructor(private readonly offers: OfferService) {}

  @Post()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Gửi đề nghị tuyển dụng (Offer) + email ứng viên' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOfferDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.offers.create(user, dto, correlationId);
  }

  @Get()
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Danh sách offer của công ty' })
  @ApiQuery({ name: 'jobId', required: false })
  @ApiQuery({ name: 'status', required: false })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
  ) {
    return this.offers.listForCompany(user, { jobId, status });
  }

  @Get('mine')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Offer dành cho tôi (ứng viên)' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.offers.listMine(user);
  }

  @Patch(':id')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Cập nhật / rút / ghi nhận phản hồi offer' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOfferDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.offers.update(user, id, dto, correlationId);
  }

  @Patch(':id/respond')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Ứng viên chấp nhận / từ chối đề nghị làm việc của mình' })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondOfferDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.offers.respond(user, id, dto, correlationId);
  }
}

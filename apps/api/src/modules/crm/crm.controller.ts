import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CreateCrmActivityRequest,
  type CreateCrmDealRequest,
  type CreateCrmLeadRequest,
  type CrmActivityView,
  type CrmBoard,
  type CrmDealView,
  type CrmLeadView,
  type CrmRenewalView,
  type MoveCrmDealRequest,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmService } from './crm.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('crm')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @Get('board')
  @ApiOperation({ summary: 'Phễu bán gói và danh sách lead' })
  board(): Promise<CrmBoard> {
    return this.crm.board();
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Khách sắp hết gói. Không đổi gói và không tạo đơn.' })
  renewals(): Promise<CrmRenewalView[]> {
    return this.crm.renewals();
  }

  @Post('leads')
  @ApiOperation({ summary: 'Tạo lead. Không tạo công ty và không gán gói.' })
  createLead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmLeadRequest,
  ): Promise<CrmLeadView> {
    return this.crm.createLead(user, body);
  }

  @Post('deals')
  @ApiOperation({ summary: 'Tạo deal gắn SKU hiện có. Không kích hoạt gói.' })
  createDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmDealRequest,
  ): Promise<CrmDealView> {
    return this.crm.createDeal(user, body);
  }

  @Post('activities')
  @ApiOperation({ summary: 'Ghi nhật ký chăm sóc cho lead hoặc deal' })
  createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmActivityRequest,
  ): Promise<CrmActivityView> {
    return this.crm.createActivity(user, body);
  }

  @Patch('deals/:id/stage')
  @ApiOperation({ summary: 'Đổi bước phễu. Bước Đã chốt không gán gói.' })
  moveDeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: MoveCrmDealRequest,
  ): Promise<CrmDealView> {
    return this.crm.moveDeal(user, id, body);
  }
}

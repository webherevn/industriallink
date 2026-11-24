import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CrmAiBriefResponse,
  type CrmAiJdDiagnosisResponse,
  type CrmAiOutreachRequest,
  type CrmAiOutreachResponse,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmAiService } from './crm-ai.service';

@ApiTags('CRM AI Copilot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager)
@Controller('crm/ai')
export class CrmAiController {
  constructor(private readonly crmAi: CrmAiService) {}

  @Post('companies/:id/brief')
  @ApiOperation({ summary: 'AI tóm tắt hồ sơ doanh nghiệp 30 giây & gợi ý mở lời trước khi gọi.' })
  brief(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') companyId: string,
  ): Promise<CrmAiBriefResponse> {
    return this.crmAi.companyBrief(user, companyId);
  }

  @Post('companies/:id/outreach')
  @ApiOperation({ summary: 'AI soạn tin nhắn Zalo / Email cá nhân hóa theo bối cảnh khách hàng.' })
  outreach(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') companyId: string,
    @Body() body: CrmAiOutreachRequest,
  ): Promise<CrmAiOutreachResponse> {
    return this.crmAi.draftOutreach(user, companyId, body);
  }

  @Post('companies/:id/jd-diagnosis')
  @ApiOperation({ summary: 'AI chẩn đoán & gợi ý tối ưu JD cho khách có ít/0 ứng viên.' })
  jdDiagnosis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') companyId: string,
  ): Promise<CrmAiJdDiagnosisResponse> {
    return this.crmAi.diagnoseCompanyJds(user, companyId);
  }
}

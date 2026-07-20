import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('candidates')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({
    summary:
      'AI Search ứng viên Sales B2B: ngôn ngữ tự nhiên + 5 bộ lọc chính + bộ lọc nâng cao',
  })
  @ApiQuery({ name: 'q', required: false, example: 'Kỹ sư kinh doanh HVAC miền Bắc' })
  @ApiQuery({ name: 'industries', required: false, description: 'CSV nhóm ngành' })
  @ApiQuery({ name: 'products', required: false, description: 'CSV sản phẩm đã bán' })
  @ApiQuery({ name: 'customerSegments', required: false })
  @ApiQuery({ name: 'b2bExperience', required: false })
  @ApiQuery({ name: 'regions', required: false })
  @ApiQuery({ name: 'customerDevStyle', required: false })
  @ApiQuery({ name: 'dealType', required: false })
  @ApiQuery({ name: 'jobReadiness', required: false })
  @ApiQuery({ name: 'languages', required: false })
  @ApiQuery({ name: 'requireB2License', required: false })
  @ApiQuery({ name: 'requireTravel', required: false })
  searchCandidates(
    @Query() query: Record<string, string | string[] | undefined>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const filters = SearchService.parseFilters(query);
    return this.search.searchCandidates(filters, user.tenantId);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { IdempotencyInterceptor } from '../../shared/common/idempotency.interceptor';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Public } from '../../shared/security/public.decorator';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { ApplicationService } from './application.service';
import { CreateJobDto } from './dto/create-job.dto';
import { ApplyJobDto } from './dto/apply-job.dto';
import { BroadcastEmailDto } from './dto/broadcast-email.dto';
import { GenerateJobDraftDto } from './dto/generate-job-draft.dto';
import { ParseJobDescriptionDto } from './dto/parse-job-description.dto';
import { EstimateSalaryDto } from './dto/estimate-salary.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobService } from './job.service';

const RECRUITER_ROLES = [UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin];

@ApiTags('Recruitment - Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobs: JobService,
    private readonly applications: ApplicationService,
  ) {}

  @Post()
  @Roles(...RECRUITER_ROLES)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Đăng tin tuyển dụng (nháp hoặc công khai)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateJobDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.createJob(user, dto, correlationId);
  }

  @Post('ai/draft')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({
    summary: 'AI gợi ý / chuẩn hoá nội dung tin tuyển dụng (mô tả, yêu cầu, kỹ năng)',
  })
  generateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateJobDraftDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.generateJobDraft(user, dto, correlationId);
  }

  @Post('ai/parse-from-text')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({
    summary: 'AI đọc JD dán text → 22 trường Sales hoặc 23 trường Kỹ thuật (không suy diễn)',
  })
  parseFromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ParseJobDescriptionDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.parseJobFromText(user, dto.text, correlationId, dto.jobTrack);
  }

  @Post('ai/parse-from-file')
  @Roles(...RECRUITER_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload JD PDF/DOCX/TXT → AI trích 22 trường Sales hoặc 23 trường Kỹ thuật',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        jobTrack: { type: 'string', enum: ['sales', 'technical'] },
      },
    },
  })
  parseFromFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { jobTrack?: string },
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.parseJobFromFile(user, file, correlationId, body?.jobTrack);
  }

  @Post('ai/salary')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Salary Engine: ước lương theo cấp bậc VN (Kinh doanh / Kỹ thuật)' })
  estimateSalary(@Body() dto: EstimateSalaryDto) {
    return this.jobs.estimateSalary(dto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Danh sách tin tuyển dụng đang mở (ứng viên duyệt việc)' })
  @ApiQuery({ name: 'keyword', required: false })
  @ApiQuery({ name: 'industry', required: false })
  @ApiQuery({ name: 'subIndustry', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'locations', required: false, description: 'CSV nhiều địa điểm' })
  @ApiQuery({ name: 'experienceBand', required: false })
  @ApiQuery({ name: 'jobLevel', required: false })
  @ApiQuery({ name: 'jobTrack', required: false })
  @ApiQuery({ name: 'salaryMin', required: false })
  @ApiQuery({ name: 'salaryMax', required: false })
  listPublished(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query('keyword') keyword?: string,
    @Query('industry') industry?: string,
    @Query('subIndustry') subIndustry?: string,
    @Query('role') role?: string,
    @Query('location') location?: string,
    @Query('locations') locations?: string,
    @Query('experienceBand') experienceBand?: string,
    @Query('jobLevel') jobLevel?: string,
    @Query('jobTrack') jobTrack?: string,
    @Query('salaryMin') salaryMin?: string,
    @Query('salaryMax') salaryMax?: string,
  ) {
    return this.jobs.listPublishedJobs({
      keyword,
      industry,
      subIndustry,
      role,
      location,
      locations,
      experienceBand,
      jobLevel,
      jobTrack,
      salaryMin: salaryMin != null && salaryMin !== '' ? Number(salaryMin) : undefined,
      salaryMax: salaryMax != null && salaryMax !== '' ? Number(salaryMax) : undefined,
      userId: user?.id,
    });
  }

  @Get('stats/positions')
  @Public()
  @ApiOperation({ summary: 'Vị trí đang tuyển theo ngành — lấy từ tin published trên nền tảng' })
  listPositionStats() {
    return this.jobs.listPublishedPositionStats();
  }

  @Get('mine')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Tin tuyển dụng của công ty tôi' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.listMyJobs(user);
  }

  @Get('bookmarks/mine')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Danh sách tin tuyển dụng đã lưu' })
  listBookmarks(@CurrentUser() user: AuthenticatedUser) {
    return this.jobs.listBookmarkedJobs(user);
  }

  @Post(':id/bookmark')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Lưu tin tuyển dụng' })
  addBookmark(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobs.addBookmark(user, id);
  }

  @Delete(':id/bookmark')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Bỏ lưu tin tuyển dụng' })
  removeBookmark(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.jobs.removeBookmark(user, id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Chi tiết tin tuyển dụng' })
  getOne(@CurrentUser() user: AuthenticatedUser | undefined, @Param('id') id: string) {
    return this.jobs.getJob(id, user);
  }

  @Patch(':id')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Cập nhật nội dung tin tuyển dụng' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateJobDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.updateJob(user, id, dto, correlationId);
  }

  @Patch(':id/status')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Đổi trạng thái tin (đăng / tạm dừng / đóng / nháp)' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.updateJobStatus(user, id, dto.status, correlationId);
  }

  @Delete(':id')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Xoá tin tuyển dụng (soft-delete)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.deleteJob(user, id, correlationId);
  }

  @Post(':id/publish')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Đăng công khai tin đang ở trạng thái nháp' })
  publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @CorrelationId() correlationId: string,
  ) {
    return this.jobs.publishJob(user, id, correlationId);
  }

  @Post(':id/apply')
  @Roles(UserRole.Candidate)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiOperation({ summary: 'Ứng viên ứng tuyển (AI tính điểm phù hợp)' })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApplyJobDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.applications.apply(user, id, dto, correlationId);
  }

  @Get(':id/applications')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Danh sách ứng viên đã ứng tuyển vào tin' })
  applicants(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.applications.listApplicants(user, id);
  }

  @Post(':id/broadcast-email')
  @Roles(...RECRUITER_ROLES)
  @ApiOperation({ summary: 'Gửi email hàng loạt tới ứng viên của tin (lọc status tùy chọn)' })
  broadcastEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BroadcastEmailDto,
    @CorrelationId() correlationId: string,
  ) {
    return this.applications.broadcastEmail(user, id, dto, correlationId);
  }
}

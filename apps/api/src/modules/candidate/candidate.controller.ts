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
  Query,
  StreamableFile,
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
import { JobTrack, UserRole } from '@industriallink/contracts';
import { CorrelationId } from '../../shared/common/correlation-id.decorator';
import { IdempotencyInterceptor } from '../../shared/common/idempotency.interceptor';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CandidateService } from './candidate.service';
import { CvDraftFromTextDto } from './dto/cv-draft-from-text.dto';
import { SaveCvDraftDto } from './dto/save-cv-draft.dto';
import { UpdateCandidateProfileDto } from './dto/update-candidate-profile.dto';

@ApiTags('Candidate')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidates: CandidateService) {}

  @Post('me/resumes')
  @Roles(UserRole.Candidate)
  @UseInterceptors(FileInterceptor('file'), IdempotencyInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên CV, kích hoạt AI phân tích (bất đồng bộ)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadResume(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @CorrelationId() correlationId: string,
  ) {
    return this.candidates.uploadResume(user, file, correlationId);
  }

  @Get('me/resumes/:id/status')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Trạng thái phân tích CV (poll cho màn hình AI Analysis)' })
  getResumeStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.getResumeStatus(user, id);
  }

  @Get('me/career')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Career Engine: lộ trình + khung lương theo cấp bậc VN' })
  @ApiQuery({ name: 'track', required: false, enum: JobTrack })
  getCareer(@CurrentUser() user: AuthenticatedUser, @Query('track') track?: JobTrack) {
    return this.candidates.getCareerAdvice(user, {
      track: track === JobTrack.Sales || track === JobTrack.Technical ? track : undefined,
    });
  }

  @Get('me')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Hồ sơ ứng viên của tôi (Dashboard)' })
  getMyCandidate(@CurrentUser() user: AuthenticatedUser) {
    return this.candidates.getMyCandidate(user);
  }

  @Patch('me')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Cập nhật toàn bộ hồ sơ ứng viên (chỉnh sửa hồ sơ)' })
  updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateCandidateProfileDto,
  ) {
    return this.candidates.updateMyProfile(user, body);
  }

  @Get('me/connections')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Danh sách yêu cầu kết nối tới tôi' })
  listMyConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.candidates.listMyConnections(user);
  }

  @Post('me/connections/:id/accept')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Đồng ý yêu cầu kết nối' })
  acceptConnection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.respondConnection(user, id, true);
  }

  @Post('me/connections/:id/reject')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Từ chối yêu cầu kết nối' })
  rejectConnection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.respondConnection(user, id, false);
  }

  @Get(':id')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Xem hồ sơ ứng viên (NTD, cùng tenant) — liên hệ ẩn đến khi kết nối' })
  getCandidateById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.getCandidateForRecruiter(user, id);
  }

  @Post(':id/connection')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Gửi yêu cầu kết nối ứng viên' })
  requestConnection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body?: { message?: string },
  ) {
    return this.candidates.requestConnection(user, id, body?.message);
  }

  @Post(':id/connection/cancel')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Huỷ yêu cầu kết nối đang chờ' })
  cancelConnection(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.cancelConnection(user, id);
  }

  @Post(':id/shortlist')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu CV vào shortlist công ty' })
  addShortlist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.addShortlist(user, id);
  }

  @Delete(':id/shortlist')
  @Roles(UserRole.Recruiter, UserRole.HiringManager, UserRole.CompanyAdmin, UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Bỏ lưu CV khỏi shortlist' })
  removeShortlist(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.candidates.removeShortlist(user, id);
  }

  @Post('me/cv-draft/from-text')
  @Roles(UserRole.Candidate)
  @ApiOperation({
    summary: 'Tạo bản nháp CV từ văn bản tự do (AI trích xuất + gợi ý trường thiếu)',
  })
  draftCvFromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CvDraftFromTextDto,
  ) {
    return this.candidates.draftCvFromText(user, body.text);
  }

  @Post('me/cv-draft/from-file')
  @Roles(UserRole.Candidate)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload file CV → AI trích xuất + gợi ý trường thiếu (đồng bộ)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  draftCvFromFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.candidates.draftCvFromFile(user, file);
  }

  @Post('me/cv-draft/save')
  @Roles(UserRole.Candidate)
  @ApiOperation({
    summary: 'Lưu bản nháp CV vào hồ sơ ứng viên (tuỳ chọn từ wizard tạo CV)',
  })
  saveCvDraft(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveCvDraftDto) {
    return this.candidates.saveCvDraftToProfile(user, body.draft);
  }

  @Post('me/avatar')
  @Roles(UserRole.Candidate)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Tải lên ảnh đại diện hồ sơ' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.candidates.uploadAvatar(user, file);
  }

  @Get('me/avatar')
  @Roles(UserRole.Candidate)
  @ApiOperation({ summary: 'Lấy ảnh đại diện đã tải lên (binary)' })
  @Header('Cache-Control', 'private, max-age=300')
  /** Cho phép web (origin khác) đọc binary qua fetch → blob URL. */
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async getAvatar(@CurrentUser() user: AuthenticatedUser): Promise<StreamableFile> {
    const avatar = await this.candidates.getAvatarBuffer(user);
    if (!avatar) {
      throw new NotFoundException('Chưa có ảnh đại diện tải lên');
    }
    return new StreamableFile(avatar.buffer, {
      type: avatar.mime,
      disposition: 'inline',
    });
  }
}

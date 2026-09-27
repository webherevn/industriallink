import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CmsContentStatus, CmsContentType, UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CmsService } from './cms.service';
import { SeoCrawlService } from './seo-crawl.service';
import { SeoLinksService } from './seo-links.service';
import { SeoSemanticService } from './seo-semantic.service';
import { SeoTrustService } from './seo-trust.service';
import { SeoVitalsService } from './seo-vitals.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import { SemanticAssistDto } from './dto/semantic-assist.dto';
import { StartCwvScanDto, UpdateCwvSettingsDto } from './dto/web-vitals.dto';
import { IndexingSubmitDto, UpdateIndexingSettingsDto } from './dto/indexing.dto';
import { GoogleIndexingService } from '../../shared/seo/google-indexing.service';
import { SaveCmsMenuDto } from './dto/save-cms-menu.dto';
import { UpdateCmsPostStatusDto } from './dto/update-cms-post-status.dto';
import { UpsertCmsAuthorProfileDto, AssignCmsAuthorProfileDto } from './dto/upsert-cms-author-profile.dto';
import { UpsertCmsCategoryDto } from './dto/upsert-cms-category.dto';
import { UpsertCmsFooterSettingsDto } from './dto/upsert-cms-footer.dto';
import { UpsertCmsHomepageSettingsDto } from './dto/upsert-cms-homepage.dto';
import { UpsertCmsPostDto } from './dto/upsert-cms-post.dto';
import { UpsertCmsRedirectDto } from './dto/upsert-cms-redirect.dto';
import { UpsertCmsRobotsSettingsDto } from './dto/upsert-cms-robots.dto';
import { UpsertCmsSiteCodeSettingsDto } from './dto/upsert-cms-site-code.dto';

@ApiTags('Admin CMS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Editor)
@Controller('admin/cms')
export class CmsAdminController {
  constructor(
    private readonly cms: CmsService,
    private readonly seoCrawl: SeoCrawlService,
    private readonly seoTrust: SeoTrustService,
    private readonly seoLinks: SeoLinksService,
    private readonly seoSemantic: SeoSemanticService,
    private readonly seoVitals: SeoVitalsService,
    private readonly aiSettings: AiSettingsService,
    private readonly googleIndexing: GoogleIndexingService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan CMS / SEO' })
  overview() {
    return this.cms.seoOverview();
  }

  @Get('crawl')
  @ApiOperation({ summary: 'Chỉ mục, sitemap, trang mồ côi, chuỗi redirect' })
  crawlReport() {
    return this.seoCrawl.report();
  }

  @Get('indexing/settings')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Khóa service account Google Indexing API' })
  indexingSettings() {
    return this.googleIndexing.settingsView();
  }

  @Put('indexing/settings')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu khóa service account và công tắc tự gửi' })
  updateIndexingSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateIndexingSettingsDto) {
    return this.googleIndexing.updateSettings(dto, user.id);
  }

  @Post('indexing/test')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Kiểm tra token và quyền Chủ sở hữu trong Search Console' })
  indexingTest() {
    return this.googleIndexing.test();
  }

  @Post('indexing/submit')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Gửi URL lên Google Indexing API (thủ công hoặc toàn bộ tin tuyển dụng)' })
  indexingSubmit(@Body() dto: IndexingSubmitDto) {
    return this.googleIndexing.submit(dto);
  }

  @Get('trust')
  @ApiOperation({ summary: 'Điểm E-E-A-T tác giả và kiểm tra schema JobPosting' })
  trustReport() {
    return this.seoTrust.report();
  }

  @Get('link-suggestions')
  @ApiOperation({ summary: 'Gợi ý liên kết nội bộ theo tiêu đề hoặc từ khóa' })
  linkSuggestions(@Query('q') q?: string, @Query('excludeId') excludeId?: string) {
    return this.seoLinks.suggestions(q || '', excludeId);
  }

  @Get('link-audit')
  @ApiOperation({ summary: 'Link nội bộ gãy và URL không còn trang' })
  linkAudit() {
    return this.seoLinks.audit();
  }

  @Get('semantic')
  @ApiOperation({ summary: 'Tỷ lệ chữ/HTML và độ phủ thực thể của nội dung đã xuất bản' })
  semanticReport() {
    return this.seoSemantic.report();
  }

  @Post('semantic/assist')
  @ApiOperation({ summary: 'Gợi ý thực thể và FAQ cho bài đang soạn' })
  semanticAssist(@Body() dto: SemanticAssistDto) {
    return this.seoSemantic.assist(dto);
  }

  @Get('vitals')
  @ApiOperation({ summary: 'Core Web Vitals theo URL: CrUX, đo thật trên inlink, Lighthouse' })
  vitalsReport(@Query('strategy') strategy?: string) {
    return this.seoVitals.report(strategy === 'desktop' ? 'desktop' : 'mobile');
  }

  @Post('vitals/scan')
  @ApiOperation({ summary: 'Chạy PageSpeed Insights cho danh sách URL (chạy nền)' })
  vitalsScan(@Body() dto: StartCwvScanDto) {
    return this.seoVitals.start(dto.strategy ?? 'mobile', dto.paths);
  }

  @Get('vitals/settings')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Khóa PageSpeed Insights và domain đo' })
  vitalsSettings() {
    return this.aiSettings.pagespeedView();
  }

  @Put('vitals/settings')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu khóa PageSpeed Insights và domain đo' })
  updateVitalsSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCwvSettingsDto) {
    return this.aiSettings.updatePagespeed(dto, user.id);
  }

  @Post('vitals/test')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Thử khóa PageSpeed Insights với trang chủ' })
  vitalsTest() {
    return this.seoVitals.test();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục CMS' })
  listCategories() {
    return this.cms.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục' })
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsCategoryDto) {
    return this.cms.createCategory(user, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Sửa danh mục' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertCmsCategoryDto,
  ) {
    return this.cms.updateCategory(user, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Xoá mềm danh mục' })
  deleteCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.deleteCategory(user, id);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Danh sách post/page (admin)' })
  listPosts(
    @Query('type') type?: CmsContentType,
    @Query('status') status?: CmsContentStatus,
    @Query('category') category?: string,
    @Query('trashed') trashed?: string,
  ) {
    return this.cms.listPostsAdmin({
      type,
      status,
      category,
      trashed: trashed === '1' || trashed === 'true',
    });
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Chi tiết post/page' })
  getPost(@Param('id') id: string) {
    return this.cms.getPostAdmin(id);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Tạo post/page' })
  createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsPostDto) {
    return this.cms.createPost(user, dto);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Sửa post/page' })
  updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertCmsPostDto,
  ) {
    return this.cms.updatePost(user, id, dto);
  }

  @Patch('posts/:id/status')
  @ApiOperation({ summary: 'Đổi trạng thái xuất bản' })
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCmsPostStatusDto,
  ) {
    return this.cms.setPostStatus(user, id, dto.status);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Xoá mềm post/page' })
  deletePost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.deletePost(user, id);
  }

  @Post('posts/:id/restore')
  @ApiOperation({ summary: 'Khôi phục post/page từ thùng rác' })
  restorePost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.restorePost(user, id);
  }

  @Get('redirects')
  @ApiOperation({ summary: 'Danh sách redirect 301' })
  listRedirects() {
    return this.cms.listRedirects();
  }

  @Post('redirects')
  @ApiOperation({ summary: 'Tạo/cập nhật redirect' })
  upsertRedirect(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsRedirectDto) {
    return this.cms.upsertRedirect(user, dto);
  }

  @Delete('redirects/:id')
  @ApiOperation({ summary: 'Xoá redirect' })
  deleteRedirect(@Param('id') id: string) {
    return this.cms.deleteRedirect(id);
  }

  @Get('menus/:location')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lấy menu theo vị trí (primary|footer)' })
  getMenu(@Param('location') location: string) {
    return this.cms.getMenuByLocation(location, true);
  }

  @Put('menus/:location')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu toàn bộ menu (kiểu WP Menus)' })
  saveMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('location') location: string,
    @Body() dto: SaveCmsMenuDto,
  ) {
    return this.cms.saveMenu(user, location, dto);
  }

  @Get('footer')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Cấu hình chân trang (Footer 1/2 + copyright)' })
  getFooter() {
    return this.cms.getFooterSettings();
  }

  @Put('footer')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu cấu hình chân trang' })
  saveFooter(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsFooterSettingsDto) {
    return this.cms.saveFooterSettings(user, dto);
  }

  @Get('homepage')
  @ApiOperation({ summary: 'SEO & hero trang chủ' })
  getHomepage() {
    return this.cms.getHomepageSettings();
  }

  @Put('homepage')
  @ApiOperation({ summary: 'Lưu SEO & hero trang chủ' })
  saveHomepage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsHomepageSettingsDto,
  ) {
    return this.cms.saveHomepageSettings(user, dto);
  }

  @Get('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'robots.txt (RankMath-style)' })
  getRobots() {
    return this.cms.getRobotsSettings();
  }

  @Put('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu robots.txt custom' })
  saveRobots(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsRobotsSettingsDto,
  ) {
    return this.cms.saveRobotsSettings(user, dto);
  }

  @Delete('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Xoá robots.txt custom → về mặc định' })
  deleteRobots(@CurrentUser() user: AuthenticatedUser) {
    return this.cms.deleteRobotsSettings(user);
  }

  @Get('site-code')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Insert Headers and Footers' })
  getSiteCode() {
    return this.cms.getSiteCodeSettings();
  }

  @Put('site-code')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu mã Header / Footer' })
  saveSiteCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsSiteCodeSettingsDto,
  ) {
    return this.cms.saveSiteCodeSettings(user, dto);
  }

  @Get('author-profiles')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Danh sách hồ sơ tác giả (SuperAdmin)' })
  listAuthorProfiles() {
    return this.cms.listAuthorProfiles();
  }

  @Get('author-profiles/eligible-users')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Tài khoản chưa có hồ sơ — để gán tác giả' })
  listEligibleAuthorUsers() {
    return this.cms.listUsersWithoutAuthorProfile();
  }

  @Get('author-profiles/:userId')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Chi tiết hồ sơ tác giả theo userId' })
  getAuthorProfileByUser(@Param('userId') userId: string) {
    return this.cms.getAuthorProfileAdmin(userId);
  }

  @Post('author-profiles')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Gán / tạo hồ sơ tác giả cho tài khoản' })
  assignAuthorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCmsAuthorProfileDto,
  ) {
    return this.cms.assignAuthorProfile(user, dto);
  }

  @Put('author-profiles/:userId')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Cập nhật hồ sơ tác giả (SuperAdmin)' })
  updateAuthorProfileByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpsertCmsAuthorProfileDto,
  ) {
    return this.cms.updateAuthorProfileAdmin(user, userId, dto);
  }

  @Get('author-profile')
  @ApiOperation({ summary: 'Hồ sơ tác giả của tài khoản đang đăng nhập' })
  getAuthorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.cms.getMyAuthorProfile(user);
  }

  @Put('author-profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ tác giả của chính mình' })
  updateAuthorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsAuthorProfileDto,
  ) {
    return this.cms.updateMyAuthorProfile(user, dto);
  }
}

import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type CmsMediaItem, type CmsMediaList } from '@industriallink/contracts';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';

const PREFIX = 'cms-media/';
const FILENAME_RE = /^[0-9a-f-]{20,}\.(jpg|jpeg|png|webp|gif)$/i;

function mimeOf(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

@ApiTags('Admin CMS Media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Editor)
@Controller('admin/cms/media')
export class AdminCmsMediaController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  @ApiOperation({ summary: 'Thư viện ảnh CMS (mới nhất trước)' })
  async list(): Promise<CmsMediaList> {
    const objects = await this.storage.listObjects(PREFIX);
    const items: CmsMediaItem[] = objects
      .map((obj) => {
        const filename = obj.key.slice(PREFIX.length);
        if (!FILENAME_RE.test(filename)) return null;
        return {
          filename,
          url: `/api/v1/cms/media/${filename}`,
          mime: mimeOf(filename),
          size: obj.size,
          updatedAt: obj.updatedAt.toISOString(),
        };
      })
      .filter((item): item is CmsMediaItem => item != null);
    return { items };
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Xoá một ảnh CMS khỏi storage' })
  async remove(@Param('filename') filename: string): Promise<{ message: string }> {
    if (!FILENAME_RE.test(filename)) {
      throw new BadRequestException('Tên file không hợp lệ');
    }
    await this.storage.deleteObject(`${PREFIX}${filename}`);
    return { message: 'Đã xoá ảnh' };
  }
}

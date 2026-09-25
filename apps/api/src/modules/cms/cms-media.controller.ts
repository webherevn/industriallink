import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { v7 as uuidv7 } from 'uuid';
import { StorageService } from '../../shared/infrastructure/storage/storage.service';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Public } from '../../shared/security/public.decorator';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_SIZE = 5 * 1024 * 1024;

@ApiTags('CMS Media')
@Controller('cms/media')
export class CmsMediaController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SuperAdmin, UserRole.Editor)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload ảnh CMS (nội dung / ảnh đại diện)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Thiếu file ảnh');
    if (!IMAGE_MIME.has(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận JPEG, PNG, WebP hoặc GIF');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('Ảnh vượt quá 5MB');
    }
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : file.mimetype === 'image/gif'
            ? 'gif'
            : 'jpg';
    const filename = `${uuidv7()}.${ext}`;
    const storageKey = `cms-media/${filename}`;
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);
    return {
      url: `/api/v1/cms/media/${filename}`,
      filename,
      mime: file.mimetype,
      size: file.size,
    };
  }

  @Public()
  @Get(':filename')
  @ApiOperation({ summary: 'Stream ảnh CMS công khai' })
  @Header('Cache-Control', 'public, max-age=86400')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  async get(@Param('filename') filename: string): Promise<StreamableFile> {
    if (!/^[0-9a-f-]{20,}\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      throw new BadRequestException('Tên file không hợp lệ');
    }
    const key = `cms-media/${filename}`;
    try {
      const buffer = await this.storage.getObject(key);
      const mime = filename.endsWith('.png')
        ? 'image/png'
        : filename.endsWith('.webp')
          ? 'image/webp'
          : filename.endsWith('.gif')
            ? 'image/gif'
            : 'image/jpeg';
      return new StreamableFile(buffer, { type: mime, disposition: 'inline' });
    } catch {
      throw new NotFoundException('Không tìm thấy ảnh');
    }
  }
}

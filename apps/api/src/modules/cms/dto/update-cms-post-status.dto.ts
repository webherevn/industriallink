import { CmsContentStatus } from '@industriallink/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateCmsPostStatusDto {
  @ApiProperty({ enum: CmsContentStatus })
  @IsEnum(CmsContentStatus)
  status!: CmsContentStatus;
}

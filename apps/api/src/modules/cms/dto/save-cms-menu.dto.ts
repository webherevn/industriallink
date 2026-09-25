import { CmsMenuLocation, type UpsertCmsMenuItemInput } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class UpsertCmsMenuItemDto implements UpsertCmsMenuItemInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  parentId?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiProperty({ example: '/viec-lam' })
  @IsString()
  @MinLength(1)
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  openInNewTab?: boolean;

  @ApiPropertyOptional({ enum: ['custom', 'page', 'post'] })
  @IsOptional()
  @IsString()
  objectType?: 'custom' | 'page' | 'post';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  objectId?: string | null;
}

export class SaveCmsMenuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiProperty({ type: [UpsertCmsMenuItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCmsMenuItemDto)
  items!: UpsertCmsMenuItemDto[];
}

export class CmsMenuLocationParam {
  @ApiProperty({ enum: CmsMenuLocation })
  @IsEnum(CmsMenuLocation)
  location!: CmsMenuLocation;
}

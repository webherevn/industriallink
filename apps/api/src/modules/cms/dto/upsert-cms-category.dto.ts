import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpsertCmsCategoryDto {
  @ApiProperty({ example: 'Lộ trình nghề' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ example: 'lo-trinh-nghe' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageUrl?: string | null;

  @ApiPropertyOptional({ example: 'index,follow' })
  @IsOptional()
  @IsString()
  robots?: string;
}

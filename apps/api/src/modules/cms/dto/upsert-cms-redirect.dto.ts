import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpsertCmsRedirectDto {
  @ApiProperty({ example: '/cam-nang/slug-cu' })
  @IsString()
  @MinLength(2)
  fromPath!: string;

  @ApiProperty({ example: '/cam-nang/slug-moi' })
  @IsString()
  @MinLength(2)
  toPath!: string;

  @ApiPropertyOptional({ default: 301 })
  @IsOptional()
  @IsInt()
  @Min(301)
  statusCode?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string | null;
}

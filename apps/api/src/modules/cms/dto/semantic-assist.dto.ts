import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SemanticAssistDto {
  @ApiProperty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  focusKeyword?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80_000)
  html!: string;

  @ApiPropertyOptional({ description: 'Đường dẫn công khai, ví dụ /cam-nang/slug. Chỉ nhận path nội bộ.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Matches(/^\/(?![/\\])[^\s?#]*$/)
  publicPath?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertCmsRobotsSettingsDto {
  @ApiProperty({ description: 'Nội dung robots.txt đầy đủ' })
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  content!: string;
}

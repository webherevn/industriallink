import { JobModerationDecision } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideJobModerationDto {
  @ApiProperty({ enum: JobModerationDecision })
  @IsEnum(JobModerationDecision)
  decision!: JobModerationDecision;

  @ApiPropertyOptional({ description: 'Ghi chú nội bộ / lý do' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

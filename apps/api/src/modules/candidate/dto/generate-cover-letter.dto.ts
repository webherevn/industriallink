import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateCoverLetterDto {
  @ApiPropertyOptional({ description: 'ID tin tuyển dụng mục tiêu trên Inlink (tùy chọn)' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ description: 'Tên vị trí ứng tuyển' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetRole?: string;

  @ApiPropertyOptional({ description: 'Tên công ty mục tiêu' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  targetCompany?: string;

  @ApiPropertyOptional({ enum: ['pro', 'enthusiastic', 'concise'] })
  @IsOptional()
  @IsIn(['pro', 'enthusiastic', 'concise'])
  tone?: 'pro' | 'enthusiastic' | 'concise';

  @ApiPropertyOptional({ enum: ['balanced', 'sales_kpi', 'technical'] })
  @IsOptional()
  @IsIn(['balanced', 'sales_kpi', 'technical'])
  focus?: 'balanced' | 'sales_kpi' | 'technical';
}

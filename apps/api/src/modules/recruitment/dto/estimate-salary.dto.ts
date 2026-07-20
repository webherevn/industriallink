import { JobLevelCode } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class EstimateSalaryDto {
  @ApiProperty({ enum: JobLevelCode, example: JobLevelCode.TechTeamLead })
  @IsEnum(JobLevelCode)
  jobLevel!: JobLevelCode;

  @ApiPropertyOptional({ example: 'Automation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'Đồng Nai' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Trưởng nhóm Kỹ thuật tự động hoá' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;
}

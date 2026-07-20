import { EmploymentType, JobLevelCode } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GenerateJobDraftDto {
  @ApiProperty({ example: 'Kỹ sư PLC / SCADA' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Automation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ enum: JobLevelCode, example: JobLevelCode.TechTeamLead })
  @IsOptional()
  @IsEnum(JobLevelCode)
  jobLevel?: JobLevelCode;

  @ApiPropertyOptional({ example: 'KCN Amata, Đồng Nai' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({
    example: 'Ưu tiên Siemens S7, làm việc theo ca, có ATLĐ',
    description: 'Gợi ý tự do cho AI',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hints?: string;

  @ApiPropertyOptional({ description: 'Bản mô tả hiện có — AI sẽ chuẩn hoá / làm rõ' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  existingDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  existingRequirements?: string;

  @ApiPropertyOptional({ description: 'Phúc lợi hiện có — AI sẽ chuẩn hoá / bổ sung' })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  existingBenefits?: string;

  @ApiPropertyOptional({ type: [String], example: ['PLC', 'SCADA'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingSkills?: string[];
}

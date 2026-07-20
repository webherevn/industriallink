import { EmploymentType, ExperienceBand, JobLevelCode } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class JobSkillInputDto {
  @ApiProperty({ example: 'PLC' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  weight?: number;
}

export class CreateJobDto {
  @ApiProperty({ example: 'Kỹ sư Cơ điện (M&E)' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ description: 'Quyền lợi & phúc lợi' })
  @IsOptional()
  @IsString()
  benefits?: string;

  @ApiPropertyOptional({ example: 'Automation' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'Kỹ thuật' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({
    enum: JobLevelCode,
    example: JobLevelCode.TechStaff,
  })
  @IsOptional()
  @IsEnum(JobLevelCode)
  jobLevel?: JobLevelCode;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 'Đồng Nai' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  headcount?: number;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ enum: ExperienceBand })
  @IsOptional()
  @IsEnum(ExperienceBand)
  experienceBand?: ExperienceBand;

  @ApiPropertyOptional({ example: 15000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 30000000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ type: [JobSkillInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JobSkillInputDto)
  skills?: JobSkillInputDto[];

  @ApiPropertyOptional({ default: false, description: 'true để đăng công khai ngay' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

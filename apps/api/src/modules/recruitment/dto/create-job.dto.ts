import { EmploymentType, ExperienceBand, JobLevelCode, JobTrack } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
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

export class JobSalesCriteriaDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productsSold?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerSegments?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dealTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sellingStages?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketsCovered?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationLevel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationMajor?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  driverLicenses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travelAbility?: string | null;

  @ApiPropertyOptional({ type: [String], description: 'Trường JD đánh dấu bắt buộc (lọc cứng)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hardFilters?: string[];

  @ApiPropertyOptional({ enum: [85, 100], description: 'Ngưỡng lọc cứng ngành: 85 gần, 100 đúng ngành' })
  @IsOptional()
  @IsIn([85, 100])
  industryHardMinS?: 85 | 100;
}

export class JobTechnicalCriteriaDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industries?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipmentSystems?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workEnvironments?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalWorkTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  autonomyLevel?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationLevel?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  educationMajor?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certificates?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  driverLicenses?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  travelAbility?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shiftFlexibility?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalTools?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentLiteracy?: string[];
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

  @ApiPropertyOptional({ example: 'Tự động hóa & Điều khiển' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'PLC' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  subIndustry?: string;

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

  @ApiPropertyOptional({ enum: JobTrack, example: JobTrack.Sales })
  @IsOptional()
  @IsEnum(JobTrack)
  jobTrack?: JobTrack;

  @ApiPropertyOptional({ type: () => JobSalesCriteriaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobSalesCriteriaDto)
  salesCriteria?: JobSalesCriteriaDto;

  @ApiPropertyOptional({ type: () => JobTechnicalCriteriaDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => JobTechnicalCriteriaDto)
  technicalCriteria?: JobTechnicalCriteriaDto;

  @ApiPropertyOptional({ default: false, description: 'true để đăng công khai ngay' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

import { InterviewStatus, InterviewType } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInterviewDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  applicationId!: string;

  @ApiProperty({ enum: InterviewType, example: InterviewType.Hr })
  @IsEnum(InterviewType)
  type!: InterviewType;

  @ApiProperty({ example: '2026-07-20T09:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'https://meet.google.com/xxx' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingLink?: string;

  @ApiPropertyOptional({ example: 'Phòng họp A - KCN Bắc Ninh' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'Nguyễn Thị Hương - HR' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Chuyển hồ sơ sang trạng thái Phỏng vấn nếu chưa',
  })
  @IsOptional()
  @IsBoolean()
  moveToInterview?: boolean;
}

export class UpdateInterviewDto {
  @ApiPropertyOptional({ enum: InterviewType })
  @IsOptional()
  @IsEnum(InterviewType)
  type?: InterviewType;

  @ApiPropertyOptional({ enum: InterviewStatus })
  @IsOptional()
  @IsEnum(InterviewStatus)
  status?: InterviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingLink?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  interviewerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

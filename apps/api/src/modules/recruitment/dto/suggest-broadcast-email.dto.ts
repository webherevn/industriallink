import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@industriallink/contracts';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsOptional } from 'class-validator';
import { BROADCAST_EMAIL_PURPOSES } from '../broadcast-email-suggest';

export class SuggestBroadcastEmailDto {
  @ApiProperty({ enum: BROADCAST_EMAIL_PURPOSES, example: 'progress' })
  @IsIn(BROADCAST_EMAIL_PURPOSES)
  purpose!: (typeof BROADCAST_EMAIL_PURPOSES)[number];

  @ApiPropertyOptional({ enum: ApplicationStatus, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(ApplicationStatus, { each: true })
  statuses?: ApplicationStatus[];
}

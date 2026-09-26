import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitCompanyVerificationDto {
  @ApiProperty({ description: 'Lý do / thông tin để SuperAdmin đối chiếu' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  note!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  askVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  askTrusted?: boolean;
}

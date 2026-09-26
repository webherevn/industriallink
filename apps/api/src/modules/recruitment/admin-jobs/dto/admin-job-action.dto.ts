import { AdminJobAction } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminJobActionDto {
  @ApiProperty({ enum: AdminJobAction })
  @IsEnum(AdminJobAction)
  action!: AdminJobAction;

  @ApiPropertyOptional({ description: 'Ghi chú nội bộ' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

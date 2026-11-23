import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: 'XOA TAI KHOAN', description: 'Chuỗi xác nhận bắt buộc' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  confirmText!: string;

  @ApiPropertyOptional({ example: 'Đã tìm được việc làm mới', description: 'Lý do đóng tài khoản (không bắt buộc)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

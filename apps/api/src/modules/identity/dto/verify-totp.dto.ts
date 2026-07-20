import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyTotpDto {
  @ApiProperty({ example: '123456', description: 'Mã 6 số từ ứng dụng xác thực' })
  @IsString()
  @Length(6, 6)
  code!: string;
}

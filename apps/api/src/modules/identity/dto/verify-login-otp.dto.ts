import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyLoginOtpDto {
  @ApiProperty({ description: 'Token MFA ngắn hạn nhận từ POST /auth/login' })
  @IsString()
  mfaToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp!: string;
}

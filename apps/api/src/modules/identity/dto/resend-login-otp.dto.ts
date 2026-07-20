import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ResendLoginOtpDto {
  @ApiProperty({ description: 'Token MFA ngắn hạn nhận từ POST /auth/login' })
  @IsString()
  mfaToken!: string;
}

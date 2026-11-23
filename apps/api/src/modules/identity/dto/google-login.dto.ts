import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@industriallink/contracts';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google ID Token (credential) từ Google Identity Services' })
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  idToken!: string;

  @ApiPropertyOptional({
    enum: [UserRole.Candidate, UserRole.Recruiter],
    description: 'Vai trò khi tạo tài khoản mới qua Google (mặc định candidate)',
  })
  @IsOptional()
  @IsIn([UserRole.Candidate, UserRole.Recruiter])
  role?: UserRole.Candidate | UserRole.Recruiter;
}

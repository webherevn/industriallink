import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CollectHitDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  visitorId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  sessionId!: string;

  @IsString()
  @MaxLength(600)
  path!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;

  /** Thời gian đã ở trang này. Gửi khi chuyển trang hoặc đóng tab. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30 * 60 * 1000)
  durationMs?: number;
}

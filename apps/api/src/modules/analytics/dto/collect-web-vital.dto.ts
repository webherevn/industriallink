import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CollectWebVitalDto {
  @IsString()
  @MaxLength(600)
  path!: string;

  @IsIn(['LCP', 'INP', 'CLS', 'FCP', 'TTFB'])
  name!: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB';

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(120_000)
  value!: number;

  @IsString()
  @Matches(/^[A-Za-z0-9._-]{4,100}$/)
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  navigationType?: string;
}

import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class StartCwvScanDto {
  @IsOptional()
  @IsIn(['mobile', 'desktop'])
  strategy?: 'mobile' | 'desktop';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  @Matches(/^\/(?![/\\])[^\s?#]*$/, { each: true })
  paths?: string[];
}

export class UpdateCwvSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^https?:\/\/[a-z0-9.-]+(:\d+)?\/?$/i, { message: 'Domain phải có dạng https://inlink.vn' })
  siteUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  autoScan?: boolean;
}

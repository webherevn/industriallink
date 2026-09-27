import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateIndexingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  credentialsJson?: string | null;

  @IsOptional()
  @IsBoolean()
  autoNotify?: boolean;
}

export class IndexingSubmitDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(600, { each: true })
  urls?: string[];

  @IsOptional()
  @IsIn(['jobs'])
  target?: 'jobs';

  @IsOptional()
  @IsIn(['URL_UPDATED', 'URL_DELETED'])
  type?: 'URL_UPDATED' | 'URL_DELETED';
}

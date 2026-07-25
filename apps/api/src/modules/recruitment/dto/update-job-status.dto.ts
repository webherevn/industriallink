import { JobStatus } from '@industriallink/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class UpdateJobStatusDto {
  @ApiProperty({
    enum: [JobStatus.Published, JobStatus.Paused, JobStatus.Closed, JobStatus.Draft],
  })
  @IsEnum(JobStatus)
  status!: JobStatus.Published | JobStatus.Paused | JobStatus.Closed | JobStatus.Draft;
}

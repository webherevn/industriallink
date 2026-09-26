import { Module } from '@nestjs/common';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminCompaniesService } from './admin-companies.service';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

/** Company Domain: hồ sơ doanh nghiệp và thành viên (nhà tuyển dụng). */
@Module({
  controllers: [CompanyController, AdminCompaniesController],
  providers: [CompanyService, AdminCompaniesService],
  exports: [CompanyService],
})
export class CompanyModule {}

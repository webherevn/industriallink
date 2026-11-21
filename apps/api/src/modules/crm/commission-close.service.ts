import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CrmService } from './crm.service';
import { CtvCommissionPolicyService } from './ctv-commission-policy.service';

/**
 * Tự chốt tháng đã qua hết ngày cuối, giờ Việt Nam.
 * Chạy mỗi giờ để vẫn chốt nếu API tắt đúng 00:10. Tháng đang diễn ra không bị chốt.
 */
@Injectable()
export class CommissionCloseService {
  private readonly logger = new Logger(CommissionCloseService.name);

  constructor(
    private readonly crm: CrmService,
    private readonly commissionPolicy: CtvCommissionPolicyService,
  ) {}

  /** Tự động kích hoạt chính sách hoa hồng đã đến ngày hiệu lực (SCHEDULED → ACTIVE). */
  @Cron('0 5 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async activateScheduledPolicies(): Promise<void> {
    const activated = await this.commissionPolicy.activateDuePolicies();
    if (activated > 0) {
      this.logger.log(`Đã tự động kích hoạt ${activated} chính sách hoa hồng CTV đến ngày hiệu lực.`);
    }
  }

  @Cron('0 10 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async closeFinishedMonth(): Promise<void> {
    await this.commissionPolicy.activateDuePolicies();
    const closed = await this.crm.autoCloseFinishedCommissionMonth();
    if (closed > 0) {
      this.logger.log(`Đã tự chốt hoa hồng của ${closed} cộng tác viên cho tháng đã kết thúc.`);
    }
  }

  /** Mỗi giờ trong ngày chi, nhưng chỉ gửi một lần nếu còn kỳ chờ chi. */
  @Cron('0 20 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async remindPayoutDay(): Promise<void> {
    const sent = await this.crm.remindCommissionPayoutDay();
    if (sent) this.logger.log('Đã nhắc ngày chi hoa hồng. Không trừ ví.');
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CrmService } from './crm.service';

/**
 * Tự chốt tháng đã qua hết ngày cuối, giờ Việt Nam.
 * Chạy mỗi giờ để vẫn chốt nếu API tắt đúng 00:10. Tháng đang diễn ra không bị chốt.
 */
@Injectable()
export class CommissionCloseService {
  private readonly logger = new Logger(CommissionCloseService.name);

  constructor(private readonly crm: CrmService) {}

  @Cron('0 10 * * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async closeFinishedMonth(): Promise<void> {
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

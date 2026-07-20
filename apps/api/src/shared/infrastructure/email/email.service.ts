import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../../config/configuration';
import type { EmailMessage, EmailProvider } from './email.types';
import { MockEmailProvider } from './mock.email.provider';
import { ResendEmailProvider } from './resend.email.provider';
import { SmtpEmailProvider } from './smtp.email.provider';

/**
 * Email Gateway — cửa duy nhất gửi email (OTP, mời PV…).
 * Provider: mock | smtp (Mailpit/Gmail…) | resend.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly provider: EmailProvider;
  readonly webOrigin: string;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    const email = this.config.get('email', { infer: true });
    this.webOrigin = email.webOrigin;
    this.provider = this.resolveProvider(email);
    this.logger.log(`Email Gateway dùng provider: ${this.provider.name}`);
  }

  private resolveProvider(email: AppConfig['email']): EmailProvider {
    switch (email.provider) {
      case 'smtp':
        return new SmtpEmailProvider(email.from, email.smtp);
      case 'resend':
        if (email.resendApiKey) {
          return new ResendEmailProvider(email.resendApiKey, email.from);
        }
        this.logger.warn('EMAIL_PROVIDER=resend nhưng thiếu RESEND_API_KEY → fallback mock');
        return new MockEmailProvider();
      default:
        return new MockEmailProvider();
    }
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.provider.send(message);
    } catch (err) {
      this.logger.error(`Gửi email thất bại (to=${message.to}): ${String(err)}`);
      throw err;
    }
  }

  /** Gửi an toàn: lỗi email không làm fail nghiệp vụ chính. */
  async sendSafe(message: EmailMessage): Promise<boolean> {
    try {
      await this.send(message);
      return true;
    } catch {
      return false;
    }
  }

  /** Gửi hàng loạt tuần tự; không dừng khi một email lỗi. */
  async sendMany(
    messages: EmailMessage[],
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const message of messages) {
      const ok = await this.sendSafe(message);
      if (ok) sent += 1;
      else failed += 1;
    }
    this.logger.log(`sendMany: sent=${sent} failed=${failed} total=${messages.length}`);
    return { sent, failed };
  }
}

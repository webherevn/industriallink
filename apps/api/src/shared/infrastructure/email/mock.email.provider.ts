import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from './email.types';

/** Provider mặc định: ghi log đầy đủ nội dung (dev / CI). */
export class MockEmailProvider implements EmailProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockEmailProvider.name);

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(
      `[mock email] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}

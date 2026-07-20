import { Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from './email.types';

/** Resend HTTP API — https://resend.com */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend lỗi ${res.status}: ${body}`);
    }

    const data = (await res.json()) as { id?: string };
    this.logger.log(`Đã gửi Resend → ${message.to} (id=${data.id ?? 'n/a'})`);
  }
}

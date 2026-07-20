import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { EmailMessage, EmailProvider } from './email.types';

export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly from: string,
    opts: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
    },
  ) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    this.logger.log(`Đã gửi SMTP → ${message.to} (messageId=${info.messageId})`);
  }
}

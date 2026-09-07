import nodemailer from 'nodemailer';
import type { EmailMessage, SendResult, EmailProvider } from './types.js';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
}

export class SmtpProvider implements EmailProvider {
  name = 'smtp';
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const info = await this.transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.reply_to,
        messageId: message.message_id,
        headers: message.headers,
      });
      return { success: true, message_id: info.messageId };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

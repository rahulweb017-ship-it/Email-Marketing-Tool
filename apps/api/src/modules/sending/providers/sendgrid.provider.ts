import type { EmailMessage, SendResult, EmailProvider } from './types.js';

interface SendGridConfig {
  api_key: string;
}

export class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor(config: SendGridConfig) {
    this.apiKey = config.api_key;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const response = await fetch(`${this.baseUrl}/mail/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: message.from },
          reply_to: message.reply_to ? { email: message.reply_to } : undefined,
          subject: message.subject,
          content: [
            ...(message.text ? [{ type: 'text/plain', value: message.text }] : []),
            { type: 'text/html', value: message.html },
          ],
          headers: message.headers,
          custom_args: message.message_id ? { message_id: message.message_id } : undefined,
        }),
      });

      if (response.status === 202) {
        const messageId = response.headers.get('x-message-id') || undefined;
        return { success: true, message_id: messageId };
      }

      const errorBody = await response.text();
      return { success: false, error: `SendGrid ${response.status}: ${errorBody}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    // SendGrid supports personalizations for batch, but for simplicity send individually
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/user/credits`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

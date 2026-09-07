import type { EmailMessage, SendResult, EmailProvider } from './types.js';

interface PostmarkConfig {
  server_token: string;
  message_stream?: string;
}

export class PostmarkProvider implements EmailProvider {
  name = 'postmark';
  private serverToken: string;
  private messageStream: string;
  private baseUrl = 'https://api.postmarkapp.com';

  constructor(config: PostmarkConfig) {
    this.serverToken = config.server_token;
    this.messageStream = config.message_stream || 'outbound';
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const body: Record<string, unknown> = {
        From: message.from,
        To: message.to,
        Subject: message.subject,
        HtmlBody: message.html,
        MessageStream: this.messageStream,
      };
      if (message.text) body.TextBody = message.text;
      if (message.reply_to) body.ReplyTo = message.reply_to;
      if (message.headers) {
        body.Headers = Object.entries(message.headers).map(([Name, Value]) => ({ Name, Value }));
      }

      const response = await fetch(`${this.baseUrl}/email`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': this.serverToken,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json() as { MessageID?: string; ErrorCode?: number; Message?: string };
        if (data.ErrorCode === 0) {
          return { success: true, message_id: data.MessageID, provider_response: data };
        }
        return { success: false, error: data.Message || 'Unknown Postmark error', provider_response: data };
      }

      const errorBody = await response.text();
      return { success: false, error: `Postmark ${response.status}: ${errorBody}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    // Postmark supports batch via /email/batch, but for simplicity send individually
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/server`, {
        headers: {
          'Accept': 'application/json',
          'X-Postmark-Server-Token': this.serverToken,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

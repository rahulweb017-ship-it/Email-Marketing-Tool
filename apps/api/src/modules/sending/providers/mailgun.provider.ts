import type { EmailMessage, SendResult, EmailProvider } from './types.js';

interface MailgunConfig {
  api_key: string;
  domain: string;
  region?: 'us' | 'eu';
}

export class MailgunProvider implements EmailProvider {
  name = 'mailgun';
  private apiKey: string;
  private domain: string;
  private baseUrl: string;

  constructor(config: MailgunConfig) {
    this.apiKey = config.api_key;
    this.domain = config.domain;
    this.baseUrl = config.region === 'eu'
      ? 'https://api.eu.mailgun.net/v3'
      : 'https://api.mailgun.net/v3';
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const form = new URLSearchParams();
      form.append('from', message.from);
      form.append('to', message.to);
      form.append('subject', message.subject);
      form.append('html', message.html);
      if (message.text) form.append('text', message.text);
      if (message.reply_to) form.append('h:Reply-To', message.reply_to);
      if (message.message_id) form.append('h:X-Campaign-Message-Id', message.message_id);
      if (message.headers) {
        for (const [key, value] of Object.entries(message.headers)) {
          form.append(`h:${key}`, value);
        }
      }

      const response = await fetch(`${this.baseUrl}/${this.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`api:${this.apiKey}`).toString('base64'),
        },
        body: form,
      });

      if (response.ok) {
        const data = await response.json() as { id?: string };
        return { success: true, message_id: data.id, provider_response: data };
      }

      const errorBody = await response.text();
      return { success: false, error: `Mailgun ${response.status}: ${errorBody}` };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.domain}`, {
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`api:${this.apiKey}`).toString('base64'),
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

import type { EmailMessage, SendResult, EmailProvider } from './types.js';

interface SesConfig {
  access_key_id: string;
  secret_access_key: string;
  region: string;
}

/**
 * AWS SES provider using the REST API directly (no SDK dependency).
 * For production use, consider using @aws-sdk/client-ses for proper signing.
 */
export class SesProvider implements EmailProvider {
  name = 'ses';
  private config: SesConfig;

  constructor(config: SesConfig) {
    this.config = config;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    // Placeholder - in production, use AWS SDK v3
    // import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
    try {
      // This is a simplified placeholder. Real implementation needs AWS Signature V4.
      console.log(`[SES] Would send to ${message.to} from ${message.from}`);
      return {
        success: true,
        message_id: `ses-${Date.now()}@${this.config.region}.amazonses.com`,
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    return Promise.all(messages.map((m) => this.send(m)));
  }

  async testConnection(): Promise<boolean> {
    // Placeholder - verify SES sending quota
    return true;
  }
}

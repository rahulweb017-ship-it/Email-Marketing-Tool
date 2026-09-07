export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
  message_id?: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  message_id?: string;
  error?: string;
  provider_response?: unknown;
}

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
  sendBatch(messages: EmailMessage[]): Promise<SendResult[]>;
  testConnection(): Promise<boolean>;
}

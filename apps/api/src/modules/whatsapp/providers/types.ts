export type OutboundType = 'text' | 'image' | 'document' | 'video' | 'template';

export interface OutboundMedia {
  url: string;
  filename?: string;
  mime?: string;
}

export interface OutboundMessage {
  /** E.164, e.g. +919876543210 */
  to: string;
  type: OutboundType;
  body?: string;
  media?: OutboundMedia;
  template?: {
    name: string;
    language: string;
    /** Ordered body parameters for {{1}}, {{2}}, ... */
    params: string[];
    /** Optional image/document header */
    headerMedia?: OutboundMedia & { kind: 'image' | 'document' | 'video' };
  };
}

export interface SendResult {
  providerMessageId: string;
}

export interface WhatsAppSender {
  readonly provider: 'meta_cloud' | 'web_qr';
  send(message: OutboundMessage): Promise<SendResult>;
}

export interface MetaCredentials {
  access_token: string;
  phone_number_id: string;
  waba_id: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components: Array<{ type: string; text?: string; format?: string; example?: unknown; buttons?: unknown[] }>;
  rejected_reason?: string;
}

/** Meta error codes that mean "stop sending from this number now" (spam / policy / quality). */
export const META_PAUSE_CODES = new Set([368, 131048, 131031, 131056]);

export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: number,
    /** Retrying the same message will not help (bad number, template rejected, outside window, ...) */
    public permanent: boolean = false,
    /** The account should be paused (spam limits, policy block, logged out, banned) */
    public pauseAccount: boolean = false,
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

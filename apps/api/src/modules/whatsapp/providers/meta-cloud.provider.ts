import { env } from '../../../config/env.js';
import { e164ToWaId } from '../../../shared/utils/phone.js';
import type { MetaCredentials, MetaTemplate, OutboundMessage, SendResult, WhatsAppSender } from './types.js';
import { META_PAUSE_CODES, WhatsAppApiError } from './types.js';

function graphUrl(path: string): string {
  return `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${path}`;
}

/** WhatsApp Cloud API (official). One instance per connected phone number. */
export class MetaCloudProvider implements WhatsAppSender {
  readonly provider = 'meta_cloud' as const;

  constructor(private creds: MetaCredentials) {}

  private async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const res = await fetch(graphUrl(path), {
      method,
      headers: {
        Authorization: `Bearer ${this.creds.access_token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({})) as any;
    if (!res.ok || data?.error) {
      const err = data?.error || {};
      const code: number | undefined = err.code;
      const message = err.error_user_msg || err.message || `Meta API error (${res.status})`;
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 429 && !META_PAUSE_CODES.has(code ?? -1);
      throw new WhatsAppApiError(message, res.status, code, permanent, META_PAUSE_CODES.has(code ?? -1) || code === 190);
    }
    return data as T;
  }

  async send(message: OutboundMessage): Promise<SendResult> {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: e164ToWaId(message.to),
      type: message.type,
    };

    switch (message.type) {
      case 'text':
        payload.text = { body: message.body || '', preview_url: true };
        break;
      case 'image':
      case 'video':
        payload[message.type] = { link: message.media!.url, caption: message.body || undefined };
        break;
      case 'document':
        payload.document = { link: message.media!.url, filename: message.media!.filename, caption: message.body || undefined };
        break;
      case 'template': {
        const t = message.template!;
        const components: unknown[] = [];
        if (t.headerMedia) {
          components.push({
            type: 'header',
            parameters: [{ type: t.headerMedia.kind, [t.headerMedia.kind]: { link: t.headerMedia.url, filename: t.headerMedia.filename } }],
          });
        }
        if (t.params.length) {
          components.push({ type: 'body', parameters: t.params.map((text) => ({ type: 'text', text })) });
        }
        payload.template = { name: t.name, language: { code: t.language }, components };
        break;
      }
    }

    const data = await this.request<{ messages: Array<{ id: string }> }>('POST', `${this.creds.phone_number_id}/messages`, payload);
    const id = data.messages?.[0]?.id;
    if (!id) throw new WhatsAppApiError('Meta did not return a message id', 502);
    return { providerMessageId: id };
  }

  async markRead(providerMessageId: string): Promise<void> {
    await this.request('POST', `${this.creds.phone_number_id}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: providerMessageId,
    });
  }

  /** Checks the token + phone number id and returns the number's public details. */
  async verify(): Promise<{ display_phone_number: string; verified_name: string; quality_rating?: string }> {
    return this.request('GET', `${this.creds.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`);
  }

  async listTemplates(): Promise<MetaTemplate[]> {
    const all: MetaTemplate[] = [];
    let path: string | null = `${this.creds.waba_id}/message_templates?limit=100&fields=id,name,language,status,category,components,rejected_reason`;
    while (path) {
      const page: any = await this.request('GET', path);
      all.push(...(page.data || []));
      const next: string | undefined = page.paging?.next;
      path = next ? next.replace(/^https:\/\/graph\.facebook\.com\/[^/]+\//, '') : null;
    }
    return all;
  }

  async createTemplate(input: { name: string; language: string; category: string; body: string; examples: string[] }): Promise<{ id: string; status: string }> {
    const bodyComponent: Record<string, unknown> = { type: 'BODY', text: input.body };
    if (input.examples.length) bodyComponent.example = { body_text: [input.examples] };
    return this.request('POST', `${this.creds.waba_id}/message_templates`, {
      name: input.name,
      language: input.language,
      category: input.category,
      components: [bodyComponent],
    });
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.request('DELETE', `${this.creds.waba_id}/message_templates?name=${encodeURIComponent(name)}`);
  }
}

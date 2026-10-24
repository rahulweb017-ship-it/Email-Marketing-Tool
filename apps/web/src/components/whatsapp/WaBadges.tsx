import Badge from '../ui/Badge';
import type { WaAccountStatus } from '../../api/whatsapp';

const accountStatus: Record<WaAccountStatus, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; pulse?: boolean }> = {
  connected: { label: 'Connected', variant: 'success', pulse: true },
  pending_qr: { label: 'Waiting for QR scan', variant: 'info' },
  disconnected: { label: 'Disconnected', variant: 'neutral' },
  logged_out: { label: 'Logged out', variant: 'warning' },
  paused: { label: 'Paused', variant: 'warning' },
  banned: { label: 'Blocked by WhatsApp', variant: 'danger' },
  error: { label: 'Error', variant: 'danger' },
};

export function AccountStatusBadge({ status }: { status: WaAccountStatus }) {
  const s = accountStatus[status] || { label: status, variant: 'neutral' as const };
  return <Badge variant={s.variant} pulse={s.pulse}>{s.label}</Badge>;
}

const campaignState: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; pulse?: boolean }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  queued: { label: 'Preparing', variant: 'info', pulse: true },
  sending: { label: 'Sending', variant: 'info', pulse: true },
  paused: { label: 'Paused', variant: 'warning' },
  done: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
  failed: { label: 'Failed', variant: 'danger' },
};

export function CampaignStateBadge({ state }: { state: string }) {
  const s = campaignState[state] || { label: state, variant: 'neutral' as const };
  return <Badge variant={s.variant} pulse={s.pulse}>{s.label}</Badge>;
}

const templateStatus: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  APPROVED: 'success', PENDING: 'warning', IN_APPEAL: 'warning', REJECTED: 'danger', PAUSED: 'warning', DISABLED: 'danger',
};

export function TemplateStatusBadge({ status }: { status: string }) {
  return <Badge variant={templateStatus[status] || 'neutral'}>{status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' ')}</Badge>;
}

export function ProviderBadge({ provider }: { provider: 'meta_cloud' | 'web_qr' }) {
  return provider === 'meta_cloud'
    ? <Badge variant="info">Meta Cloud API</Badge>
    : <Badge variant="neutral">QR linked</Badge>;
}

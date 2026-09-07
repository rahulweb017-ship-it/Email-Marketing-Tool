export const CAMPAIGN_STATES = ['draft', 'in_queue', 'sending', 'done', 'cancelled'] as const;
export const CAMPAIGN_TYPES = ['email', 'sms'] as const;
export const SCHEDULE_TYPES = ['now', 'scheduled'] as const;

export const TRACE_STATUSES = [
  'outgoing', 'processing', 'pending', 'sent',
  'opened', 'replied', 'bounced', 'error', 'cancelled',
] as const;

export const FAILURE_TYPES = [
  'unknown', 'email_invalid', 'email_missing', 'from_invalid',
  'smtp_error', 'blacklisted', 'opted_out', 'duplicate',
  'provider_error', 'rate_limited', 'complaint',
] as const;

export const AUTOMATION_STATES = ['draft', 'running', 'stopped'] as const;

export const ACTIVITY_TYPES = ['email', 'sms', 'action', 'wait', 'condition'] as const;

export const TRIGGER_TYPES = [
  'begin', 'activity_completed',
  'mail_opened', 'mail_not_opened',
  'mail_replied', 'mail_not_replied',
  'mail_clicked', 'mail_not_clicked',
  'mail_bounced',
  'tag_added', 'field_updated',
  'segment_entered', 'segment_exited',
] as const;

export const INTERVAL_UNITS = ['minutes', 'hours', 'days', 'weeks', 'months'] as const;

export const PARTICIPANT_STATES = ['running', 'completed', 'removed'] as const;

export const AUTOMATION_TRACE_STATES = ['scheduled', 'processed', 'rejected', 'cancelled', 'error'] as const;

export const SENDING_PROVIDERS = ['smtp', 'sendgrid', 'ses'] as const;

export const USER_ROLES = ['admin', 'manager', 'user'] as const;

/** Trigger types that cancel their opposite when fired */
export const TRIGGER_CANCEL_MAP: Record<string, string> = {
  mail_opened: 'mail_not_opened',
  mail_clicked: 'mail_not_clicked',
  mail_replied: 'mail_not_replied',
};

/** Trigger types whose schedule depends on parent, not external action */
export const RESCHEDULE_TRIGGER_TYPES = new Set([
  'activity_completed', 'begin',
  'mail_not_opened', 'mail_not_clicked', 'mail_not_replied',
]);

export const EMAIL_SEND_BATCH_SIZE = 500;
export const AUTOMATION_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const AUTOMATION_EXECUTE_INTERVAL_MS = 60 * 1000;   // 1 minute
export const STATS_FLUSH_INTERVAL_MS = 30 * 1000;          // 30 seconds

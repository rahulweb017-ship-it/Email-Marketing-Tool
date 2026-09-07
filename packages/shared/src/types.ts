import type {
  CAMPAIGN_STATES, CAMPAIGN_TYPES, TRACE_STATUSES, FAILURE_TYPES,
  AUTOMATION_STATES, ACTIVITY_TYPES, TRIGGER_TYPES, INTERVAL_UNITS,
  PARTICIPANT_STATES, AUTOMATION_TRACE_STATES, SENDING_PROVIDERS, USER_ROLES,
} from './constants';

export type CampaignState = typeof CAMPAIGN_STATES[number];
export type CampaignType = typeof CAMPAIGN_TYPES[number];
export type TraceStatus = typeof TRACE_STATUSES[number];
export type FailureType = typeof FAILURE_TYPES[number];
export type AutomationState = typeof AUTOMATION_STATES[number];
export type ActivityType = typeof ACTIVITY_TYPES[number];
export type TriggerType = typeof TRIGGER_TYPES[number];
export type IntervalUnit = typeof INTERVAL_UNITS[number];
export type ParticipantState = typeof PARTICIPANT_STATES[number];
export type AutomationTraceState = typeof AUTOMATION_TRACE_STATES[number];
export type SendingProvider = typeof SENDING_PROVIDERS[number];
export type UserRole = typeof USER_ROLES[number];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  email: string;
  email_normalized: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  country_code: string | null;
  custom_fields: Record<string, unknown>;
  is_blacklisted: boolean;
  message_bounce: number;
  created_at: string;
  updated_at: string;
}

export interface MailingList {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  is_double_optin: boolean;
  is_active: boolean;
  contact_count: number;
  contact_count_active: number;
  contact_count_opt_out: number;
  contact_count_blacklisted: number;
  created_at: string;
}

export interface Subscription {
  id: string;
  contact_id: string;
  list_id: string;
  opt_out: boolean;
  opt_out_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string | null;
  subject: string;
  preview_text: string | null;
  email_from: string;
  reply_to: string | null;
  body_html: string | null;
  body_design: Record<string, unknown> | null;
  state: CampaignState;
  campaign_type: CampaignType;
  schedule_type: 'now' | 'scheduled';
  schedule_date: string | null;
  sent_date: string | null;
  ab_test_enabled: boolean;
  ab_test_percentage: number;
  use_blacklist: boolean;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_source: string | null;
  // Denormalized stats
  stat_total: number;
  stat_sent: number;
  stat_delivered: number;
  stat_opened: number;
  stat_clicked: number;
  stat_replied: number;
  stat_bounced: number;
  stat_failed: number;
  stat_unsubscribed: number;
  created_at: string;
  updated_at: string;
}

export interface MailingTrace {
  id: string;
  campaign_id: string;
  contact_id: string;
  email: string;
  message_id: string | null;
  trace_status: TraceStatus;
  failure_type: FailureType | null;
  failure_reason: string | null;
  sent_at: string | null;
  first_open_at: string | null;
  last_open_at: string | null;
  first_click_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  open_count: number;
  click_count: number;
  created_at: string;
}

export interface TrackedLink {
  id: string;
  campaign_id: string | null;
  original_url: string;
  short_code: string;
  click_count: number;
  unique_click_count: number;
  created_at: string;
}

export interface EmailBlacklist {
  id: string;
  org_id: string;
  email: string;
  email_normalized: string;
  is_active: boolean;
  reason: string | null;
  added_by: string | null;
  created_at: string;
}

export interface AutomationCampaign {
  id: string;
  org_id: string;
  name: string;
  state: AutomationState;
  target_filter: unknown[];
  unique_field: string;
  running_participant_count: number;
  completed_participant_count: number;
  last_sync_at: string | null;
  created_at: string;
}

export interface AutomationActivity {
  id: string;
  campaign_id: string;
  parent_id: string | null;
  name: string;
  activity_type: ActivityType;
  trigger_type: TriggerType;
  interval_number: number;
  interval_unit: IntervalUnit;
  has_validity: boolean;
  validity_duration_number: number;
  validity_duration_unit: IntervalUnit;
  activity_filter: unknown[];
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface AutomationParticipant {
  id: string;
  campaign_id: string;
  contact_id: string;
  state: ParticipantState;
  is_test: boolean;
  entered_at: string;
  completed_at: string | null;
}

export interface AutomationTrace {
  id: string;
  participant_id: string;
  activity_id: string;
  parent_id: string | null;
  state: AutomationTraceState;
  state_message: string | null;
  schedule_date: string | null;
  processed_at: string | null;
  mailing_trace_id: string | null;
  created_at: string;
}

/** Pagination response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/** API error response */
export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

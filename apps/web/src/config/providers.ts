export interface ProviderField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'select' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
}

export interface ProviderPreset {
  label: string;
  values: Record<string, string | number | boolean>;
}

export interface ProviderConfig {
  key: string;
  name: string;
  description: string;
  icon: string;
  fields: ProviderField[];
  presets?: ProviderPreset[];
}

export const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    key: 'smtp',
    name: 'SMTP',
    description: 'Connect any SMTP server including Gmail, Outlook, Yahoo',
    icon: 'Server',
    fields: [
      { name: 'host', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.example.com' },
      { name: 'port', label: 'Port', type: 'number', required: true, placeholder: '587', defaultValue: 587 },
      { name: 'secure', label: 'Use SSL/TLS', type: 'checkbox', defaultValue: false },
      { name: 'username', label: 'Username', type: 'text', placeholder: 'your@email.com' },
      { name: 'password', label: 'Password', type: 'password', placeholder: 'App password' },
    ],
    presets: [
      { label: 'Gmail', values: { host: 'smtp.gmail.com', port: 587, secure: false } },
      { label: 'Outlook', values: { host: 'smtp-mail.outlook.com', port: 587, secure: false } },
      { label: 'Yahoo', values: { host: 'smtp.mail.yahoo.com', port: 465, secure: true } },
      { label: 'Zoho', values: { host: 'smtp.zoho.com', port: 465, secure: true } },
    ],
  },
  {
    key: 'sendgrid',
    name: 'SendGrid',
    description: 'Scalable email delivery by Twilio SendGrid',
    icon: 'Zap',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'SG.xxxx...' },
    ],
  },
  {
    key: 'ses',
    name: 'Amazon SES',
    description: 'Amazon Simple Email Service for high-volume sending',
    icon: 'Cloud',
    fields: [
      { name: 'access_key_id', label: 'Access Key ID', type: 'text', required: true, placeholder: 'AKIA...' },
      { name: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true },
      { name: 'region', label: 'AWS Region', type: 'select', required: true, options: [
        { value: 'us-east-1', label: 'US East (N. Virginia)' },
        { value: 'us-west-2', label: 'US West (Oregon)' },
        { value: 'eu-west-1', label: 'EU (Ireland)' },
        { value: 'eu-central-1', label: 'EU (Frankfurt)' },
        { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
        { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
      ], defaultValue: 'us-east-1' },
    ],
  },
  {
    key: 'mailgun',
    name: 'Mailgun',
    description: 'Powerful transactional email API by Sinch',
    icon: 'Mail',
    fields: [
      { name: 'api_key', label: 'API Key', type: 'password', required: true, placeholder: 'key-xxxx...' },
      { name: 'domain', label: 'Sending Domain', type: 'text', required: true, placeholder: 'mg.example.com' },
      { name: 'region', label: 'Region', type: 'select', options: [
        { value: 'us', label: 'US' }, { value: 'eu', label: 'EU' },
      ], defaultValue: 'us' },
    ],
  },
  {
    key: 'postmark',
    name: 'Postmark',
    description: 'Fast, reliable transactional email delivery',
    icon: 'Send',
    fields: [
      { name: 'server_token', label: 'Server API Token', type: 'password', required: true, placeholder: 'xxxx-xxxx-xxxx...' },
      { name: 'message_stream', label: 'Message Stream', type: 'text', placeholder: 'outbound', defaultValue: 'outbound' },
    ],
  },
];

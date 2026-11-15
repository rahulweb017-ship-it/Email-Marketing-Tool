export interface LegalSection { heading: string; body: string[]; list?: string[] }
export interface LegalDoc {
  slug: string;
  title: string;
  short: string;
  intro: string;
  sections: LegalSection[];
}

export const LEGAL_UPDATED = '15 November 2026';
const CONTACT = 'contact@rabbitgrowth.si';

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    short: 'What data we collect, why, and your rights.',
    intro: 'This policy explains how Rabbit Growth ("we", "us") collects, uses and protects personal data when you visit our website or use our platform.',
    sections: [
      {
        heading: '1. Who we are',
        body: [`Rabbit Growth provides an AI-powered marketing platform for email, WhatsApp, social media and automation. For data about our own website visitors and customers we act as the data controller. You can reach us at ${CONTACT}.`],
      },
      {
        heading: '2. Data we collect',
        body: ['We collect only what we need to run the service:'],
        list: [
          'Account data: your name, work email, company name and password (stored hashed).',
          'Enquiry data: details you send through our demo and contact forms.',
          'Usage data: pages visited, features used, device and browser type, IP address and log data.',
          'Billing data: plan and payment status. Card details are handled by our payment provider, not stored by us.',
          'Content you upload: contacts, templates, messages and media that you add to the platform.',
        ],
      },
      {
        heading: '3. Your customers\u2019 data (we act as a processor)',
        body: ['When you upload contacts or send messages with Rabbit Growth, you are the controller of that data and we process it only on your instructions. You are responsible for having a lawful basis, such as consent, to message your contacts, and for honouring their opt-out requests.'],
      },
      {
        heading: '4. How we use data',
        list: [
          'To provide, secure and improve the platform.',
          'To respond to enquiries and give support.',
          'To send service messages such as account, security and billing notices.',
          'To send product updates, which you can opt out of at any time.',
          'To prevent spam, fraud and abuse, and to meet legal obligations.',
        ],
        body: [],
      },
      {
        heading: '5. AI features',
        body: ['Rabbit AI uses third-party AI models (such as Anthropic Claude and OpenAI) to draft emails, posts, replies and images. Text or prompts you submit to an AI feature are sent to the relevant provider to produce the result. We do not allow these providers to use your content to train their models under the terms we use. Do not put sensitive personal data into AI prompts.'],
      },
      {
        heading: '6. Who we share data with',
        body: ['We do not sell personal data. We share it only with service providers that help us run the platform (hosting, email delivery, AI, payments, analytics), when the law requires it, or in a business transfer. Providers are bound by confidentiality and data protection obligations.'],
      },
      {
        heading: '7. International transfers',
        body: ['Your data may be processed in countries other than your own. Where required, we use appropriate safeguards such as standard contractual clauses.'],
      },
      {
        heading: '8. Retention',
        body: ['We keep account data while your account is active and for a limited period afterwards for legal, tax and security reasons. You can ask us to delete your account and data at any time, and we will do so unless the law requires us to keep it.'],
      },
      {
        heading: '9. Your rights',
        body: ['Depending on where you live (for example under the EU GDPR or India\u2019s DPDP Act), you may have the right to:'],
        list: [
          'Access the personal data we hold about you.',
          'Correct or delete it.',
          'Object to or restrict certain processing.',
          'Receive a copy in a portable format.',
          'Withdraw consent at any time.',
          'Complain to your local data protection authority.',
        ],
      },
      {
        heading: '10. Security',
        body: ['We use encryption in transit, encrypted storage for sensitive credentials, access controls and monitoring. No system is perfectly secure, so please use a strong, unique password and tell us straight away if you suspect misuse.'],
      },
      {
        heading: '11. Children',
        body: ['Our service is for businesses and is not directed at children under 16. We do not knowingly collect their data.'],
      },
      {
        heading: '12. Changes and contact',
        body: [`We may update this policy and will change the date above when we do. For privacy questions or to use your rights, email ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'terms-and-conditions',
    title: 'Terms and Conditions',
    short: 'The rules for using Rabbit Growth.',
    intro: 'These terms form the agreement between you and Rabbit Growth when you use our website and platform. By creating an account or using the service you agree to them.',
    sections: [
      {
        heading: '1. The service',
        body: ['Rabbit Growth is a software platform for email, WhatsApp and social media marketing, automation, contact management and AI-assisted content. Features available to you depend on your plan.'],
      },
      {
        heading: '2. Your account',
        body: ['You must provide accurate information, keep your login details secure and be authorised to bind your business. You are responsible for all activity under your account, including that of your team members.'],
      },
      {
        heading: '3. Your content and contacts',
        body: ['You keep ownership of everything you upload. You give us a limited licence to host, process and send it as needed to run the service. You confirm that you have the right to use your content and contacts, and that you have collected them lawfully and with any consent required.'],
      },
      {
        heading: '4. Acceptable use',
        body: ['You must follow our Acceptable Use Policy. We may suspend or limit sending that risks our sending reputation, breaks the law or harms others.'],
      },
      {
        heading: '5. Third-party platforms',
        body: ['The service connects to third-party platforms such as WhatsApp (Meta), social networks, email providers and AI providers. Their own terms apply to your use of them. You are responsible for staying within those terms, including limits and approval rules for message templates. Using unofficial WhatsApp connections (QR login) is at your own risk and may lead to number restrictions or bans.'],
      },
      {
        heading: '6. AI-generated content',
        body: ['AI output can be inaccurate or unsuitable. You must review all AI-generated content before you send or publish it. You are responsible for what you send.'],
      },
      {
        heading: '7. Plans, fees and taxes',
        body: ['Paid plans are billed in advance for the period you choose. Fees exclude taxes unless stated. We may change prices with at least 30 days\u2019 notice before your next renewal. Usage beyond plan limits may be blocked or charged.'],
      },
      {
        heading: '8. Cancellation and refunds',
        body: ['You can cancel at any time. See our Refund and Cancellation Policy for details.'],
      },
      {
        heading: '9. Availability and support',
        body: ['We work to keep the service available but do not promise it will be uninterrupted or error-free. We may carry out maintenance and update features from time to time.'],
      },
      {
        heading: '10. Intellectual property',
        body: ['The platform, brand, logo and software belong to Rabbit Growth or its licensors. These terms do not give you any rights to them other than the right to use the service.'],
      },
      {
        heading: '11. Suspension and termination',
        body: ['We may suspend or end your access if you break these terms, do not pay, or put the service or others at risk. On termination you can export your data for a reasonable period, after which we may delete it.'],
      },
      {
        heading: '12. Disclaimer and liability',
        body: ['The service is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, lost profits or lost data, and our total liability is limited to the fees you paid us in the 12 months before the claim. Nothing limits liability that cannot be limited by law.'],
      },
      {
        heading: '13. Changes to these terms',
        body: ['We may update these terms. If a change is material we will tell you in advance. Continued use after the change means you accept it.'],
      },
      {
        heading: '14. Governing law',
        body: ['These terms are governed by the laws of the country where Rabbit Growth is established, and its courts have jurisdiction, unless mandatory consumer law in your country says otherwise.'],
      },
      {
        heading: '15. Contact',
        body: [`Questions about these terms: ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    short: 'How we use cookies and similar storage.',
    intro: 'This page explains the cookies and browser storage that Rabbit Growth uses.',
    sections: [
      {
        heading: '1. What they are',
        body: ['Cookies and local storage are small pieces of data saved in your browser. They help a website remember you and work properly.'],
      },
      {
        heading: '2. What we use',
        body: [],
        list: [
          'Essential: keep you signed in and protect your account (login tokens).',
          'Preferences: remember your theme (light or dark), language and which help tips you have closed.',
          'Analytics (if enabled): understand how pages are used so we can improve them.',
        ],
      },
      {
        heading: '3. Email tracking',
        body: ['Emails sent through the platform by our customers may include a tiny image and tracked links to measure opens and clicks. That is controlled by the sender, not by this website.'],
      },
      {
        heading: '4. Your choices',
        body: ['You can clear or block cookies in your browser settings. Blocking essential storage will stop sign-in from working.'],
      },
      {
        heading: '5. Contact',
        body: [`Questions: ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use and Anti-Spam Policy',
    short: 'What you may and may not send with the platform.',
    intro: 'Good sending keeps the platform working for everyone. This policy applies to all emails, WhatsApp messages and social posts sent through Rabbit Growth.',
    sections: [
      {
        heading: '1. Send only to people who agreed',
        body: [],
        list: [
          'Only message people who gave permission, or where the law gives you another valid basis.',
          'Do not buy, rent or scrape contact lists.',
          'For WhatsApp marketing, record consent before sending and follow WhatsApp\u2019s rules and template approvals.',
        ],
      },
      {
        heading: '2. Make opting out easy',
        body: ['Every marketing email must include a working unsubscribe link and your sender identity. Honour opt-outs, including WhatsApp STOP replies, immediately.'],
      },
      {
        heading: '3. Prohibited content and behaviour',
        body: [],
        list: [
          'Spam, phishing, scams or misleading subject lines and sender names.',
          'Malware, illegal goods or services, hate speech, harassment or adult content.',
          'Infringing someone else\u2019s intellectual property or privacy.',
          'Sending sensitive data such as passwords or payment card numbers.',
          'Trying to bypass limits, security controls or sending pacing.',
        ],
      },
      {
        heading: '4. Sending quality',
        body: ['We monitor bounce, complaint and unsubscribe rates. If they are too high, or you harm our sending reputation, we may slow, pause or block your sending until the problem is fixed.'],
      },
      {
        heading: '5. Enforcement',
        body: [`We may remove content and suspend or terminate accounts that break this policy, without refund. To report abuse, email ${CONTACT}.`],
      },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund and Cancellation Policy',
    short: 'How cancelling and refunds work.',
    intro: 'We want you to be able to try Rabbit Growth with confidence. This policy explains cancellations and refunds.',
    sections: [
      {
        heading: '1. Cancel any time',
        body: ['You can cancel your plan at any time. Your access continues until the end of the period you already paid for, and the plan will not renew.'],
      },
      {
        heading: '2. Refunds',
        body: ['If you are not satisfied, contact us within 7 days of your first payment and we will review a refund request. After that, payments are generally non-refundable, and we do not refund partly used periods. Refunds are not available where an account was suspended for breaking our terms or Acceptable Use Policy.'],
      },
      {
        heading: '3. Usage-based items',
        body: ['Credits, messages or add-ons that have already been used are not refundable.'],
      },
      {
        heading: '4. Your data after cancelling',
        body: ['You can export your contacts and reports before your access ends. We may delete your data after a reasonable period following cancellation.'],
      },
      {
        heading: '5. How to ask',
        body: [`Email ${CONTACT} from your account email with your company name and the reason. We aim to reply within one business day. Approved refunds go back to the original payment method.`],
      },
    ],
  },
];

export const getLegalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { contactRouter } from './modules/contacts/contact.controller.js';
import { listRouter } from './modules/lists/list.controller.js';
import { blacklistRouter } from './modules/blacklist/blacklist.controller.js';
import { campaignRouter } from './modules/campaigns/campaign.controller.js';
import { templateRouter } from './modules/templates/template.controller.js';
import { trackingRouter } from './modules/tracking/tracking.controller.js';
import { automationRouter } from './modules/automation/automation.controller.js';
import { webhookRouter } from './modules/webhooks/webhook.controller.js';
import { sendingConfigRouter } from './modules/sending/sending-config.controller.js';
import { analyticsRouter } from './modules/analytics/analytics.controller.js';
import { segmentRouter } from './modules/segments/segment.controller.js';
import { contactProfileRouter } from './modules/contacts/contact-profile.controller.js';
import { abTestingRouter } from './modules/ab-testing/ab-testing.controller.js';
import { apiKeyRouter } from './modules/api-keys/api-key.controller.js';
import { outgoingWebhookRouter } from './modules/outgoing-webhooks/outgoing-webhook.controller.js';
import { searchRouter as globalSearchRouter } from './modules/search/search.controller.js';
import { notificationRouter } from './modules/notifications/notification.controller.js';
import { auditRouter } from './modules/audit/audit.controller.js';
import { superAdminRouter } from './modules/super-admin/super-admin.controller.js';
import { customFieldRouter } from './modules/custom-fields/custom-fields.controller.js';
import { transactionalRouter } from './modules/transactional/transactional.controller.js';
import { consentRouter } from './modules/consent/consent.controller.js';
import { formRouter, publicFormRouter } from './modules/forms/forms.controller.js';
import { socialRouter } from './modules/social/social.controller.js';
import { whatsappRouter } from './modules/whatsapp/whatsapp.controller.js';
import { whatsappWebhookRouter } from './modules/whatsapp/whatsapp.webhook.js';
import { confirmSubscription } from './modules/lists/list.service.js';
import { AppError } from './shared/middleware/error-handler.js';

const app = express();

// Global middleware
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan('short'));
// Keep the raw body so webhook signatures (e.g. Meta X-Hub-Signature-256) can be verified
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/contacts', contactRouter);
app.use('/api/v1/lists', listRouter);
app.use('/api/v1/blacklist', blacklistRouter);
app.use('/api/v1/campaigns', campaignRouter);
app.use('/api/v1/templates', templateRouter);
app.use('/api/v1/automations', automationRouter);
app.use('/api/v1/sending-configs', sendingConfigRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/segments', segmentRouter);
app.use('/api/v1/contacts', contactProfileRouter);
app.use('/api/v1/ab-tests', abTestingRouter);
app.use('/api/v1/api-keys', apiKeyRouter);
app.use('/api/v1/outgoing-webhooks', outgoingWebhookRouter);
app.use('/api/v1/search', globalSearchRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/audit-logs', auditRouter);
app.use('/api/v1/super-admin', superAdminRouter);
app.use('/api/v1/custom-fields', customFieldRouter);
app.use('/api/v1/transactional', transactionalRouter);
app.use('/api/v1/consent', consentRouter);
app.use('/api/v1/forms', formRouter);
app.use('/api/v1/public/forms', publicFormRouter);
app.use('/api/v1/social', socialRouter);
app.use('/api/v1/whatsapp', whatsappRouter);

// Public confirm endpoint (accessible via /api/v1 for frontend)
app.get('/api/v1/confirm/:token', async (req, res) => {
  try {
    await confirmSubscription(req.params.token);
    res.json({ success: true, message: 'Your subscription has been confirmed!' });
  } catch (err: unknown) {
    const status = err instanceof AppError ? err.statusCode : 500;
    const message = err instanceof AppError ? err.message : 'An error occurred';
    res.status(status).json({ success: false, message });
  }
});

// Public routes (no /api/v1 prefix)
app.use('/', trackingRouter);
app.use('/', webhookRouter);
app.use('/', whatsappWebhookRouter);

// Also mount tracking under /api/v1 for frontend proxy access (preferences endpoints)
app.use('/api/v1', trackingRouter);

// Error handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API server running on port ${env.PORT} [${env.NODE_ENV}]`);
});

export default app;

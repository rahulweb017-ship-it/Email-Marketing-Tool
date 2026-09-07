import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { promises as dns } from 'dns';
import { authenticate, checkTenantStatus, requireRole } from '../auth/auth.middleware.js';
import * as configService from './sending-config.service.js';

export const sendingConfigRouter = Router();
sendingConfigRouter.use(authenticate, checkTenantStatus);
sendingConfigRouter.use(requireRole('admin'));

sendingConfigRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const configs = await configService.listSendingConfigs(req.user!.org_id);
    res.json({ data: configs });
  } catch (err) { next(err); }
});

sendingConfigRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.getSendingConfig(req.user!.org_id, req.params.id);
    res.json(config);
  } catch (err) { next(err); }
});

sendingConfigRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.createSendingConfig(req.user!.org_id, req.body);
    res.status(201).json(config);
  } catch (err) { next(err); }
});

sendingConfigRouter.post('/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await configService.testSendingConfig(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

sendingConfigRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.updateSendingConfig(req.user!.org_id, req.params.id, req.body);
    res.json(config);
  } catch (err) { next(err); }
});

sendingConfigRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await configService.deleteSendingConfig(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});

/** GET /:id/domain-records - Generate required DNS records based on provider type */
sendingConfigRouter.get('/:id/domain-records', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.getSendingConfig(req.user!.org_id, req.params.id);
    const settings = (config.settings || {}) as Record<string, unknown>;

    // Extract domain from from_email or settings
    let domain = ''
    if (settings.from_email && typeof settings.from_email === 'string') {
      domain = settings.from_email.split('@')[1] || ''
    }
    if (!domain && settings.domain && typeof settings.domain === 'string') {
      domain = settings.domain
    }
    if (!domain && settings.host && typeof settings.host === 'string') {
      domain = settings.host
    }

    if (!domain) {
      return res.status(400).json({ error: 'Could not determine domain from config. Please ensure from_email or domain is set.' })
    }

    // Provider-specific SPF includes
    const spfIncludes: Record<string, string> = {
      sendgrid: 'include:sendgrid.net',
      ses: 'include:amazonses.com',
      mailgun: 'include:mailgun.org',
      postmark: 'include:spf.mtasv.net',
      smtp: `include:${domain}`,
    }

    const spfInclude = spfIncludes[config.provider as string] || `include:${domain}`

    // Provider-specific DKIM selector hints
    const dkimSelectors: Record<string, string> = {
      sendgrid: 's1',
      ses: 'default',
      mailgun: 'default',
      postmark: 'default',
      smtp: 'default',
    }

    const dkimSelector = dkimSelectors[config.provider as string] || 'default'

    // Provider-specific DKIM instructions
    const dkimNotes: Record<string, string> = {
      sendgrid: 'Generate your DKIM key in SendGrid Settings > Sender Authentication. Use the CNAME records provided.',
      ses: 'Enable DKIM signing in the AWS SES console under Verified Identities > DKIM.',
      mailgun: 'Find your DKIM record in the Mailgun dashboard under Sending > Domain Settings.',
      postmark: 'Find your DKIM record in Postmark under Sender Signatures > DNS Settings.',
      smtp: 'Generate a DKIM key pair and add the public key as a TXT record.',
    }

    const records = {
      domain,
      provider: config.provider,
      spf: {
        type: 'TXT',
        host: domain,
        value: `v=spf1 ${spfInclude} ~all`,
        description: 'SPF record authorizes your email provider to send on behalf of your domain.',
      },
      dkim: {
        type: 'TXT',
        host: `${dkimSelector}._domainkey.${domain}`,
        value: `v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE`,
        description: dkimNotes[config.provider as string] || 'Add your DKIM public key as a TXT record.',
        selector: dkimSelector,
      },
      dmarc: {
        type: 'TXT',
        host: `_dmarc.${domain}`,
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${domain}`,
        description: 'DMARC policy tells receiving servers how to handle emails that fail SPF/DKIM checks.',
      },
    }

    res.json(records)
  } catch (err) { next(err); }
});

/** POST /:id/verify-domain - Verify SPF/DKIM/DMARC DNS records */
sendingConfigRouter.post('/:id/verify-domain', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await configService.getSendingConfig(req.user!.org_id, req.params.id);
    const settings = (config.settings || {}) as Record<string, unknown>;

    // Extract domain
    let domain = ''
    if (settings.from_email && typeof settings.from_email === 'string') {
      domain = settings.from_email.split('@')[1] || ''
    }
    if (!domain && settings.domain && typeof settings.domain === 'string') {
      domain = settings.domain
    }
    if (!domain && settings.host && typeof settings.host === 'string') {
      domain = settings.host
    }

    if (!domain) {
      return res.status(400).json({ error: 'Could not determine domain from config.' })
    }

    // Provider-specific SPF includes to look for
    const spfKeywords: Record<string, string[]> = {
      sendgrid: ['sendgrid.net'],
      ses: ['amazonses.com'],
      mailgun: ['mailgun.org'],
      postmark: ['spf.mtasv.net', 'mtasv.net'],
      smtp: ['spf1'],
    }

    const providerKeywords = spfKeywords[config.provider as string] || ['spf1']

    // Verify SPF
    let spfResult: { found: boolean; valid: boolean; records: string[] } = { found: false, valid: false, records: [] }
    try {
      const txtRecords = await dns.resolveTxt(domain)
      const flatRecords = txtRecords.map((r) => r.join(''))
      const spfRecords = flatRecords.filter((r) => r.toLowerCase().startsWith('v=spf1'))
      spfResult.records = spfRecords
      spfResult.found = spfRecords.length > 0
      spfResult.valid = spfRecords.some((r) => {
        const lower = r.toLowerCase()
        return providerKeywords.some((kw) => lower.includes(kw.toLowerCase()))
      })
    } catch {
      // DNS lookup failed - records not found
    }

    // Verify DKIM
    const dkimSelectors: Record<string, string[]> = {
      sendgrid: ['s1', 's2'],
      ses: ['default'],
      mailgun: ['default', 'k1'],
      postmark: ['default', '20230601'],
      smtp: ['default'],
    }
    const selectors = dkimSelectors[config.provider as string] || ['default']

    let dkimResult: { found: boolean; valid: boolean; records: string[]; selector: string } = { found: false, valid: false, records: [], selector: '' }
    for (const selector of selectors) {
      try {
        const dkimHost = `${selector}._domainkey.${domain}`
        const txtRecords = await dns.resolveTxt(dkimHost)
        const flatRecords = txtRecords.map((r) => r.join(''))
        if (flatRecords.length > 0) {
          dkimResult.found = true
          dkimResult.records = flatRecords
          dkimResult.selector = selector
          dkimResult.valid = flatRecords.some((r) => {
            const lower = r.toLowerCase()
            if (!lower.includes('v=dkim1')) return false
            // Extract p= value and verify it contains an actual public key (not placeholder/empty)
            const pMatch = r.match(/p=([^;\s]*)/)
            return pMatch !== null && pMatch[1].length > 20
          })
          break
        }
      } catch {
        // Try next selector
      }
    }

    // Also try CNAME records for DKIM (used by SendGrid, Mailgun)
    if (!dkimResult.found) {
      for (const selector of selectors) {
        try {
          const dkimHost = `${selector}._domainkey.${domain}`
          const cnameRecords = await dns.resolveCname(dkimHost)
          if (cnameRecords.length > 0) {
            dkimResult.found = true
            dkimResult.records = cnameRecords
            dkimResult.selector = selector
            dkimResult.valid = true
            break
          }
        } catch {
          // Try next selector
        }
      }
    }

    // Verify DMARC
    let dmarcResult: { found: boolean; valid: boolean; records: string[] } = { found: false, valid: false, records: [] }
    try {
      const txtRecords = await dns.resolveTxt(`_dmarc.${domain}`)
      const flatRecords = txtRecords.map((r) => r.join(''))
      const dmarcRecords = flatRecords.filter((r) => r.toLowerCase().startsWith('v=dmarc1'))
      dmarcResult.records = dmarcRecords
      dmarcResult.found = dmarcRecords.length > 0
      dmarcResult.valid = dmarcRecords.some((r) => r.toLowerCase().includes('v=dmarc1'))
    } catch {
      // DNS lookup failed
    }

    res.json({
      domain,
      spf: spfResult,
      dkim: dkimResult,
      dmarc: dmarcResult,
    })
  } catch (err) { next(err); }
});

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, checkTenantStatus } from '../auth/auth.middleware.js';
import { createContactSchema, updateContactSchema, bulkImportSchema, createTagSchema, bulkActionSchema } from './contact.schema.js';
import * as contactService from './contact.service.js';
import { parsePagination, paginatedResponse } from '../../shared/utils/pagination.js';
import { generateCsv } from '../../shared/utils/csv-generator.js';
import { db } from '../../config/database.js';
import { engagementScoringQueue } from '../../config/queue.js';

export const contactRouter = Router();
contactRouter.use(authenticate, checkTenantStatus);

/** GET /api/v1/contacts */
contactRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req);
    const filters = {
      search: req.query.search as string | undefined,
      tag_id: req.query.tag_id as string | undefined,
      list_id: req.query.list_id as string | undefined,
    };
    const { data, total } = await contactService.listContacts(req.user!.org_id, pagination, filters);
    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/validate-bulk */
contactRouter.post('/validate-bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contact_ids } = req.body;
    if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
      res.status(400).json({ message: 'contact_ids array is required' });
      return;
    }
    const result = await contactService.bulkValidate(req.user!.org_id, contact_ids);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/bulk */
contactRouter.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = bulkActionSchema.parse(req.body);
    const result = await contactService.bulkAction(req.user!.org_id, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/recalculate-scores */
contactRouter.post('/recalculate-scores', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await engagementScoringQueue.add('recalculate-scores', { orgId: req.user!.org_id });
    res.json({ message: 'Engagement score recalculation queued' });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/contacts/engagement-distribution */
contactRouter.get('/engagement-distribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.org_id;
    const result = await db('contacts')
      .where('org_id', orgId)
      .select(
        db.raw("COUNT(*) FILTER (WHERE engagement_score <= 20) as cold"),
        db.raw("COUNT(*) FILTER (WHERE engagement_score > 20 AND engagement_score <= 50) as warm"),
        db.raw("COUNT(*) FILTER (WHERE engagement_score > 50 AND engagement_score <= 80) as hot"),
        db.raw("COUNT(*) FILTER (WHERE engagement_score > 80) as very_hot"),
      )
      .first();
    res.json({
      cold: Number(result?.cold || 0),
      warm: Number(result?.warm || 0),
      hot: Number(result?.hot || 0),
      very_hot: Number(result?.very_hot || 0),
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/v1/contacts/:id */
contactRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contact = await contactService.getContact(req.user!.org_id, req.params.id);
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/:id/validate */
contactRouter.post('/:id/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await contactService.validateContact(req.user!.org_id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts */
contactRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await contactService.createContact(req.user!.org_id, input);
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/v1/contacts/:id */
contactRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateContactSchema.parse(req.body);
    const contact = await contactService.updateContact(req.user!.org_id, req.params.id, input);
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/contacts/:id */
contactRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await contactService.deleteContact(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/import */
contactRouter.post('/import', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contacts, list_id } = bulkImportSchema.parse(req.body);
    const result = await contactService.bulkImport(req.user!.org_id, contacts, list_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---- Tags ----

/** GET /api/v1/contacts/tags/all */
contactRouter.get('/tags/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tags = await contactService.listTags(req.user!.org_id);
    res.json({ data: tags });
  } catch (err) {
    next(err);
  }
});

/** POST /api/v1/contacts/tags */
contactRouter.post('/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createTagSchema.parse(req.body);
    const tag = await contactService.createTag(req.user!.org_id, input);
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/v1/contacts/tags/:id */
contactRouter.delete('/tags/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await contactService.deleteTag(req.user!.org_id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- Export ----

/** POST /api/v1/contacts/export */
contactRouter.post('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = (req.body.fields as string[] | undefined) || ['email', 'first_name', 'last_name', 'company_name', 'phone', 'country_code'];
    const listId = req.body.list_id as string | undefined;

    const allColumns: Record<string, string> = {
      email: 'Email',
      first_name: 'First Name',
      last_name: 'Last Name',
      company_name: 'Company',
      phone: 'Phone',
      country_code: 'Country',
      is_blacklisted: 'Blacklisted',
      created_at: 'Created At',
    };

    const selectedColumns = fields
      .filter((f) => allColumns[f])
      .map((f) => ({ key: f, header: allColumns[f] }));

    if (selectedColumns.length === 0) {
      res.status(400).json({ message: 'No valid fields selected' });
      return;
    }

    let query = db('contacts').where('org_id', req.user!.org_id);

    if (listId) {
      query = query
        .join('subscriptions', 'contacts.id', 'subscriptions.contact_id')
        .where('subscriptions.list_id', listId);
    }

    const selectFields = selectedColumns.map((c) => `contacts.${c.key}`);
    const rows = await query.select(selectFields);

    const csv = generateCsv(rows, selectedColumns);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts-export.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

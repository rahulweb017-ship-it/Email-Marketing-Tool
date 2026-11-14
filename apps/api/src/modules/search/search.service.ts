import { db } from '../../config/database.js';

interface SearchResult {
  contacts: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }>;
  campaigns: Array<{ id: string; name: string; subject: string; state: string }>;
  templates: Array<{ id: string; name: string; subject: string | null; category: string | null }>;
  lists: Array<{ id: string; name: string; contact_count: number }>;
}

export async function globalSearch(orgId: string, query: string): Promise<SearchResult> {
  const pattern = `%${query}%`;

  const [contacts, campaigns, templates, lists] = await Promise.all([
    db('contacts')
      .where('org_id', orgId)
      .where(function () {
        this.whereILike('email', pattern)
          .orWhereILike('first_name', pattern)
          .orWhereILike('last_name', pattern);
      })
      .select('id', 'email', 'first_name', 'last_name')
      .limit(5),

    db('campaigns')
      .where({ org_id: orgId, is_automation: false })
      .where(function () {
        this.whereILike('name', pattern)
          .orWhereILike('subject', pattern);
      })
      .select('id', 'name', 'subject', 'state')
      .limit(5),

    db('email_templates')
      .where('org_id', orgId)
      .where(function () {
        this.whereILike('name', pattern)
          .orWhereILike('subject', pattern);
      })
      .select('id', 'name', 'subject', 'category')
      .limit(5),

    db('mailing_lists')
      .where('org_id', orgId)
      .whereILike('name', pattern)
      .select('id', 'name', 'contact_count')
      .limit(5),
  ]);

  return { contacts, campaigns, templates, lists };
}

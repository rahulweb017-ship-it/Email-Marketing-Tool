import { describe, it, expect } from 'vitest';
import { createEnquirySchema } from './enquiry.schema.js';

describe('createEnquirySchema', () => {
  it('normalises email and blanks optional fields', () => {
    const r = createEnquirySchema.parse({
      type: 'registration',
      name: '  Priya Sharma ',
      email: ' Priya@Example.COM ',
      phone: '',
      company: '  ',
      interests: ['whatsapp', 'email_campaigns'],
    });
    expect(r.name).toBe('Priya Sharma');
    expect(r.email).toBe('priya@example.com');
    expect(r.phone).toBeNull();
    expect(r.company).toBeNull();
    expect(r.interests).toEqual(['whatsapp', 'email_campaigns']);
  });

  it('defaults interests to an empty list', () => {
    const r = createEnquirySchema.parse({ type: 'contact', name: 'Ravi', email: 'ravi@example.com', message: 'Hi' });
    expect(r.interests).toEqual([]);
  });

  it('rejects bad email, short name, unknown type and unknown interest', () => {
    expect(() => createEnquirySchema.parse({ type: 'contact', name: 'Ravi', email: 'nope' })).toThrow();
    expect(() => createEnquirySchema.parse({ type: 'contact', name: 'R', email: 'r@example.com' })).toThrow();
    expect(() => createEnquirySchema.parse({ type: 'signup', name: 'Ravi', email: 'r@example.com' })).toThrow();
    expect(() => createEnquirySchema.parse({ type: 'contact', name: 'Ravi', email: 'r@example.com', interests: ['crypto'] })).toThrow();
  });

  it('accepts the exact payload the website form sends', () => {
    const r = createEnquirySchema.parse({
      type: 'registration', name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43210',
      company: 'Sharma Sweets', website: '', company_size: '', monthly_volume: '', message: '', fax_number: '',
      interests: ['whatsapp', 'ai_assistant'], source_page: '/register',
    });
    expect(r.website).toBeNull();
    expect(r.message).toBeNull();
    expect(r.fax_number).toBe('');
  });

  it('caps message length', () => {
    expect(() => createEnquirySchema.parse({ type: 'contact', name: 'Ravi', email: 'r@example.com', message: 'x'.repeat(5001) })).toThrow();
  });
});

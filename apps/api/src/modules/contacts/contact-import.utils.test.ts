import { describe, expect, it } from 'vitest';
import { cleanCountry, cleanEmail, cleanImportRow, cleanPhone } from './contact-import.utils.js';

describe('cleanEmail', () => {
  it.each([
    ['  John.Doe@Gmail.com ', 'john.doe@gmail.com'],
    ['John Doe <john@example.com>', 'john@example.com'],
    ['mailto:a@b.com', 'a@b.com'],
    ['priya@gmial.com', 'priya@gmail.com'],
    ['priya@gmail.con', 'priya@gmail.com'],
    ['priya@yahoo,com', 'priya@yahoo.com'],
    ['a@b.com; c@d.com', 'a@b.com'],
    ['a@@b.com', 'a@b.com'],
    ['raj @ company.in', 'raj@company.in'],
    ['a@b.com.', 'a@b.com'],
  ])('%s -> %s', (input, out) => expect(cleanEmail(input).email).toBe(out));

  it('drops invalid emails', () => {
    expect(cleanEmail('not an email')).toEqual({ email: null, fixed: false, invalid: true });
    expect(cleanEmail('')).toEqual({ email: null, fixed: false, invalid: false });
  });
});

describe('cleanPhone', () => {
  it.each([
    ['8872544458', '+918872544458'],
    ['088725 44458', '+918872544458'],
    ['+91-88725-44458', '+918872544458'],
    ['918872544458', '+918872544458'],
    ['00918872544458', '+918872544458'],
    ["'8872544458", '+918872544458'],
    ['8872544458.0', '+918872544458'],
    ['9.18872544458E+11', '+918872544458'],
    ['tel:+918872544458', '+918872544458'],
    ['12345 / 8872544458', '+918872544458'],
    ['98765 43210, 91234 56789', '+919876543210'],
  ])('%s -> %s', (input, out) => expect(cleanPhone(input, 'IN').e164).toBe(out));

  it('uses the row country', () => {
    expect(cleanPhone('(202) 555-0123', 'US').e164).toBe('+12025550123');
  });
  it('explains Excel-truncated numbers', () => {
    const r = cleanPhone('9.18873E+11', 'IN');
    expect(r.e164).toBeNull();
    expect(r.reason).toMatch(/Excel/);
  });
  it('rejects junk', () => {
    expect(cleanPhone('12345', 'IN').e164).toBeNull();
    expect(cleanPhone('', 'IN').reason).toBeNull();
  });
});

describe('cleanCountry', () => {
  it.each([['India', 'IN'], ['in', 'IN'], ['+91', 'IN'], ['91', 'IN'], ['091', 'IN'], ['0091', 'IN'], [91 as unknown as string, 'IN'], ['USA', 'US'], ['U.K.', 'GB'], ['1', 'US'], ['Narnia', null], ['', null]])(
    '%s -> %s', (input, out) => expect(cleanCountry(input)).toBe(out));
});

describe('cleanImportRow', () => {
  it('accepts a phone-only row (WhatsApp only)', () => {
    const r = cleanImportRow({ phone: '8872544458', full_name: 'RAHUL KUMAR' });
    expect(r.error).toBeNull();
    expect(r.contact).toMatchObject({ email: null, phone_e164: '+918872544458', first_name: 'Rahul', last_name: 'Kumar' });
  });
  it('accepts an email-only row', () => {
    const r = cleanImportRow({ email: 'A@B.COM' });
    expect(r.error).toBeNull();
    expect(r.contact).toMatchObject({ email: 'a@b.com', phone: null, phone_e164: null });
  });
  it('keeps a row with a good phone even if the email is bad', () => {
    const r = cleanImportRow({ email: 'nope', phone: '8872544458' });
    expect(r.error).toBeNull();
    expect(r.contact.email).toBeNull();
    expect(r.warnings).toContain('invalid email');
  });
  it('rejects a row with neither', () => {
    expect(cleanImportRow({ first_name: 'X' }).error).toBe('no email or phone');
    expect(cleanImportRow({ email: 'bad', phone: '1' }).error).toMatch(/no usable email or phone/);
  });
  it('converts country names and uses them for the phone', () => {
    const r = cleanImportRow({ phone: '2025550123', country_code: 'United States' });
    expect(r.contact).toMatchObject({ country_code: 'US', phone_e164: '+12025550123' });
  });
  it('imports the client file shape (country column holds 91)', () => {
    const r = cleanImportRow({ email: 'kirandeshpande@gmail.com', first_name: 'Kiran Deshpande', company_name: 'Fibax Pharma', phone: '9881439424', country_code: '91' });
    expect(r.error).toBeNull();
    expect(r.contact).toMatchObject({ country_code: 'IN', phone_e164: '+919881439424', email: 'kirandeshpande@gmail.com' });
  });
  it('drops an unknown country instead of failing', () => {
    const r = cleanImportRow({ email: 'a@b.com', country_code: 'Narnia' });
    expect(r.error).toBeNull();
    expect(r.contact.country_code).toBeNull();
  });
  it('leaves mixed-case names alone', () => {
    expect(cleanImportRow({ email: 'a@b.com', first_name: 'McDonald' }).contact.first_name).toBe('McDonald');
  });
});

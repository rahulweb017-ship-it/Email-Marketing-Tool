import { describe, it, expect } from 'vitest';
import { validateRule, daysAgo, escapeLike } from './segment.rules.js';

describe('validateRule', () => {
  it('accepts valid rules for each kind', () => {
    expect(validateRule({ field: 'first_name', operator: 'contains', value: 'an' })).toBeNull();
    expect(validateRule({ field: 'engagement_score', operator: 'gte', value: 5 })).toBeNull();
    expect(validateRule({ field: 'engagement_score', operator: 'between', value: '2, 9' })).toBeNull();
    expect(validateRule({ field: 'last_open_at', operator: 'within_days', value: '30' })).toBeNull();
    expect(validateRule({ field: 'created_at', operator: 'is_set' })).toBeNull();
    expect(validateRule({ field: 'tag', operator: 'has_tag', value: 'VIP' })).toBeNull();
  });

  it('keeps old "equals" on numbers working', () => {
    expect(validateRule({ field: 'engagement_score', operator: 'equals', value: 3 })).toBeNull();
  });

  it('rejects unknown fields and columns that do not exist', () => {
    expect(validateRule({ field: 'city', operator: 'equals', value: 'Pune' })).toMatch(/Unknown field/);
    expect(validateRule({ field: 'org_id', operator: 'equals', value: 'x' })).toMatch(/Unknown field/);
  });

  it('rejects operators that do not fit the field', () => {
    expect(validateRule({ field: 'created_at', operator: 'contains', value: '2024' })).toMatch(/can't be used/);
    expect(validateRule({ field: 'email', operator: 'gt', value: 3 })).toMatch(/can't be used/);
  });

  it('requires sensible values', () => {
    expect(validateRule({ field: 'email', operator: 'equals', value: '' })).toMatch(/needs a value/);
    expect(validateRule({ field: 'engagement_score', operator: 'gt', value: 'lots' })).toMatch(/number/);
    expect(validateRule({ field: 'engagement_score', operator: 'between', value: '5' })).toMatch(/min,max/);
    expect(validateRule({ field: 'last_click_at', operator: 'within_days', value: '-3' })).toMatch(/days/);
  });
});

describe('helpers', () => {
  it('daysAgo subtracts whole days', () => {
    expect(daysAgo(2, new Date('2026-05-10T12:00:00Z')).toISOString()).toBe('2026-05-08T12:00:00.000Z');
  });
  it('escapeLike escapes wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
});

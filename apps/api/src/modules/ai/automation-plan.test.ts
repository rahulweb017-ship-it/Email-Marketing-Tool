import { describe, it, expect } from 'vitest';
import { planAutomation, type DraftStep } from './automation-plan.js';

const step = (s: Partial<DraftStep> & { key: string }): DraftStep => ({
  parent: 'start', branch: '', type: 'email', name: s.key, trigger: 'after_previous', delay_number: 0, delay_unit: 'days', ...s,
});

describe('planAutomation', () => {
  it('builds a welcome series with a branch on opens', () => {
    const { activities, skipped } = planAutomation([
      step({ key: 'welcome' }),
      step({ key: 'wait', parent: 'welcome', type: 'wait', delay_number: 2 }),
      step({ key: 'check', parent: 'wait', type: 'condition', condition_field: 'last_email_opened', condition_value: 'yes' }),
      step({ key: 'offer', parent: 'check', branch: 'yes' }),
      step({ key: 'nudge', parent: 'check', branch: 'no' }),
    ]);
    expect(skipped).toEqual([]);
    expect(activities.map((a) => a.key)).toEqual(['welcome', 'wait', 'check', 'offer', 'nudge']);
    expect(activities[0].parentKey).toBeNull();
    expect(activities[1]).toMatchObject({ trigger_type: 'activity_completed', interval_number: 2, interval_unit: 'days' });
    expect(activities[2].activity_filter).toEqual({ match: 'all', rules: [{ field: 'last_email_opened', operator: 'eq', value: 'yes' }] });
    expect(activities[3].parent_handle).toBe('yes');
    expect(activities[4].parent_handle).toBe('no');
    expect(activities[3].position_x).toBeLessThan(activities[4].position_x);
  });

  it('maps engagement triggers only under email steps', () => {
    const { activities } = planAutomation([
      step({ key: 'a' }),
      step({ key: 'b', parent: 'a', trigger: 'not_opened', delay_number: 3 }),
      step({ key: 'w', parent: 'a', type: 'wait' }),
      step({ key: 'c', parent: 'w', trigger: 'clicked' }),
    ]);
    expect(activities.find((x) => x.key === 'b')?.trigger_type).toBe('mail_not_opened');
    expect(activities.find((x) => x.key === 'c')?.trigger_type).toBe('activity_completed');
  });

  it('drops steps that cannot be wired', () => {
    const { activities, skipped } = planAutomation([
      step({ key: 'a' }),
      step({ key: 'a' }),
      step({ key: 'b', parent: 'missing' }),
      step({ key: 'c', type: 'condition', condition_field: 'password' }),
      step({ key: 'd', type: 'condition', condition_field: 'country_code', condition_value: 'IN' }),
      step({ key: 'e', parent: 'd' }),
    ]);
    expect(activities.map((x) => x.key)).toEqual(['a', 'd']);
    expect(skipped).toHaveLength(4);
  });

  it('clamps delays and caps step count', () => {
    const many = Array.from({ length: 25 }, (_, i) => step({ key: `s${i}`, parent: i ? `s${i - 1}` : 'start', delay_number: 9999 }));
    const { activities, skipped } = planAutomation(many);
    expect(activities).toHaveLength(20);
    expect(activities[0].interval_number).toBe(365);
    expect(skipped.at(-1)).toMatch(/first 20/);
  });
});

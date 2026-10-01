import { describe, expect, test } from 'vitest';
import { parseTimeValue } from '../../src/core/format/time';
import { InvalidSpecError } from '../../src/core/index';

function rule(value: string): string | undefined {
  try {
    parseTimeValue(value);
  } catch (e) {
    expect(e).toBeInstanceOf(InvalidSpecError);
    return (e as InvalidSpecError).rule;
  }
  return undefined;
}

describe('parseTimeValue', () => {
  test('date-only is a calendar day at UTC midnight', () => {
    expect(parseTimeValue('2026-07-01')).toEqual({ epochMs: Date.UTC(2026, 6, 1), kind: 'date' });
    expect(parseTimeValue('1970-01-01')).toEqual({ epochMs: 0, kind: 'date' });
  });

  test('instants with Z or an offset', () => {
    expect(parseTimeValue('2026-07-01T10:00:00Z')).toEqual({
      epochMs: Date.UTC(2026, 6, 1, 10),
      kind: 'instant',
    });
    expect(parseTimeValue('2026-07-01T10:00+02:00').epochMs).toBe(Date.UTC(2026, 6, 1, 8));
    expect(parseTimeValue('2026-07-01T10:00:00-05:30').epochMs).toBe(Date.UTC(2026, 6, 1, 15, 30));
    expect(parseTimeValue('2026-07-01T10:00:00.123Z').epochMs).toBe(
      Date.UTC(2026, 6, 1, 10, 0, 0, 123),
    );
    expect(parseTimeValue('2026-07-01T10:00:00.5Z').epochMs).toBe(
      Date.UTC(2026, 6, 1, 10, 0, 0, 500),
    );
    expect(parseTimeValue('2026-07-01T10:00:00.123456789Z').epochMs).toBe(
      Date.UTC(2026, 6, 1, 10, 0, 0, 123),
    );
  });

  test('leap days and early years', () => {
    expect(parseTimeValue('2024-02-29').kind).toBe('date');
    expect(rule('2026-02-29')).toBe('invalid-time');
    expect(rule('1900-02-29')).toBe('invalid-time');
    expect(parseTimeValue('2000-02-29').kind).toBe('date');
    expect(parseTimeValue('0050-01-01').epochMs).toBe(new Date('0050-01-01T00:00:00Z').getTime());
  });

  test('date-times without an offset are time-without-offset', () => {
    expect(rule('2026-07-01T10:00')).toBe('time-without-offset');
    expect(rule('2026-07-01T10:00:00')).toBe('time-without-offset');
    expect(rule('2026-07-01T10:00:00.5')).toBe('time-without-offset');
  });

  test.each([
    '',
    'July',
    '2026-13-01',
    '2026-00-10',
    '2026-07-00',
    '2026-07-32',
    '2026-7-1',
    '26-07-01',
    '2026-07-01 10:00:00Z',
    '2026-07-01T24:00:00Z',
    '2026-07-01T10:60:00Z',
    '2026-07-01T10:00:60Z',
    '2026-07-01T10:00:00+24:00',
    '2026-07-01T10:00:00+02:60',
    '2026-07-01T10:00:00+0200',
    '2026-07-01T10:00:00z',
    '2026-07-01T',
    '2026-07-01Z',
    ' 2026-07-01',
    '2026-07-01\n',
    '2026-07-01T10:00:00.Z',
    '2026-07-01T10:00:00.1234567890Z',
  ])('rejects %j as invalid-time', (v) => {
    expect(rule(v)).toBe('invalid-time');
  });

  test('is independent of the machine timezone (no Date.parse, no local getters)', async () => {
    const src = (await import('node:fs')).readFileSync('src/core/format/time.ts', 'utf8');
    expect(src).not.toMatch(/Date\.parse|new Date\(\s*value|getTimezoneOffset|getHours|getDate\(/);
  });
});

import { describe, expect, test } from 'vitest';
import { DravenVizError } from '../../src/core/errors';
import { formatNumber, formatTime, parseTimeValue } from '../../src/core/format';

describe('test environment', () => {
  test('this file runs under a non-UTC machine timezone', () => {
    // Guards the leak test below from passing vacuously.
    expect(new Date(0).getTimezoneOffset()).not.toBe(0);
    expect(process.env.TZ).toBe('America/New_York');
  });
});

describe('formatNumber', () => {
  test('percent style uses percentage points', () => {
    expect(formatNumber(45.2, { style: 'percent', maximumFractionDigits: 1 }, 'en-US')).toBe(
      '45.2%',
    );
  });
  test('currency requires code', () => {
    expect(
      formatNumber(
        120000,
        { style: 'currency', currency: 'USD', maximumFractionDigits: 0 },
        'en-US',
      ),
    ).toBe('$120,000');
  });
  test('currency without a code throws INVALID_OPTIONS', () => {
    try {
      formatNumber(1, { style: 'currency' }, 'en-US');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DravenVizError);
      expect((e as DravenVizError).code).toBe('INVALID_OPTIONS');
    }
  });
  test('locale decimal', () => {
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, 'de-DE')).toBe('1.234,5');
  });
  test('compact notation', () => {
    expect(formatNumber(1200000, { style: 'compact', maximumFractionDigits: 1 }, 'en-US')).toBe(
      '1.2M',
    );
  });
  test('signDisplay passes through', () => {
    expect(formatNumber(5, { signDisplay: 'always' }, 'en-US')).toBe('+5');
    expect(formatNumber(0, { signDisplay: 'exceptZero' }, 'en-US')).toBe('0');
  });
  test('default max fraction digits: 0 for integers, 1 otherwise', () => {
    expect(formatNumber(12, undefined, 'en-US')).toBe('12');
    expect(formatNumber(12.34, undefined, 'en-US')).toBe('12.3');
    expect(formatNumber(1234.56, {}, 'en-US')).toBe('1,234.6');
  });
  test('explicit minimumFractionDigits above the default max is honoured', () => {
    expect(formatNumber(12, { minimumFractionDigits: 2 }, 'en-US')).toBe('12.00');
  });
  test('never emits negative zero', () => {
    expect(formatNumber(-0, undefined, 'en-US')).toBe('0');
    expect(formatNumber(-0.04, { maximumFractionDigits: 0 }, 'en-US')).toBe('0');
    expect(formatNumber(-0.04, { style: 'percent', maximumFractionDigits: 0 }, 'en-US')).toBe('0%');
    expect(formatNumber(-3, undefined, 'en-US')).toMatch(/3$/);
  });
});

describe('parseTimeValue', () => {
  test('date-only is a UTC calendar day', () => {
    expect(parseTimeValue('2026-07-06')).toEqual({ epochMs: Date.UTC(2026, 6, 6), kind: 'date' });
  });
  test('date-time without offset rejected', () => {
    expect(() => parseTimeValue('2026-07-06T10:00:00')).toThrow(
      /time-without-offset|no UTC offset/,
    );
  });
});

describe('formatTime', () => {
  test('machine TZ never leaks', () => {
    const { epochMs } = parseTimeValue('2026-07-06T23:30:00Z');
    expect(formatTime(epochMs, 'instant', 'day', 'en-US', 'Asia/Tokyo')).toBe('Jul 7');
    expect(formatTime(Date.UTC(2026, 6, 6), 'date', 'day', 'en-US', 'Asia/Tokyo')).toBe('Jul 6');
  });
  test('date kind ignores the timezone even for a western zone', () => {
    expect(formatTime(Date.UTC(2026, 6, 6), 'date', 'day', 'en-US', 'America/Los_Angeles')).toBe(
      'Jul 6',
    );
  });
  const t = Date.UTC(2026, 6, 7, 14, 0);
  test.each([
    ['day', 'Jul 7'],
    ['week', 'Jul 7'],
    ['month', 'Jul 2026'],
    ['quarter', 'Q3 2026'],
    ['year', '2026'],
    ['hour', 'Jul 7, 14:00'],
  ] as const)('unit %s', (unit, expected) => {
    expect(formatTime(t, 'instant', unit, 'en-US', 'UTC')).toBe(expected);
  });
  test('quarter is computed from the zoned month', () => {
    const edge = Date.UTC(2026, 5, 30, 20, 0); // Jun 30 20:00Z = Jul 1 in Tokyo
    expect(formatTime(edge, 'instant', 'quarter', 'en-US', 'UTC')).toBe('Q2 2026');
    expect(formatTime(edge, 'instant', 'quarter', 'en-US', 'Asia/Tokyo')).toBe('Q3 2026');
    expect(formatTime(Date.UTC(2026, 0, 1), 'date', 'quarter', 'en-US', 'Asia/Tokyo')).toBe(
      'Q1 2026',
    );
    expect(formatTime(Date.UTC(2026, 11, 31), 'date', 'quarter', 'en-US', 'UTC')).toBe('Q4 2026');
  });
  test('locale is applied', () => {
    expect(formatTime(t, 'instant', 'month', 'de-DE', 'UTC')).toMatch(/Juli 2026|Jul 2026/);
  });
  test('invalid timezone throws INVALID_OPTIONS', () => {
    try {
      formatTime(t, 'instant', 'day', 'en-US', 'Not/AZone');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DravenVizError);
      expect((e as DravenVizError).code).toBe('INVALID_OPTIONS');
    }
  });
  test('invalid timezone is rejected even for date kind', () => {
    expect(() => formatTime(t, 'date', 'day', 'en-US', 'Not/AZone')).toThrow(DravenVizError);
  });
});

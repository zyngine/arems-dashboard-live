import { parseDate, daysFromToday, getPhase, phaseFill, PHASES, progressPct, totalHours, safeUrl, initials, oName } from './format';

describe('parseDate', () => {
  test('treats a bare date as a local calendar day, not UTC midnight', () => {
    const d = parseDate('2026-03-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1]);
  });
  test('returns null for empty or invalid input', () => {
    expect(parseDate('')).toBeNull();
    expect(parseDate('not a date')).toBeNull();
  });
});

describe('daysFromToday', () => {
  const now = new Date(2026, 10, 24, 15, 30);
  test('counts whole calendar days regardless of time of day', () => {
    expect(daysFromToday('2026-11-24', now)).toBe(0);
    expect(daysFromToday('2026-11-22', now)).toBe(-2);
    expect(daysFromToday('2026-11-27', now)).toBe(3);
  });
  test('is null when there is no date', () => expect(daysFromToday(null, now)).toBeNull());
});

describe('phases', () => {
  test('phase boundaries match the 24/64/88 hour marks', () => {
    expect([0, 23, 24, 63, 64, 87, 88, 120].map(getPhase)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
  test('phaseFill is the share of that phase completed', () => {
    expect(phaseFill(PHASES[1], 44)).toBe(50);
    expect(phaseFill(PHASES[0], 44)).toBe(100);
    expect(phaseFill(PHASES[2], 44)).toBe(0);
  });
});

describe('orientee helpers', () => {
  test('hours adjustment changes the total and the percentage', () => {
    const o = { hours_completed: 60, total_hours: 96, hours_adjustment: 24 };
    expect(totalHours(o)).toBe(120);
    expect(progressPct(o)).toBe(50);
  });
  test('progress is clamped to 100', () => expect(progressPct({ hours_completed: 200 })).toBe(100));
  test('name falls back from linked user to temp name', () => {
    expect(oName({ user: { full_name: 'A B' }, temp_name: 'X' })).toBe('A B');
    expect(oName({ temp_name: 'X' })).toBe('X');
    expect(oName(null)).toBe('Unnamed');
  });
  test('initials uses at most two letters', () => expect(initials('mary ann  lee')).toBe('MA'));
});

describe('safeUrl', () => {
  test('allows http and https only', () => {
    expect(safeUrl(' https://example.org/a ')).toBe('https://example.org/a');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });
});

import { toIsoDate } from './date.util';

describe('toIsoDate', () => {
  it('returns the first 10 characters of a string value unchanged', () => {
    expect(toIsoDate('1990-05-12')).toBe('1990-05-12');
    expect(toIsoDate('1990-05-12T00:00:00.000Z')).toBe('1990-05-12');
  });

  it('renders a local-midnight Date (as pg returns for a `date` column) as the same calendar date', () => {
    // Mirrors `postgres-date`'s `getDate`: `new Date(year, month, day)`.
    expect(toIsoDate(new Date(1990, 4, 12))).toBe('1990-05-12');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2005, 0, 3))).toBe('2005-01-03');
  });
});

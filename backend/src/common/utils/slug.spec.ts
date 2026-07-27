import { toSlug, uniqueSlug } from './slug';

describe('slug helpers', () => {
  it('normalizes a public slug', () => {
    expect(toSlug('  Design & Data Karachi  ')).toBe('design-and-data-karachi');
  });

  it('adds entropy for global event URLs', () => {
    expect(uniqueSlug('Launch Day')).toMatch(/^launch-day-[a-z0-9]{6}$/);
  });
});

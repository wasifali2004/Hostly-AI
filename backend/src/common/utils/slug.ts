import slugify from 'slugify';
import { randomBytes } from 'node:crypto';

export function toSlug(value: string): string {
  return slugify(value, { lower: true, strict: true, trim: true });
}

export function uniqueSlug(value: string, maxLength = 180): string {
  const suffix = randomBytes(4).toString('hex').slice(0, 6);
  const base = toSlug(value)
    .slice(0, Math.max(1, maxLength - suffix.length - 1))
    .replace(/-+$/, '');
  return `${base}-${suffix}`;
}

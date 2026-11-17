import { describe, expect, it } from 'vitest';
import en from './en.json';
import te from './te.json';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(s: string): string[] {
  return (s.match(/\{\{\w+\}\}/g) ?? []).sort();
}

describe('translations', () => {
  it('English and Telugu have exactly the same keys', () => {
    expect(keys(te).sort()).toEqual(keys(en).sort());
  });

  it('keep the same {{placeholders}}', () => {
    const get = (o: unknown, path: string) => path.split('.').reduce((a, k) => (a as Record<string, unknown>)[k], o) as string;
    for (const key of keys(en)) {
      expect(placeholders(get(te, key)), key).toEqual(placeholders(get(en, key)));
    }
  });
});

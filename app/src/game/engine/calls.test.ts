import { describe, expect, it } from 'vitest';
import { spokenCall, teluguNumber } from './calls';

describe('spoken calls', () => {
  it('English says just the number', () => {
    expect(spokenCall(35, 'en')).toBe('thirty five');
    expect(spokenCall(30, 'en')).toBe('thirty');
    expect(spokenCall(90, 'en')).toBe('ninety');
    expect(spokenCall(11, 'en')).toBe('eleven');
    expect(spokenCall(7, 'en')).toBe('seven');
  });

  it('Telugu spells the number in Telugu words', () => {
    expect(teluguNumber(1)).toBe('ఒకటి');
    expect(teluguNumber(11)).toBe('పదకొండు');
    expect(teluguNumber(20)).toBe('ఇరవై');
    expect(teluguNumber(35)).toBe('ముప్పై ఐదు');
    expect(teluguNumber(90)).toBe('తొంభై');
    expect(spokenCall(65, 'te')).toBe('అరవై ఐదు');
  });

  it('every number 1–90 has a Telugu word', () => {
    for (let n = 1; n <= 90; n++) expect(teluguNumber(n).length).toBeGreaterThan(0);
  });
});

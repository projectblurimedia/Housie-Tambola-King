import { describe, expect, it } from 'vitest';
import { CHAMMA_SAFE, chammaCell, chammaSteps, chammaTarget, seedsValue, snlCell, snlJump, snlSteps } from './board';

describe('snakes & ladders', () => {
  it('lays squares out zig-zag from the bottom-left', () => {
    expect(snlCell(1)).toEqual({ row: 9, col: 0 });
    expect(snlCell(10)).toEqual({ row: 9, col: 9 });
    expect(snlCell(11)).toEqual({ row: 8, col: 9 });
    expect(snlCell(100)).toEqual({ row: 0, col: 0 });
  });
  it('follows ladders and snakes', () => {
    expect(snlJump(4)).toBe(14);
    expect(snlJump(98)).toBe(78);
    expect(snlJump(50)).toBe(50);
  });
  it('walks square by square', () => {
    expect(snlSteps(3, 6)).toEqual([4, 5, 6]);
    expect(snlSteps(97, 97)).toEqual([]);
  });
});

describe('ashta chamma', () => {
  it('starts each side in the middle of its edge', () => {
    expect(chammaCell(0, 0)).toBe(22); // bottom
    expect(chammaCell(1, 0)).toBe(14); // right
    expect(chammaCell(2, 0)).toBe(2); // top
    expect(chammaCell(3, 0)).toBe(10); // left
    expect([0, 1, 2, 3].every((s) => CHAMMA_SAFE.has(chammaCell(s, 0)))).toBe(true);
    expect(chammaCell(2, 24)).toBe(12); // everyone ends in the centre
  });
  it('visits all 25 squares once per side', () => {
    for (let side = 0; side < 4; side++) {
      const cells = new Set(Array.from({ length: 25 }, (_, i) => chammaCell(side, i)));
      expect(cells.size).toBe(25);
    }
  });
  it('enters only on 4 or 8 and circles the outer ring before a cut', () => {
    expect(chammaTarget(-1, 3, false)).toBeNull();
    expect(chammaTarget(-1, 4, false)).toBe(0);
    expect(chammaTarget(-1, 8, true)).toBe(0);
    expect(chammaTarget(14, 4, false)).toBe(2);
    expect(chammaTarget(14, 4, true)).toBe(18);
    expect(chammaTarget(22, 3, true)).toBeNull();
    expect(chammaTarget(24, 1, true)).toBeNull();
  });
  it('walks step by step, wrapping without a cut', () => {
    expect(chammaSteps(14, 2, false)).toEqual([15, 0, 1, 2]);
    expect(chammaSteps(14, 18, true)).toEqual([15, 16, 17, 18]);
    expect(chammaSteps(-1, 0, false)).toEqual([0]);
  });
  it('reads the seeds', () => {
    expect(seedsValue([false, false, false, false])).toBe(8);
    expect(seedsValue([true, false, true, false])).toBe(2);
    expect(seedsValue([true, true, true, true])).toBe(4);
  });
});
